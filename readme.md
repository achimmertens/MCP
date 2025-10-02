
# Das Model Context Protocol (MCP)

MCP (Model Context Protocol) ist eine standardisierte Schnittstelle, mit der Sprachmodelle auf externe Datenquellen, Tools und lokale Dateien zugreifen können – kontrolliert, sicher und lokal über einen Proxy.
![alt text](image-11.png)

Mein Ziel ist es, das Chatgpt & Co auf Webseiten zugreifen kann, auf die ich mich eingeloggt habe. Ich möchte z.B., dass ChatGPT die Fehlermeldungen sieht, die ich nur erhalte, wenn ich eingeloggt bin. Oder dass ChatGPT meine Bilanzen eines Berechnungstools sieht und auswertet.

# MCP Server für Browser Einrichten

server-browser.js Datei erstellen, falls nicht vorhanden. Danach:

npm init -y
npm install @modelcontextprotocol/sdk playwright
??? npm install zod
npm install node-fetch eventsource
??? npx playwright install

MCP Server für Browser starten:
node server-browser.js

Add "type": "module" to D:\Users\User\git\mcp\package.json.
  ...
  "main": "mcp-browser-test.js",
  "type": "module",
  "scripts": {
  ...

# Lokalen MCP-Proxy-Server einrichten und starten

Erstelle einen neuen Ordner auf deinem Computer, z.B. auf dem Desktop.

Lege darin eine Datei namens config.json an. Diese enthält die Konfiguration für den MCP-Zugriff.
Die Konfig Datei sieht so aus:
```
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "D:\\Users\\User\\git\\mcp\\brave"
      ]
    },
    "browser": {
      "command": "node",
      "args": [
        "D:\\Users\\User\\git\\mcp"
      ]
    }
  }
}
```

Starte dann den Proxy-Server über die DOS Konsole. Bei den meisten Systemen geht das mit folgendem Befehl (sofern Node.js installiert ist):


> npx @srbhptl39/mcp-superassistant-proxy@latest --config D:\Users\User\git\mcp\config.json

bzw.:
Starten in der Powershell:
PS D:\Users\User\git\mcp> .\startsupermcp.bat



Output:
[mcp-superassistant-proxy] Starting server filesystem: npx -y @modelcontextprotocol/server-filesystem D:/mcp/brave
Secure MCP Filesystem Server running on stdio
Allowed directories: [ 'D:\\mcp\\brave' ]
[mcp-superassistant-proxy] Connected to server: filesystem
[mcp-superassistant-proxy] Server filesystem has 12 tools
[mcp-superassistant-proxy] Successfully initialized server: filesystem
[mcp-superassistant-proxy] Config-to-SSE gateway ready
[mcp-superassistant-proxy] Listening on localhost:3006
[mcp-superassistant-proxy] SSE endpoint: http://localhost:3006/sse
[mcp-superassistant-proxy] POST messages: http://localhost:3006/message



# MCP Server und Proxy testen
Erstellen von mcp-browser-test.js

npm install node-fetch eventsource

$ node mcp-browser-test.js

Das Tool testet das MCP-Proxy in einem Browser, indem es die Tools openPage und getText aufrruft
und die Ergebnisse anzeigt. Es verwendet den SSE-Endpoint zum Empfangen von Nachrichten.
Voraussetzung: MCP Proxy läuft und ist über http://localhost:3006 erreichbar

![alt text](image-15.png)





# MCP im Browser aktivieren
MCP Super Assistant als Erweiterung für Brave installieren
brave://extensions/?id=kngiafgkdnlkgmefdafaibkibegkcaef
![alt text](image-7.png)
![alt text](image-5.png)

# MCP in ChatGPT nutzen

![](image-8.png)
Es wird ein Prompt bei ChatGPT hinzugefügt. Am Ende des Prompts gebe ich meinen eigentlichen Text ein:
![](image-9.png)

Chatgpt greift jetzt über die Browsererweiterung auf meinen Proxy zu, der wiederum das Freigibt, was ich dort erlaubt habe, nämlich den Inhalt von D:\mcp\brave:
![alt text](image-10.png)

Es kann sogar eine Datei erstellen:
![alt text](image-12.png)


# MCP in VSCode aktivieren
Der Github Copilot in VSCode kann von Hause aus auf meine Festplatte zugreifen (er fragt vorher nach). Daher macht MCP in meinen bisherigen Fall keinen Sinn.
Aber es gibt eine Reihe von Tools, die auch MCP fähig sind:

https://code.visualstudio.com/mcp
![alt text](image-13.png)
Ich habe das Modul Playwright installiert, da ich möchte, dass der Copilot auf Webseiten zugreifen soll und diese interpretieren soll.

Um MCP in VSCode zu aktivieren erstellt man eine Datei mit dem Namen .vscode/mcp.json und z.B. folgendem Inhalt:

```
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "D:/mcp/brave"
      ]
    },
    "superassistant": {
      "command": "npx",
      "args": [
        "-y",
        "@srbhptl39/mcp-superassistant-proxy",
        "--config", "D:/mcp/config.json"
      ]
    }
  }
}

```


Damit ist Copilot auch in der Lage, meinen Brave Browser (der ja MCP Superassistant installiert hat) zum Surfen zu benutzen.

![alt text](image-6.png)

Nachtrag: Das geht auch ohne den MCP Proxy. Der Copilot in VSCode kann von Hause aus auf Webseiten lesend zugreifen.

:-/

# So geht es
Ich habe gestartet:
$ node server-browser.js


> npx @srbhptl39/mcp-superassistant-proxy@latest --config D:\Users\User\git\mcp\config.json

bzw.:
Starten in der Powershell:
PS D:\Users\User\git\mcp> .\startsupermcp.bat

Im Microsoft Edge Browser habe ich den MCP Superassistant aktiviert.

Ich habe dann den Inhalt vom MCP Insert als Prompt ausgeführt:
![](image-8.png)
Da drunter habe ich folgenden Prompt eingegeben:
User Interaction Starts here: Ich möchte dass du auf https://feg-eschweiler.church.tools/?q=finance#/budgets/costcenters mit meinem Account zugreifst. Bitte verwende dazu den schon geöffneten Tab im Browser. Bitte beschreibe, was du siehst.
Dann muss ich ihm mit "run" erlauben, das zu tun und mit "insert Text File", den gewonnenen Inhalt bei ChatGPT übergeben.

![alt text](image-14.png)

# Links

https://www.youtube.com/watch?v=S_4VUJ-x8hE
(Autor: c'T 3003)



