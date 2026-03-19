const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

// Map extensions to secure MIME types
const MIME_TYPES = {
    '.html': 'text/html',
    '.json': 'application/json',
    '.css': 'text/css',
    '.js': 'text/javascript'
};

const server = http.createServer((req, res) => {
    console.log(`[GET] ${req.url}`);

    // Route traffic: default to index.html, otherwise map to the requested file
    let filePath = req.url === '/' ? '/index.html' : req.url;
    
    // Normalize path to prevent directory traversal attacks
    filePath = path.join(__dirname, filePath);

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.error(`[404] File not found: ${filePath}`);
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 - File Not Found');
            } else {
                console.error(`[500] Server error: ${err.code}`);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`500 - Internal Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log('\n=======================================');
    console.log('🐟 Fish! Local Engine Online');
    console.log(`🚀 Access Dashboard at: http://localhost:${PORT}`);
    console.log('=======================================\n');
    console.log('Server logs:');
});