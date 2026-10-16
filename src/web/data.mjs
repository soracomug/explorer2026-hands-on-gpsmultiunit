export const prefectures = [
  ['hokkaido', '北海道'], ['aomori', '青森県'], ['iwate', '岩手県'], ['miyagi', '宮城県'],
  ['akita', '秋田県'], ['yamagata', '山形県'], ['fukushima', '福島県'], ['ibaraki', '茨城県'],
  ['tochigi', '栃木県'], ['gunma', '群馬県'], ['saitama', '埼玉県'], ['chiba', '千葉県'],
  ['tokyo', '東京都'], ['kanagawa', '神奈川県'], ['niigata', '新潟県'], ['toyama', '富山県'],
  ['ishikawa', '石川県'], ['fukui', '福井県'], ['yamanashi', '山梨県'], ['nagano', '長野県'],
  ['gifu', '岐阜県'], ['shizuoka', '静岡県'], ['aichi', '愛知県'], ['mie', '三重県'],
  ['shiga', '滋賀県'], ['kyoto', '京都府'], ['osaka', '大阪府'], ['hyogo', '兵庫県'],
  ['nara', '奈良県'], ['wakayama', '和歌山県'], ['tottori', '鳥取県'], ['shimane', '島根県'],
  ['okayama', '岡山県'], ['hiroshima', '広島県'], ['yamaguchi', '山口県'], ['tokushima', '徳島県'],
  ['kagawa', '香川県'], ['ehime', '愛媛県'], ['kochi', '高知県'], ['fukuoka', '福岡県'],
  ['saga', '佐賀県'], ['nagasaki', '長崎県'], ['kumamoto', '熊本県'], ['oita', '大分県'],
  ['miyazaki', '宮崎県'], ['kagoshima', '鹿児島県'], ['okinawa', '沖縄県'],
].map(([id, name], index) => ({ id, name, code: index + 1 }));

export function countPrefectures(items) {
  const counts = Array(48).fill(0);
  for (const item of items) {
    if (!Number.isInteger(item.prefecture) || item.prefecture < 1 || item.prefecture > 47) {
      throw new Error('APIの都道府県番号が不正です');
    }
    counts[item.prefecture] += 1;
  }
  return counts;
}

export function colorLevel(count) {
  return Math.min(5, Math.max(0, count));
}

export async function readAllPrefectures({ fetchImpl = fetch, signal, endpoint = '/api/prefectures', maxSegments = 1048576, retryDelayMs = 1000 } = {}) {
  for (let segments = 1; segments <= maxSegments; segments *= 2) {
    const items = [];
    let splitRequired = false;
    let nextSegment = 0;
    const worker = async () => {
      while (nextSegment < segments) {
        const segment = nextSegment++;
        let response;
        for (let attempt = 0; attempt < 4; attempt++) {
          signal?.throwIfAborted();
          response = await fetchImpl(`${endpoint}?segment=${segment}&segments=${segments}`, {
            signal, cache: 'no-store', credentials: 'omit', headers: { Accept: 'application/json' },
          });
          if (response.status !== 429 || attempt === 3) break;
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
        }
        if (!response.ok) {
          const body = await response.text();
          let detail = body;
          try {
            const error = JSON.parse(body);
            detail = [error.message, error.detail, error.type, error.integrationStatus, error.integrationError, error.requestId].filter(Boolean).join(': ') || body;
          } catch {
            // Keep the raw response body when the API does not return JSON.
          }
          throw new Error(`APIの取得に失敗しました (${response.status})${detail ? `: ${String(detail).slice(0, 300)}` : ''}`);
        }
        const result = await response.json();
        if (!Array.isArray(result.items) || typeof result.splitRequired !== 'boolean') throw new Error('APIの応答形式が不正です');
        splitRequired ||= result.splitRequired;
        items.push(...result.items);
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, segments) }, worker));
    if (!splitRequired) return items;
  }
  throw new Error('データが大きすぎます。集計APIへの移行が必要です');
}