import { chromium } from "playwright";
import fs from "fs";

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://feg-eschweiler.church.tools/");
  console.log("Bitte im Browserfenster manuell anmelden und dann Enter drücken...");
  
  process.stdin.once("data", async () => {
    const cookies = await context.cookies();
    fs.writeFileSync("cookies.json", JSON.stringify(cookies, null, 2));
    console.log("Cookies in cookies.json gespeichert.");
    await browser.close();
    process.exit(0);
  });
})();
