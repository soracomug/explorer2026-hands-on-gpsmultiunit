import { createHmac, timingSafeEqual } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const database = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const secrets = new SecretsManagerClient({});
let cachedSecrets;

export function parseLocation(event) {
  const headers = Object.fromEntries(Object.entries(event.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
  const imsi = headers['x-soracom-imsi'];
  if (typeof imsi !== 'string' || !/^\d{14,15}$/.test(imsi)) throw new Error('Invalid IMSI');
  const body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString('utf8') : event.body ?? '');
  const { lat, lon } = body;
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)
    || lat < -90 || lat > 90 || lon < -180 || lon > 180) throw new Error('Invalid coordinates');
  return { imsi, lat, lon, authorization: headers.authorization };
}

export function prefectureFromMunicipality(code) {
  if (typeof code !== 'string' || !/^\d{5}$/.test(code)) throw new Error('Location not found');
  const prefecture = Number(code.slice(0, 2));
  if (prefecture < 1 || prefecture > 47) throw new Error('Location not found');
  return prefecture;
}

export function hashImsi(imsi, key) {
  return createHmac('sha256', key).update(imsi).digest('hex');
}

async function loadSecrets() {
  if (cachedSecrets && cachedSecrets.expires > Date.now()) return cachedSecrets.value;
  const [beam, hash] = await Promise.all([
    secrets.send(new GetSecretValueCommand({ SecretId: process.env.INGEST_SECRET_ARN })),
    secrets.send(new GetSecretValueCommand({ SecretId: process.env.HASH_SECRET_ARN })),
  ]);
  const value = { beamToken: beam.SecretString, hashKey: hash.SecretString };
  cachedSecrets = { value, expires: Date.now() + 300_000 };
  return value;
}

function authorized(actual, token) {
  if (typeof actual !== 'string') return false;
  const expectedBytes = Buffer.from(`Bearer ${token}`);
  const actualBytes = Buffer.from(actual);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export function createHandler({ getSecrets = loadSecrets, fetchAddress = fetch, put = (item) => database.send(new PutCommand(item)) } = {}) {
  return async (event) => {
    const reply = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
    const method = event.requestContext?.http?.method ?? event.httpMethod;
    if (method !== 'POST') return reply(405, { message: 'Method not allowed' });
    let location;
    try {
      location = parseLocation(event);
    } catch {
      return reply(400, { message: 'Expected numeric lat/lon and X-Soracom-IMSI' });
    }
    let credentials;
    try {
      credentials = await getSecrets();
    } catch {
      return reply(503, { message: 'Service temporarily unavailable' });
    }
    if (!authorized(location.authorization, credentials.beamToken)) return reply(401, { message: 'Unauthorized' });
    let prefecture;
    try {
      const url = new URL('https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress');
      url.search = new URLSearchParams({ lat: String(location.lat), lon: String(location.lon) }).toString();
      const response = await fetchAddress(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) return reply(502, { message: 'Geocoder unavailable' });
      const result = await response.json();
      if (!result.results?.muniCd) return reply(422, { message: 'No Japanese municipality at this location' });
      prefecture = prefectureFromMunicipality(result.results.muniCd);
    } catch {
      return reply(502, { message: 'Geocoder unavailable or invalid response' });
    }
    try {
      await put({
        TableName: process.env.TABLE_NAME,
        Item: { deviceKey: hashImsi(location.imsi, credentials.hashKey), prefecture },
      });
    } catch {
      return reply(503, { message: 'Storage temporarily unavailable' });
    }
    return reply(200, { prefecture });
  };
}

export const handler = createHandler();