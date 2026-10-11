import test from 'node:test';
import assert from 'node:assert/strict';
import Japan from '@svg-maps/japan';
import { prefectures, countPrefectures, colorLevel, readAllPrefectures } from '../web/data.mjs';

const response = (items, splitRequired = false) => ({ ok: true, json: async () => ({ items, splitRequired }) });

test('maps all 47 licensed prefecture shapes to JIS prefecture codes', () => {
  const map = Japan.default ?? Japan;
  assert.equal(map.locations.length, 47);
  assert.deepEqual(prefectures.map(({ code }) => code), Array.from({ length: 47 }, (_, index) => index + 1));
  assert.equal(new Set(prefectures.map(({ id }) => id)).size, 47);
  for (const prefecture of prefectures) {
    assert.ok(map.locations.find(({ id, path }) => id === prefecture.id && path.length > 0), prefecture.name);
  }
  assert.equal(prefectures[12].id, 'tokyo');
  assert.equal(prefectures[46].id, 'okinawa');
});

test('counts duplicate prefectures and caps colors at ten levels', () => {
  const counts = countPrefectures([...Array(12).fill({ prefecture: 13 }), { prefecture: 1 }, { prefecture: 47 }, { prefecture: 47 }]);
  assert.equal(counts[13], 12);
  assert.equal(counts[1], 1);
  assert.equal(counts[47], 2);
  assert.equal(counts[27], 0);
  for (let count = 0; count <= 12; count++) assert.equal(colorLevel(count), Math.min(10, count));
  assert.deepEqual(countPrefectures([]), Array(48).fill(0));
  for (const prefecture of [0, 48, 1.5, '13', null]) assert.throws(() => countPrefectures([{ prefecture }]));
});

test('reads the complete single-segment result without sending device keys', async () => {
  const result = await readAllPrefectures({ fetchImpl: async (url, options) => {
    assert.equal(url, '/api/prefectures?segment=0&segments=1');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store');
    return response([{ prefecture: 13 }, { prefecture: 27 }]);
  } });
  assert.deepEqual(result, [{ prefecture: 13 }, { prefecture: 27 }]);
});

test('restarts all segments after truncation and never double counts earlier rounds', async () => {
  const visited = [];
  const result = await readAllPrefectures({ fetchImpl: async (url) => {
    visited.push(url);
    const params = new URL(url, 'https://example.test').searchParams;
    const segments = Number(params.get('segments'));
    const segment = Number(params.get('segment'));
    if (segments === 1) return response([], true);
    if (segments === 2) return segment === 0 ? response([{ prefecture: 13 }]) : response([], true);
    return response([{ prefecture: segment + 1 }]);
  } });
  assert.deepEqual(result.map(({ prefecture }) => prefecture).sort((first, second) => first - second), [1, 2, 3, 4]);
  assert.equal(visited.length, 7);
  assert.equal(visited.some((url) => /deviceKey|cursor|token/i.test(url)), false);
});

test('returns an empty table and rejects failed, malformed, or oversized scans', async () => {
  assert.deepEqual(await readAllPrefectures({ fetchImpl: async () => response([]) }), []);
  await assert.rejects(readAllPrefectures({ fetchImpl: async () => ({ ok: false, status: 503 }) }), /503/);
  await assert.rejects(readAllPrefectures({ fetchImpl: async () => ({ ok: true, json: async () => ({ items: {} }) }) }), /応答形式/);
  await assert.rejects(readAllPrefectures({ maxSegments: 2, fetchImpl: async () => response([], true) }), /大きすぎ/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(readAllPrefectures({ signal: controller.signal, fetchImpl: async (url, { signal }) => signal.throwIfAborted() }), { name: 'AbortError' });
});

test('retries throttled segments without duplicate items and bounds retries', async () => {
  let calls = 0;
  const result = await readAllPrefectures({ retryDelayMs: 0, fetchImpl: async () => {
    calls++;
    return calls < 3 ? { ok: false, status: 429 } : response([{ prefecture: 13 }]);
  } });
  assert.equal(calls, 3);
  assert.deepEqual(result, [{ prefecture: 13 }]);
  calls = 0;
  await assert.rejects(readAllPrefectures({ retryDelayMs: 0, fetchImpl: async () => {
    calls++;
    return { ok: false, status: 429 };
  } }), /429/);
  assert.equal(calls, 4);
});