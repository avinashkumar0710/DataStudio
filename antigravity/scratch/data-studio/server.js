const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DIR = __dirname;
const LOG_DIR = path.join(DIR, 'log');

// ── Logging system ──
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function ts(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function dayStamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}

// Append a line to the daily log file (async, non-blocking)
function writeLog(level, message, meta) {
  const file = path.join(LOG_DIR, `app-${dayStamp()}.log`);
  const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
  const line = `[${ts()}] [${level}] ${message}${metaStr}\n`;
  fs.appendFile(file, line, err => { if (err) console.error('Log write failed:', err); });
}

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.csv': 'text/csv',
  '.txt': 'text/plain'
};

const server = http.createServer((req, res) => {
  // Log every incoming request
  const start = Date.now();
  writeLog('REQ', `${req.method} ${req.url}`, { ip: req.socket.remoteAddress });

  // ── Log API endpoint (client → server) ──
  if (req.url.startsWith('/api/log') && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        writeLog(data.level || 'INFO', data.message || '(no message)', data.meta || null);
      } catch (e) {
        writeLog('WARN', 'Invalid log payload', { raw: body.slice(0, 200) });
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  // Handle root path
  let filePath = path.join(DIR, req.url === '/' ? 'index.html' : req.url);
  
  // Remove query string
  filePath = filePath.split('?')[0];
  
  // Get file extension
  const ext = path.extname(filePath).toLowerCase();
  
  // Default to index.html for root
  if (req.url === '/') {
    filePath = path.join(DIR, 'index.html');
  }
  
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      writeLog('WARN', `404 ${req.url}`);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 - File not found');
      return;
    }
    
    // Read and serve file
    const data = fs.readFileSync(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
    writeLog('RES', `${req.method} ${req.url} → 200 (${Date.now()-start}ms)`);
  } catch (err) {
    writeLog('ERROR', `500 ${req.url}: ${err.message}`);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 - Server error: ' + err.message);
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 DataStudio Server running at http://localhost:${PORT}`);
  console.log(`📂 Serving files from: ${DIR}`);
  console.log(`📝 Logs written to: ${LOG_DIR}`);
  console.log(`\n Press Ctrl+C to stop the server\n`);
  writeLog('INFO', 'Server started', { port: PORT });
});
