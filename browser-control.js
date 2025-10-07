#!/usr/bin/env node
// browser-control.js
// A MCP server that can control a browser via Playwright

import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const url = process.argv[2] || 'about:blank';
const COOKIES_PATH = './cookies.json';
const USER_DATA_DIR = path.resolve('./user-data');

function log(...args) { console.log('[browser-control]', ...args); }

async function saveCookies(context) {
  try {
    const cookies = await context.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    log('Saved cookies to', COOKIES_PATH);
  } catch (e) { log('Error saving cookies:', e?.message ?? e); }
}

async function ensurePage(context, pageRef) {
  try {
    if (!pageRef.page || pageRef.page.isClosed()) {
      pageRef.page = await context.newPage();
      pageRef.page.on('console', msg => log('page console>', msg.text()));
      log('Created new page');
    }
  } catch (e) {
    log('ensurePage error:', e?.message ?? e);
  }
}

let browser;
let context;
const pageRef = { page: null };

async function startBrowser() {
  try {
    log('Launching Playwright Chromium (headed) with userDataDir=', USER_DATA_DIR);
    browser = await chromium.launchPersistentContext(USER_DATA_DIR, { headless: false });
    context = browser;
    await ensurePage(context, pageRef);
    try {
      await pageRef.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      log('Opened', url);
    } catch (e) {
      log('Error opening URL:', e?.message ?? e);
    }
    return { browser, context };
  } catch (err) {
    log('startBrowser failed:', err?.message ?? err);
    throw err;
  }
}

const PORT = 9222;
let server;

async function startServer() {
  server = http.createServer(async (req, res) => {
    try {
      if (!pageRef.page || pageRef.page.isClosed()) await ensurePage(context, pageRef);
      if (req.url.startsWith('/getContent')) {
        const html = await pageRef.page.content();
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(html);
      } else if (req.url.startsWith('/getText')) {
        const text = await pageRef.page.innerText('body').catch(() => '');
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
        res.end(text);
      } else if (req.url.startsWith('/screenshot')) {
        const buf = await pageRef.page.screenshot({ fullPage: true }).catch(() => null);
        if (buf) { res.writeHead(200, { 'content-type': 'image/png' }); res.end(buf); }
        else { res.writeHead(500); res.end('screenshot failed'); }
      } else if (req.url.startsWith('/shutdown')) {
        res.writeHead(200, { 'content-type': 'text/plain' }); res.end('shutting down'); await gracefulShutdown();
      } else {
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }); res.end('browser-control OK');
      }
    } catch (err) {
      log('server handler error:', err?.message ?? err);
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error: ' + (err?.message ?? err));
    }
  });

  server.listen(PORT, () => log(`Control server running at http://localhost:${PORT} — endpoints: /getText /getContent /screenshot /shutdown`));
}

async function gracefulShutdown() {
  try {
    log('Graceful shutdown: saving cookies and closing browser...');
    if (context) await saveCookies(context);
    if (browser) await browser.close();
    if (server) server.close();
  } catch (e) { log('Error during shutdown:', e?.message ?? e); }
  finally { process.exit(0); }
}

let sigintCount = 0;
process.on('SIGINT', async () => {
  sigintCount += 1; log('SIGINT received - count', sigintCount);
  try { if (context) await saveCookies(context); } catch (_) {}
  if (sigintCount >= 2) await gracefulShutdown(); else log('Press Ctrl-C again to exit');
});

process.on('uncaughtException', (err) => { log('uncaughtException:', err?.message ?? err); });
process.on('unhandledRejection', (r) => { log('unhandledRejection:', r); });

(async () => {
  try { await startBrowser(); await startServer(); setInterval(() => { if (context) saveCookies(context); }, 5000); }
  catch (e) { log('Fatal error starting control:', e?.message ?? e); }
})();
