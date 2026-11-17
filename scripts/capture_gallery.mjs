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
  '--remote-debugging-port=9608',
  '--disable-gpu',
  '--no-sandbox',
  '--window-size=1280,1200',
  '--user-data-dir=C:\\Users\\Murat\\AppData\\Local\\Temp\\chrome_gallery_h1',
]);

await new Promise((r) => setTimeout(r, 1500));

http.get('http://127.0.0.1:9608/json/list', (res) => {
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
    await send('Page.navigate', { url: 'http://localhost:5173/?state=gallery' });
    await new Promise((r) => setTimeout(r, 2000));

    // Capture screenshot
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    const buffer = Buffer.from(shot.data, 'base64');
    const outPath = path.join(outDir, '01_gallery_full.png');
    fs.writeFileSync(outPath, buffer);

    const artifactPath = path.join(artifactDir, '01_gallery_full.png');
    fs.writeFileSync(artifactPath, buffer);

    const stat = fs.statSync(outPath);
    console.log(`Captured gallery screenshot: ${outPath} (${stat.size} bytes)`);
    console.log(`Copied to artifact dir: ${artifactPath}`);

    chrome.kill();
    process.exit(0);
  });
});
