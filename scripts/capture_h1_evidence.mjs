// SPDX-License-Identifier: GPL-3.0-or-later
import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

const outDir = path.resolve('docs/screenshots/h1');
const artifactDir = path.resolve('C:/Users/Murat/.gemini/antigravity/brain/0e08571a-6366-416f-a983-aad9fe52732a');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(artifactDir, { recursive: true });

const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--remote-debugging-port=9609',
  '--disable-gpu',
  '--no-sandbox',
  '--window-size=1280,1000',
  '--user-data-dir=C:\\Users\\Murat\\AppData\\Local\\Temp\\chrome_evidence_h1',
]);

await new Promise((r) => setTimeout(r, 1500));

http.get('http://127.0.0.1:9609/json/list', (res) => {
  let raw = '';
  res.on('data', (d) => (raw += d));
  res.on('end', async () => {
    const list = JSON.parse(raw);
    const pageTarget = list.find((t) => t.type === 'page') ?? list[0];
    const ws = new globalThis.WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve) => {
      ws.onopen = resolve;
    });

    let msgId = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const handler = (event) => {
          const res = JSON.parse(event.data);
          if (res.id === id) {
            ws.removeEventListener('message', handler);
            if (res.error) reject(res.error);
            else resolve(res.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');

    // 1. Capture 02_error_recovery_screen.png
    console.log('Navigating to crash_recovery...');
    await send('Page.navigate', { url: 'http://localhost:5173/?state=crash_recovery' });
    await new Promise((r) => setTimeout(r, 1500));

    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    const buf1 = Buffer.from(shot1.data, 'base64');
    fs.writeFileSync(path.join(outDir, '02_error_recovery_screen.png'), buf1);
    fs.writeFileSync(path.join(artifactDir, '02_error_recovery_screen.png'), buf1);
    console.log(`Saved 02_error_recovery_screen.png (${buf1.length} bytes)`);

    // 2. Navigate to gallery and zoom 200% for voltas and lyrics
    console.log('Navigating to gallery...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 1000,
      deviceScaleFactor: 2.0,
      mobile: false,
    });

    await send('Page.navigate', { url: 'http://localhost:5173/?state=gallery' });
    await new Promise((r) => setTimeout(r, 2000));

    // Find bounding box of voltas case
    async function getElementClip(testId) {
      const evalRes = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const el = document.querySelector('[data-testid="${testId}"]');
            if (!el) return null;
            el.scrollIntoView({ block: 'center' });
            const rect = el.getBoundingClientRect();
            return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
          })()
        `,
        returnByValue: true,
      });
      return evalRes.result?.value;
    }

    // 2. Voltas open hook
    const voltaClip = await getElementClip('gallery-case-voltas-open-and-closed-hooks');
    await new Promise((r) => setTimeout(r, 500));
    const shot2 = await send('Page.captureScreenshot', {
      format: 'png',
      clip: voltaClip ? { x: voltaClip.x, y: voltaClip.y, width: voltaClip.width, height: voltaClip.height, scale: 2 } : undefined,
    });
    const buf2 = Buffer.from(shot2.data, 'base64');
    fs.writeFileSync(path.join(outDir, '03_voltas_open_hook_200.png'), buf2);
    fs.writeFileSync(path.join(artifactDir, '03_voltas_open_hook_200.png'), buf2);
    console.log(`Saved 03_voltas_open_hook_200.png (${buf2.length} bytes)`);

    // 3. Lyrics hyphen and extender
    const lyricClip = await getElementClip('gallery-case-lyrics-hyphens-and-extenders');
    await new Promise((r) => setTimeout(r, 500));
    const shot3 = await send('Page.captureScreenshot', {
      format: 'png',
      clip: lyricClip ? { x: lyricClip.x, y: lyricClip.y, width: lyricClip.width, height: lyricClip.height, scale: 2 } : undefined,
    });
    const buf3 = Buffer.from(shot3.data, 'base64');
    fs.writeFileSync(path.join(outDir, '04_lyrics_hyphen_extender_200.png'), buf3);
    fs.writeFileSync(path.join(artifactDir, '04_lyrics_hyphen_extender_200.png'), buf3);
    console.log(`Saved 04_lyrics_hyphen_extender_200.png (${buf3.length} bytes)`);

    chrome.kill();
    process.exit(0);
  });
});
