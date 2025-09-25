#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { chromium } from "playwright";
import fs from "fs";

const server = new McpServer({
  name: "browser-server",
  version: "0.1.0"
});

// global state for browser/page so tools can reuse it
let browser;
let page;

// Lade Cookies aus cookies.json Datei und füge sie im Browser-Kontext hinzu
async function loadCookies(context, cookiePath) {
  try {
    if (fs.existsSync(cookiePath)) {
      const cookiesString = fs.readFileSync(cookiePath, "utf-8");
      const cookies = JSON.parse(cookiesString);
      await context.addCookies(cookies);
      console.log("[Browser MCP] Loaded cookies from", cookiePath);
    } else {
      console.log("[Browser MCP] No cookies file found at", cookiePath);
    }
  } catch (err) {
    console.log("[Browser MCP] Error loading cookies:", err.message);
  }
}

// Speichere aktuelle Cookies in cookies.json Datei
async function saveCookies(context, cookiePath) {
  try {
    const cookies = await context.cookies();
    fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));
    console.log("[Browser MCP] Saved cookies to", cookiePath);
  } catch (err) {
    console.log("[Browser MCP] Failed to save cookies:", err.message);
  }
}

function log(...args) {
  console.log("[Browser MCP]", ...args);
}

// --- Tools ---------------------------------------------------------------
// openPage(url)
server.tool(
  "openPage",
  "Öffnet eine Seite im Browser",
  { url: z.string().min(1).describe("URL to open (http/https or file)") },
  async ({ url }) => {
    log("openPage called:", url);
    if (!browser) {
      log("Launching Playwright Chromium (visible)...");
      browser = await chromium.launch({ headless: false });
    }
    if (!page) {
      const ctx = await browser.newContext();
      await loadCookies(ctx, "./cookies.json");
      page = await ctx.newPage();
    }
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      log("Navigated to", url);
      await saveCookies(page.context(), "./cookies.json");
      return { content: [{ type: "text", text: `Seite geöffnet: ${url}` }] };
    } catch (err) {
      log("openPage error:", err?.message ?? err);
      return { content: [{ type: "text", text: `Fehler beim Laden: ${err?.message ?? err}` }] };
    }
  }
);

// getContent()
server.tool(
  "getContent",
  "Gibt den kompletten HTML-Quelltext der aktuellen Seite zurück",
  {},
  async () => {
    log("getContent called");
    if (!page) return { content: [{ type: "text", text: "Noch keine Seite geladen." }] };
    const html = await page.content();
    log("getContent: length =", html.length);
    return { content: [{ type: "text", text: html }] };
  }
);

// getText()
server.tool(
  "getText",
  "Gibt den reinen Text (innerText) der aktuellen Seite zurück",
  {},
  async () => {
    log("getText called");
    if (!page) return { content: [{ type: "text", text: "Noch keine Seite geladen." }] };
    const text = await page.innerText("body").catch(() => "");
    log("getText: length =", text.length);
    return { content: [{ type: "text", text }] };
  }
);

// ------------------------------------------------------------------------

async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log("Server connected (stdio transport). Waiting for MCP host...");
  } catch (err) {
    console.error("[Browser MCP] Fatal error while connecting:", err);
    process.exit(1);
  }
}

main();

// Cleanup on exit
process.on("SIGINT", async () => {
  log("SIGINT received — shutting down...");
  try { if (browser) await browser.close(); } catch (_) {}
  process.exit(0);
});
