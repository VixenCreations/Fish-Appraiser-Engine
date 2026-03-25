const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// --- APP VERSION (CACHE BUSTER) ---
let APP_VERSION = '1.0.0';
try {
    const pkgPath = path.join(__dirname, 'package.json');
    if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        APP_VERSION = pkg.version || '1.0.0';
    }
} catch (err) {
    console.log('[WARN] Could not read package.json version. Defaulting to 1.0.0');
}

// --- NATIVE ENV PARSER ---
const envPath = path.join(__dirname, '.env');
const config = {
    PORT: 8080,
    HOST: 'localhost',
    CACHE_MAX_AGE: 86400,
    USE_SSL: false,
    SSL_KEY: '',
    SSL_CERT: ''
};

if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            const trimmedKey = key.trim();
            const trimmedValue = value.trim();
            if (trimmedKey === 'PORT') config.PORT = parseInt(trimmedValue);
            if (trimmedKey === 'HOST') config.HOST = trimmedValue;
            if (trimmedKey === 'CACHE_MAX_AGE') config.CACHE_MAX_AGE = parseInt(trimmedValue);
            if (trimmedKey === 'USE_SSL') config.USE_SSL = trimmedValue.toLowerCase() === 'true';
            if (trimmedKey === 'SSL_KEY') config.SSL_KEY = trimmedValue;
            if (trimmedKey === 'SSL_CERT') config.SSL_CERT = trimmedValue;
        }
    });
}

const MIME_TYPES = {
    '.html': 'text/html',
    '.json': 'application/json',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

// --- CORE ROUTER LOGIC ---
const requestHandler = (req, res) => {
    // Intercept Favicon
    if (req.url === '/favicon.ico') {
        const svgFish = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><path fill='#58a6ff' d='M62 32 C62 15, 30 15, 18 32 C30 49, 62 49, 62 32 Z'/><path fill='#58a6ff' d='M22 32 L4 16 L4 48 Z'/><circle cx='48' cy='28' r='3' fill='#090c10'/></svg>`;
        res.writeHead(200, { 
            'Content-Type': 'image/svg+xml',
            'Cache-Control': `public, max-age=${config.CACHE_MAX_AGE}`
        });
        res.end(svgFish);
        return;
    }

    let route = req.url.split('?')[0];
    let filePath;

    // 1. Core Page Routes (Mapped to /web/)
    if (route === '/' || route === '/index') {
        filePath = path.join(__dirname, 'web', 'index.html');
    } else if (route === '/tools') {
        filePath = path.join(__dirname, 'web', 'tools.html');
    } 
    // 2. Data Route (Mapped to root /data/ folder)
    else if (route.startsWith('/data/')) {
        filePath = path.join(__dirname, route); 
    } 
    // 3. All other frontend assets (Mapped to /web/ folder)
    else {
        filePath = path.join(__dirname, 'web', route);
    }

    const extname = String(path.extname(filePath)).toLowerCase() || '.html';
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(err.code === 'ENOENT' ? 404 : 500);
            res.end(err.code === 'ENOENT' ? '404 - Not Found' : '500 - Server Error');
            console.log(`[ERR] ${err.code} on ${req.url} (Mapped: ${filePath})`);
        } else {
            
            // --- AUTOMATED CACHE BUSTING ENGINE ---
            if (extname === '.html') {
                // Convert buffer to string so we can manipulate the HTML
                let htmlStr = content.toString('utf-8');
                
                // Regex: Finds all src="" and href="" pointing to .css or .js files
                // It actively overrides any old ?v= tags with the live package.json version
                htmlStr = htmlStr.replace(/(href|src)=["']([^"']+\.(css|js))(?:\?[^"']*)?["']/gi, `$1="$2?v=${APP_VERSION}"`);
                
                res.writeHead(200, { 
                    'Content-Type': contentType,
                    'Cache-Control': `public, max-age=${config.CACHE_MAX_AGE}`
                });
                res.end(htmlStr, 'utf-8');
                console.log(`[GET] ${req.url} (Injected Cache v${APP_VERSION})`);
            } 
            // --- STANDARD ASSETS (Images, JSON, CSS, JS) ---
            else {
                res.writeHead(200, { 
                    'Content-Type': contentType,
                    'Cache-Control': `public, max-age=${config.CACHE_MAX_AGE}`
                });
                // Send raw binary buffer for standard assets
                res.end(content);
                console.log(`[GET] ${req.url}`);
            }
        }
    });
};

// --- BOOT SEQUENCE & SSL TOGGLE ---
let server;
let protocol = 'http';

if (config.USE_SSL) {
    try {
        const sslOptions = {
            key: fs.readFileSync(path.join(__dirname, config.SSL_KEY)),
            cert: fs.readFileSync(path.join(__dirname, config.SSL_CERT))
        };
        server = https.createServer(sslOptions, requestHandler);
        protocol = 'https';
    } catch (err) {
        console.error('\n[FATAL ERROR] Failed to boot SSL server. Check your cert paths in .env!');
        console.error(err.message);
        process.exit(1); // Kill the app if SSL is requested but fails
    }
} else {
    server = http.createServer(requestHandler);
}

server.listen(config.PORT, config.HOST, () => {
    console.log('\n=======================================');
    console.log(`🐟 Fish! Appraiser Engine : Release v${APP_VERSION}`);
    console.log(`👤 Developer: Vixenlicious`);
    console.log(`🔒 Security: ${config.USE_SSL ? 'SSL Enabled' : 'Local / Unencrypted'}`);
    console.log(`🚀 Network: ${protocol}://${config.HOST}:${config.PORT}`);
    console.log('=======================================\n');
});