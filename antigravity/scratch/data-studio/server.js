const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DIR = __dirname;

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
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 - Server error: ' + err.message);
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 DataStudio Server running at http://localhost:${PORT}`);
  console.log(`📂 Serving files from: ${DIR}`);
  console.log(`\n Press Ctrl+C to stop the server\n`);
});
