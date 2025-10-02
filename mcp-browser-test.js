#!/usr/bin/env node

// mcp-browser-test.js
// Testet das MCP-Proxy in einem Browser indem es die Tools openPage und getText aufrruft
// und die Ergebnisse anzeigt. Verwendet den SSE-Endpoint zum Empfangen von Nachrichten.
// Benötigt Node.js 18+
// Usage: node mcp-browser-test.js
// Voraussetzung: MCP Proxy läuft und ist über http://localhost:3006 erreichbar

import fetch from "node-fetch";
import { EventSource } from "eventsource";


// === Konfiguration ===
const SSE_URL = "http://localhost:3006/sse";
const MESSAGE_URL = "http://localhost:3006/message";

// === Hilfsfunktion: Session-ID aus SSE holen ===
async function getSessionId() {
  return new Promise((resolve, reject) => {
    console.log(`Verbinde zu ${SSE_URL}...`);
    const es = new EventSource(SSE_URL);
    let sessionId = null;
    
    // Timeout nach 30 Sekunden
    const timeout = setTimeout(() => {
      es.close();
      reject(new Error("Timeout beim Warten auf Session-ID. Läuft der MCP Proxy?"));
    }, 30000);
    
    es.onopen = () => {
      console.log("SSE Verbindung hergestellt!");
    };
    
    es.onerror = (err) => {
      console.error("SSE Verbindungsfehler:", err?.message || err);
    };
    
    // The proxy sends a named SSE event 'endpoint' with the message path
    es.addEventListener('endpoint', async (evt) => {
      console.log("SSE 'endpoint' event empfangen:", evt.data);
      // evt.data is like: "/message?sessionId=0033f9f8-..."
      if (!sessionId && typeof evt.data === 'string') {
        const match = evt.data.match(/sessionId=([a-f0-9-]+)/i);
        if (match) {
          sessionId = match[1];
          console.log("Session-ID erhalten, sende Initialisierungsanfrage...");

          // Register a listener for initialize result (id 0)
          const initPromise = new Promise((res, rej) => {
            const onMsg = (evt) => {
              try {
                const data = JSON.parse(evt.data || "{}");
                if (data.id === 0) {
                  es.removeEventListener('message', onMsg);
                  res(data);
                }
              } catch (err) {
                // ignore parse errors for unrelated messages
              }
            };
            es.addEventListener('message', onMsg);
            // safety: reject if timeout elapses
            const t = setTimeout(() => {
              es.removeEventListener('message', onMsg);
              rej(new Error('Timeout beim Warten auf initialize-Result via SSE'));
            }, 15000);
          });

          // Send initialize, but don't await the HTTP response; result arrives via SSE
          fetch(`${MESSAGE_URL}?sessionId=${sessionId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 0,
              method: "initialize",
              params: {
                protocolVersion: "2025-06-18",
                capabilities: {},
                clientInfo: {
                  name: "mcp-browser-test",
                  version: "1.0.0"
                }
              }
            })
          }).catch((e) => {
            console.warn("Fehler beim Senden der Initialisierungsanfrage (HTTP):", e?.message || e);
          });

          const initResult = await initPromise.catch(() => null);
          console.log("Initialisierungsantwort (via SSE):", JSON.stringify(initResult, null, 2));

          if (initResult && initResult.result) {
            clearTimeout(timeout);
            // Resolve with both sessionId and the EventSource so callers can listen on SSE
            resolve({ sessionId, es });
          } else {
            es.close();
            reject(new Error(`Initialisierung fehlgeschlagen: ${JSON.stringify(initResult)}`));
          }
        }
      }
    });

    // fallback: generic message handler (for other events)
    es.onmessage = (event) => {
      console.log("SSE Nachricht empfangen (message):", event.data);
    };
    
    es.onerror = (err) => {
      clearTimeout(timeout);
      es.close();
      reject(new Error(`SSE Fehler: ${err?.message || "Unbekannter Fehler"}`));
    };
  });
}

// === Hilfsfunktion: Tool-Aufruf via POST ===
async function callTool(sessionId, toolName, args = {}) {
  const payload = {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "callTool",
    params: { name: toolName, arguments: args }
  };
  // Send the request
  const res = await fetch(`${MESSAGE_URL}?sessionId=${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch((e) => {
    throw new Error(`HTTP request failed: ${e?.message || e}`);
  });

  // If the proxy responds directly with an error (non-200), capture and throw
  if (!res.ok) {
    const text = await res.text();
    console.error("callTool: Non-OK HTTP response:", res.status, res.statusText);
    console.error("callTool: Body:", text.slice(0, 2000));
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0,200)}`);
  }

  // The proxy usually delivers the actual tool result over SSE for the session.
  // The caller should have kept the EventSource open and can listen for messages.
  // Here we return the payload id so the caller can correlate SSE messages.
  return { jsonrpc: "2.0", id: payload.id, pending: true };
}

// === Hauptfunktion ===
async function main() {
  console.log("1️⃣ Hole Session-ID vom SSE-Endpoint...");
  const { sessionId, es } = await getSessionId();
  console.log("✅ Session-ID:", sessionId);

  // === openPage ===
  console.log("2️⃣ Liste verfügbare Tools und rufe openPage über proxy an...");
  // helper: wait for SSE message with matching id
  function waitForSseResponse(id, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const onMsg = (evt) => {
        try {
          const data = JSON.parse(evt.data || "{}");
          if (data.id === id) {
            es.removeEventListener('message', onMsg);
            clearTimeout(t);
            resolve(data);
          }
        } catch (err) {
          // ignore
        }
      };
      es.addEventListener('message', onMsg);
      const t = setTimeout(() => {
        es.removeEventListener('message', onMsg);
        reject(new Error('Timeout waiting for SSE response'));
      }, timeoutMs);
    });
  }

  // helper: send POST and wait for SSE response with same id
  async function postAndWait(method, params = {}) {
    const id = Date.now();
    const payload = { jsonrpc: '2.0', id, method, params };
    await fetch(`${MESSAGE_URL}?sessionId=${sessionId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return waitForSseResponse(id);
  }

  // 1) get list of tools from proxy
  const toolsRes = await postAndWait('tools/list');
  console.log('tools/list result:', JSON.stringify(toolsRes, null, 2));
  const tools = (toolsRes.result && Array.isArray(toolsRes.result.tools)) ? toolsRes.result.tools : [];
  if (!tools.length) {
    console.error('Keine Tools vom Proxy erhalten. Proxy antwortet mit empty capabilities.');
    try { es.close(); } catch (e) {}
    process.exit(1);
  }

  // find the browser.openPage tool (or fallback to any openPage)
  let toolName = tools.find(t => t.name && t.name.endsWith('.openPage'))?.name;
  if (!toolName) toolName = tools.find(t => t.name && t.name.endsWith('openPage'))?.name || tools[0].name;

  console.log('Aufruf des Tools:', toolName);
  const openRes = await postAndWait('tools/call', { name: toolName, arguments: { url: 'https://example.com' } });
  console.log('openPage Antwort:', JSON.stringify(openRes, null, 2));

  if (openRes.error && typeof openRes.error.message === 'string' && openRes.error.message.includes('Method not found')) {
    console.log('RPC method appears unsupported. Probing alternative method names...');
    await probeRpcMethods();
    // After probing, bail out to avoid repeated errors
    try { es.close(); } catch (e) {}
    process.exit(1);
  }

  // If callTool fails because the method name is unknown, probe alternative RPC method names.
  async function probeRpcMethods() {
    const candidates = [
      { method: 'callTool', buildParams: (name, args) => ({ name, arguments: args }) },
      { method: 'call', buildParams: (name, args) => ({ name, args }) },
      { method: 'tool.call', buildParams: (name, args) => ({ name, args }) },
      { method: 'invokeTool', buildParams: (name, args) => ({ name, args }) },
      // Some proxies expose each tool as a direct method name
      { method: 'openPage', buildParams: (name, args) => ({ url: args.url }) },
      { method: 'getText', buildParams: (name, args) => ({}) },
      { method: 'getContent', buildParams: (name, args) => ({}) }
    ];
    for (const c of candidates) {
      const id = Date.now();
      const payload = { jsonrpc: '2.0', id, method: c.method, params: c.buildParams('openPage', { url: 'https://example.com' }) };
      try {
        const res = await fetch(`${MESSAGE_URL}?sessionId=${sessionId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const text = await res.text();
        console.log(`Probe ${c.method}: HTTP ${res.status} ${res.statusText} ->`, text.slice(0,400));
      } catch (e) {
        console.warn('Probe error for', c.method, e?.message || e);
      }
    }
  }

  // === getText ===
  try {
    console.log("3️⃣ Hole Text der Seite...");
    // find the browser.getText tool name (from tools list we already fetched)
    let getTextTool = tools.find(t => t.name && t.name.endsWith('.getText'))?.name;
    if (!getTextTool) getTextTool = tools.find(t => t.name && t.name.endsWith('getText'))?.name || tools[0].name;
  const textRes = await postAndWait('tools/call', { name: getTextTool, arguments: {} });
    if (textRes.result?.content) {
      console.log("Seiteninhalt (Text):\n", textRes.result.content[0].text.slice(0, 500), "…");
    } else {
      console.log("Keine Textdaten erhalten:", textRes);
    }
  } finally {
    // Clean up: close the EventSource
    try { es.close(); } catch (e) { }
  }
}

main().catch(console.error);
