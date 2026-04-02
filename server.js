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
    ENV: 'development', // 'development' or 'production'
    PORT: 8080,
    HOST: 'localhost',
    CACHE_MAX_AGE: 86400,
    USE_SSL: false,
    SSL_KEY: '',
    SSL_CERT: '',
    DEFAULT_LANG: 'en'
};

if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            const trimmedKey = key.trim();
            const trimmedValue = value.trim();
            if (trimmedKey === 'ENV' || trimmedKey === 'NODE_ENV') config.ENV = trimmedValue.toLowerCase();
            if (trimmedKey === 'PORT') config.PORT = parseInt(trimmedValue);
            if (trimmedKey === 'HOST') config.HOST = trimmedValue;
            if (trimmedKey === 'CACHE_MAX_AGE') config.CACHE_MAX_AGE = parseInt(trimmedValue);
            if (trimmedKey === 'USE_SSL') config.USE_SSL = trimmedValue.toLowerCase() === 'true';
            if (trimmedKey === 'SSL_KEY') config.SSL_KEY = trimmedValue;
            if (trimmedKey === 'SSL_CERT') config.SSL_CERT = trimmedValue;
            if (trimmedKey === 'DEFAULT_LANG') config.DEFAULT_LANG = trimmedValue.toLowerCase();
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
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// --- CACHE CONTROLLER ---
const applyCacheHeaders = (res, extname, route) => {
    if (config.ENV === 'development') {
        // DEV MODE: Cache absolutely nothing
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
    } else {
        // PROD MODE: Cache strictly static assets, bypass dynamic ones
        const isDynamic = extname === '.css' || extname === '.json' || route.startsWith('/lang/') || route.startsWith('/data/');
        
        if (isDynamic) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        } else {
            // HTML, JS, and Images get standard caching
            res.setHeader('Cache-Control', `public, max-age=${config.CACHE_MAX_AGE}`);
        }
    }
};

// --- CORE ROUTER LOGIC ---
const requestHandler = (req, res) => {
    // Intercept Favicon
    if (req.url === '/favicon.ico') {
        const svgFish = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><path fill='#58a6ff' d='M62 32 C62 15, 30 15, 18 32 C30 49, 62 49, 62 32 Z'/><path fill='#58a6ff' d='M22 32 L4 16 L4 48 Z'/><circle cx='48' cy='28' r='3' fill='#090c10'/></svg>`;
        
        // 1. Queue up the headers FIRST
        res.setHeader('Content-Type', 'image/svg+xml');
        applyCacheHeaders(res, '.svg', req.url);
        
        // 2. THEN send the 200 OK status and the file
        res.writeHead(200);
        res.end(svgFish);
        return;
    }

    // Security: Strip query params and prevent Directory Traversal (../../)
    let route = req.url.split('?')[0];
    route = route.replace(/\.\./g, '');

    let filePath;

    // 1. Core Page Routes (Mapped to /web/ HTML files)
    if (route === '/' || route === '/index' || route === '/index.html') {
        filePath = path.join(__dirname, 'web', 'index.html');
    } else if (route === '/tools' || route === '/tools.html') {
        filePath = path.join(__dirname, 'web', 'tools.html');
    } 
    // 2. Data Route (Mapped strictly to root /data/ folder)
    else if (route.startsWith('/data/')) {
        filePath = path.join(__dirname, route); 
    } 
    // 3. Asset & Theme Routes (Mapped strictly to /web/ subdirectories)
    else if (route.startsWith('/styles/') || route.startsWith('/assets/') || route.startsWith('/lang/')) {
        filePath = path.join(__dirname, 'web', route);
    }
    // 4. Catch-All Fallback
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
            
            // --- 1. HTML: AUTOMATED CACHE BUSTING & ENV INJECTION ---
            if (extname === '.html') {
                let htmlStr = content.toString('utf-8');
                
                // Regex: Cache Buster (Appends ?v=1.0.0 ONLY to .js files. CSS IS NOW EXCLUDED!)
                htmlStr = htmlStr.replace(/(href|src)=["']([^"']+\.js)(?:\?[^"']*)?["']/gi, `$1="$2?v=${APP_VERSION}"`);
                
                // Inject Server Config into HTML Head
                const envInjection = `<script>window.SERVER_DEFAULT_LANG = "${config.DEFAULT_LANG}";</script>`;
                htmlStr = htmlStr.replace('</head>', `${envInjection}\n</head>`);
                
                res.setHeader('Content-Type', contentType);
                applyCacheHeaders(res, extname, route);
                res.writeHead(200);
                res.end(htmlStr, 'utf-8');
                
                console.log(`[GET] ${req.url} (Cache: ${config.ENV} | Lang: ${config.DEFAULT_LANG})`);
            } 
            // --- 2. ALL OTHER ASSETS ---
            else {
                res.setHeader('Content-Type', contentType);
                applyCacheHeaders(res, extname, route);
                res.writeHead(200);
                res.end(content);
                
                // Only log non-HTML traffic if in Dev mode to keep production console clean
                if (config.ENV === 'development') {
                    console.log(`[GET] ${req.url}`);
                }
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
        process.exit(1); 
    }
} else {
    server = http.createServer(requestHandler);
}

server.listen(config.PORT, config.HOST, () => {
    console.log('\n=======================================');
    console.log(`🐟 Fish! Appraiser Engine : Release v${APP_VERSION}`);
    console.log(`👤 Developer: Vixenlicious`);
    console.log(`⚙️  Environment: [${config.ENV.toUpperCase()}] Mode`);
    console.log(`🔒 Security: ${config.USE_SSL ? 'SSL Enabled' : 'Local / Unencrypted'}`);
    console.log(`🌐 Language: Base config set to [${config.DEFAULT_LANG.toUpperCase()}]`);
    console.log(`🚀 Network: ${protocol}://${config.HOST}:${config.PORT}`);
    console.log('=======================================\n');
});