@echo off
echo Starting server-browser in a new window...
start "Server Browser" cmd /k "node server-browser.js"

echo Starting MCP Super Assistant Proxy in a new window...
start "MCP Proxy" cmd /k "npx @srbhptl39/mcp-superassistant-proxy@latest --config D:\Users\User\git\mcp\config.json"

echo Both services have been started in separate windows.