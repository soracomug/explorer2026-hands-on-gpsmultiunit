import Japan from '@svg-maps/japan';
import { createElement, RefreshCw } from 'lucide';
import { prefectures, countPrefectures, colorLevel, readAllPrefectures } from './data.mjs';

const svgNamespace = 'http://www.w3.org/2000/svg';
const byId = (id) => document.getElementById(id);
const map = document.createElementNS(svgNamespace, 'svg');
map.setAttribute('viewBox', Japan.viewBox);
map.setAttribute('class', 'japan-map');
map.setAttribute('aria-label', '日本の47都道府県');
map.setAttribute('role', 'group');
const shapes = new Map();
const rows = new Map();
let counts = Array(48).fill(0);
let hasData = false;
let selectedCode;
let timer;
let inFlight = false;
let controller;

function selectPrefecture(code) {
  selectedCode = code;
  const prefecture = prefectures[code - 1];
  byId('selection').textContent = `${prefecture.name} · ${hasData ? `${counts[code]}台` : '未取得'}`;
  for (const [shapeCode, shape] of shapes) shape.dataset.selected = String(shapeCode === code);
  for (const [rowCode, row] of rows) row.dataset.selected = String(rowCode === code);
}

for (const prefecture of prefectures) {
  const location = Japan.locations.find(({ id }) => id === prefecture.id);
  const shape = document.createElementNS(svgNamespace, 'path');
  shape.setAttribute('d', location.path);
  shape.setAttribute('class', 'prefecture');
  shape.setAttribute('tabindex', '0');
  shape.setAttribute('role', 'button');
  shape.dataset.code = String(prefecture.code);
  shape.dataset.level = '0';
  shape.setAttribute('aria-label', `${prefecture.name}、未取得`);
  const title = document.createElementNS(svgNamespace, 'title');
  title.textContent = `${prefecture.name} · 未取得`;
  shape.append(title);
  shape.addEventListener('click', () => selectPrefecture(prefecture.code));
  shape.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectPrefecture(prefecture.code);
    }
  });
  map.append(shape);
  shapes.set(prefecture.code, shape);
  const row = document.createElement('tr');
  const name = document.createElement('td');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'prefecture-name';
  button.textContent = prefecture.name;
  button.addEventListener('click', () => selectPrefecture(prefecture.code));
  name.append(button);
  const count = document.createElement('td');
  count.textContent = '--';
  row.append(name, count);
  byId('prefecture-list').append(row);
  rows.set(prefecture.code, row);
}
byId('map').append(map);
byId('map').setAttribute('aria-busy', 'false');
byId('refresh-icon').append(createElement(RefreshCw, { width: '18', height: '18', 'aria-hidden': 'true' }));
for (let level = 1; level <= 5; level++) {
  const swatch = document.createElement('span');
  swatch.dataset.level = String(level);
  swatch.textContent = level === 5 ? '5+' : String(level);
  byId('scale').append(swatch);
}

function render(items) {
  counts = countPrefectures(items);
  hasData = true;
  byId('total').textContent = String(items.length);
  byId('active').textContent = String(counts.filter((count) => count > 0).length);
  for (const prefecture of prefectures) {
    const shape = shapes.get(prefecture.code);
    const count = counts[prefecture.code];
    shape.dataset.level = String(colorLevel(count));
    shape.setAttribute('aria-label', `${prefecture.name}、${count}台`);
    shape.querySelector('title').textContent = `${prefecture.name} · ${count}台`;
    rows.get(prefecture.code).lastElementChild.textContent = String(count);
  }
  if (selectedCode) selectPrefecture(selectedCode);
  const now = new Date();
  byId('updated').dateTime = now.toISOString();
  byId('updated').textContent = now.toLocaleTimeString('ja-JP', { hour12: false });
  byId('updated').title = now.toLocaleString('ja-JP');
}

function schedule() {
  clearTimeout(timer);
  if (byId('auto-refresh').checked && !document.hidden) timer = setTimeout(refresh, Number(byId('interval').value));
}

async function refresh() {
  if (inFlight) return;
  clearTimeout(timer);
  inFlight = true;
  byId('refresh').disabled = true;
  byId('status').textContent = '更新中';
  byId('status').dataset.state = 'loading';
  controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const items = await readAllPrefectures({ signal: controller.signal });
    render(items);
    byId('error').hidden = true;
    byId('status').textContent = byId('auto-refresh').checked ? '自動更新中' : '自動更新停止';
    byId('status').dataset.state = 'ready';
  } catch (error) {
    controller.abort();
    byId('error').textContent = `${error.name === 'AbortError' ? '取得がタイムアウトしました' : error.message}。${hasData ? '前回取得したデータを表示しています。' : '現在地データはまだ取得できていません。'}`;
    byId('error').hidden = false;
    byId('status').textContent = '接続エラー';
    byId('status').dataset.state = 'error';
  } finally {
    clearTimeout(timeout);
    inFlight = false;
    byId('refresh').disabled = false;
    schedule();
  }
}

byId('refresh').addEventListener('click', refresh);
byId('auto-refresh').addEventListener('change', () => {
  if (hasData && byId('status').dataset.state === 'ready') byId('status').textContent = byId('auto-refresh').checked ? '自動更新中' : '自動更新停止';
  byId('interval').disabled = !byId('auto-refresh').checked;
  schedule();
});
byId('interval').addEventListener('change', schedule);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearTimeout(timer);
  else if (byId('auto-refresh').checked) refresh();
});
refresh();