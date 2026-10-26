// Headless Chrome(CDP) 로 1920×1080 캡처. 외부 패키지 없이 Node 22 내장 WebSocket 사용.
// 사용: node shoot.mjs shots.json outDir
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [,, shotsFile, outDir] = process.argv;
const shots = shotsFile.endsWith('.mjs') ? (await import(join(process.cwd(), shotsFile))).default : JSON.parse(readFileSync(shotsFile, 'utf8'));
mkdirSync(outDir, { recursive: true });
const W = 1920, H = 1080, PORT = 9333;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = mkdtempSync(join(tmpdir(), 'cap-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`, '--hide-scrollbars', '--force-device-scale-factor=1', '--no-first-run', 'about:blank'], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function targets() { for (let i = 0; i < 50; i++) { try { return await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); } catch { await sleep(200); } } throw new Error('no chrome'); }
const list = await targets();
const page = list.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pend = new Map(); const listeners = [];
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else listeners.forEach(f => f(m)); });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async (expr) => { const r = await send('Runtime.evaluate', { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) console.error('JS error:', JSON.stringify(r.result.exceptionDetails).slice(0, 400)); return r.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
listeners.push(m => { if (m.method === 'Runtime.exceptionThrown') console.error('page error:', m.params.exceptionDetails?.exception?.description?.slice(0, 200)); });

async function go(url) {
  const loaded = new Promise(r => { const f = m => { if (m.method === 'Page.loadEventFired') { listeners.splice(listeners.indexOf(f), 1); r(); } }; listeners.push(f); });
  await send('Page.navigate', { url }); await loaded; await sleep(600);
}
const only = process.argv[4] ? process.argv[4].split(',') : null;
for (const s of shots) {
  if (only && !only.includes(s.name)) continue;
  if (s.pre) { await go(s.preUrl || s.url); await evalJs(s.pre); }
  await go(s.url);
  if (s.setup) { const v = await evalJs(s.setup); if (v) console.log(s.name, '→', v); }
  await sleep(s.wait ?? 700);
  if (s.noshot) continue;
  if (s.after) { const v = await evalJs(s.after); if (v) console.log(s.name, 'after →', v); await sleep(400); }
  const fullH = process.env.FULL ? await evalJs('return document.documentElement.scrollHeight') : 0;
  const shot = await send('Page.captureScreenshot', fullH ? { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: W, height: Math.min(fullH, 4000), scale: 0.5 } } : { format: 'png' });
  writeFileSync(join(outDir, s.name + '.png'), Buffer.from(shot.result.data, 'base64'));
  console.log('saved', s.name);
}
ws.close(); chrome.kill();
