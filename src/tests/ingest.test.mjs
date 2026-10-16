import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, parseLocation, hashImsi, prefectureFromMunicipality } from '../lambda/ingest.mjs';

const imsi = '440100123456789';
const event = (body = { lat: 35.681236, lon: 139.767125 }) => ({
  httpMethod: 'POST', headers: { 'X-Soracom-IMSI': imsi, Authorization: 'Bearer test-token' }, body: JSON.stringify(body),
});
const credentials = { beamToken: 'test-token', hashKey: 'independent-test-hash-key' };

test('stores only HMAC IMSI key and prefecture from GSI municipality', async () => {
  const writes = [];
  const handler = createHandler({
    getSecrets: async () => credentials,
    fetchAddress: async (url) => {
      assert.equal(url.origin, 'https://mreversegeocoder.gsi.go.jp');
      assert.equal(url.searchParams.get('lat'), '35.681236');
      assert.equal(url.searchParams.get('lon'), '139.767125');
      return { ok: true, json: async () => ({ results: { muniCd: '13101' } }) };
    },
    put: async (request) => writes.push(request),
  });
  const response = await handler(event());
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { prefecture: 13 });
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].Item, { deviceKey: hashImsi(imsi, credentials.hashKey), prefecture: 13 });
  assert.equal(JSON.stringify(writes).includes(imsi), false);
});

test('same IMSI overwrites the same key when moving prefectures', async () => {
  const items = new Map();
  let code = '13101';
  const handler = createHandler({ getSecrets: async () => credentials,
    fetchAddress: async () => ({ ok: true, json: async () => ({ results: { muniCd: code } }) }),
    put: async ({ Item }) => items.set(Item.deviceKey, Item),
  });
  assert.equal((await handler(event())).statusCode, 200);
  code = '27127';
  assert.equal((await handler(event())).statusCode, 200);
  assert.equal(items.size, 1);
  assert.equal([...items.values()][0].prefecture, 27);
});

test('rejects invalid location and IMSI without external calls', async () => {
  const handler = createHandler({ getSecrets: async () => assert.fail('Must not load secrets') });
  for (const body of [{ lat: '35', lon: 139 }, { lat: 91, lon: 139 }, { lat: 35, lon: -181 }, { lat: null, lon: 139 }]) {
    assert.equal((await handler(event(body))).statusCode, 400);
  }
  assert.equal((await handler({ ...event(), body: '{' })).statusCode, 400);
  assert.equal((await handler({ ...event(), headers: {} })).statusCode, 400);
  assert.equal((await handler({ ...event(), headers: { 'x-soracom-imsi': 'invalid' } })).statusCode, 400);
});

test('handles case insensitive headers and base64 JSON', () => {
  const request = event();
  request.body = Buffer.from(request.body).toString('base64');
  request.isBase64Encoded = true;
  assert.deepEqual(parseLocation(request), { imsi, lat: 35.681236, lon: 139.767125, authorization: 'Bearer test-token' });
});

test('accepts direct Beam JSON in an HTTP API v2 event', async () => {
  const request = {
    version: '2.0',
    routeKey: 'ANY /data_dump',
    headers: { 'x-soracom-imsi': imsi, authorization: 'Bearer test-token' },
    requestContext: { http: { method: 'POST', path: '/default/data_dump' } },
    body: JSON.stringify({ lat: 33.761929, lon: 130.490642, bat: 3, rs: 3, temp: 20.1, humi: 57.2, x: -252.8, y: 551.8, z: 852.3, type: 1, binaryParserEnabled: true }),
    isBase64Encoded: false,
  };
  const writes = [];
  const handler = createHandler({ getSecrets: async () => credentials,
    fetchAddress: async (url) => {
      assert.equal(url.searchParams.get('lat'), '33.761929');
      assert.equal(url.searchParams.get('lon'), '130.490642');
      return { ok: true, json: async () => ({ results: { muniCd: '40203' } }) };
    },
    put: async ({ Item }) => writes.push(Item),
  });
  assert.deepEqual(parseLocation(request), { imsi, lat: 33.761929, lon: 130.490642, authorization: 'Bearer test-token' });
  const result = await handler(request);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body), { prefecture: 40 });
  assert.deepEqual(writes, [{ deviceKey: hashImsi(imsi, credentials.hashKey), prefecture: 40 }]);
  request.requestContext.http.method = 'GET';
  assert.equal((await handler(request)).statusCode, 405);
  request.requestContext.http.method = 'POST';
  delete request.headers.authorization;
  assert.equal((await handler(request)).statusCode, 401);
  assert.equal(writes.length, 1);
});

test('rejects payload envelopes without direct lat and lon', async () => {
  const handler = createHandler({ getSecrets: () => assert.fail('Must not load secrets') });
  const payload = Buffer.from(JSON.stringify({ lat: 35.681236, lon: 139.767125 })).toString('base64');
  assert.equal((await handler(event({ payload }))).statusCode, 400);
});

test('rejects unauthorized requests before geocoding or writing', async () => {
  const handler = createHandler({ getSecrets: async () => credentials, fetchAddress: () => assert.fail('Must not geocode'), put: () => assert.fail('Must not write') });
  for (const authorization of [undefined, 'Bearer wrong', 'Bearer test-tokem']) {
    const request = event();
    request.headers.Authorization = authorization;
    assert.equal((await handler(request)).statusCode, 401);
  }
});

test('does not store unmatched or unavailable geocoder results', async () => {
  for (const [fetchAddress, expected] of [
    [async () => ({ ok: true, json: async () => ({ results: {} }) }), 422],
    [async () => ({ ok: false }), 502],
    [async () => { throw new Error('Timeout'); }, 502],
    [async () => ({ ok: true, json: async () => ({ results: { muniCd: '99101' } }) }), 502],
  ]) {
    const handler = createHandler({ getSecrets: async () => credentials, fetchAddress, put: () => assert.fail('Must not write') });
    assert.equal((await handler(event())).statusCode, expected);
  }
});

test('returns recoverable errors for secrets and DynamoDB failures', async () => {
  assert.equal((await createHandler({ getSecrets: async () => { throw new Error('Secrets unavailable'); } })(event())).statusCode, 503);
  const handler = createHandler({ getSecrets: async () => credentials,
    fetchAddress: async () => ({ ok: true, json: async () => ({ results: { muniCd: '01101' } }) }),
    put: async () => { throw new Error('DynamoDB unavailable'); },
  });
  assert.equal((await handler(event())).statusCode, 503);
  assert.equal((await handler({ ...event(), httpMethod: 'GET' })).statusCode, 405);
});

test('prefecture codes and HMAC honor boundaries and secret separation', () => {
  assert.equal(prefectureFromMunicipality('01101'), 1);
  assert.equal(prefectureFromMunicipality('47201'), 47);
  for (const code of ['00101', '48101', '1310', 13101]) assert.throws(() => prefectureFromMunicipality(code));
  assert.match(hashImsi(imsi, credentials.hashKey), /^[a-f0-9]{64}$/);
  assert.notEqual(hashImsi(imsi, credentials.hashKey), hashImsi(imsi, 'different-key'));
  assert.notEqual(hashImsi(imsi, credentials.hashKey), hashImsi('440100123456788', credentials.hashKey));
});