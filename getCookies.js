import { chromium } from "playwright";
import fs from "fs";

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Hier die URL, wo der Benutzer eingeloggt ist
  await page.goto("https://feg-eschweiler.church.tools/");

  // Warte auf User-Login (oder automatisiere Login hier)
  console.log("Bitte manuell login durchführen, dann Enter drücken...");
  process.stdin.once("data", async () => {
    // Nach Login die Cookies holen und speichern
    const cookies = await context.cookies();
    fs.writeFileSync("cookies.json", JSON.stringify(cookies, null, 2));
    console.log("Cookies gespeichert in cookies.json");
    await browser.close();
    process.exit(0);
  });
})();
