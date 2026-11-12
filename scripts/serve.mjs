import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const htmlPath = new URL('../dist/index.html', import.meta.url);
const port = Number(process.env.NIGHT_MARKET_PORT || 43103);
const server = createServer(async (request, response) => {
  if (request.url !== '/' && request.url !== '/index.html') { response.writeHead(404); response.end('Not found'); return; }
  try { const html = await readFile(htmlPath); response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(html); }
  catch { response.writeHead(503); response.end('Run npm run build first.'); }
});
server.on('error', error => { console.error(`夜市找零启动失败：${error.message}。不会关闭其他进程；可用NIGHT_MARKET_PORT指定空闲端口。`); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`夜市找零：http://127.0.0.1:${port} （仅本机；Ctrl+C停止此项目服务）`));
