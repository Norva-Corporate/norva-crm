import "server-only";

import puppeteer, { type Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";

// Pinned to @sparticuz/chromium@148 dans package.json.
const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.x64.tar";

export async function launchBrowser(logTag = "pdf"): Promise<Browser> {
  const local = process.env.LOCAL_CHROMIUM_PATH;
  if (local) {
    console.log(`[${logTag}] launching local chromium:`, local);
    return puppeteer.launch({
      executablePath: local,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  console.log(
    `[${logTag}] resolving @sparticuz/chromium from:`,
    CHROMIUM_PACK_URL
  );
  const execPath = await chromium.executablePath(CHROMIUM_PACK_URL);
  console.log(`[${logTag}] chromium ready at:`, execPath);
  return puppeteer.launch({
    args: chromium.args,
    executablePath: execPath,
    headless: true,
  });
}

export async function htmlToPdfBuffer(
  html: string,
  logTag = "pdf"
): Promise<Buffer> {
  console.log(`[${logTag}] html built, length:`, html.length);
  const browser = await launchBrowser(logTag);
  console.log(`[${logTag}] browser launched`);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    console.log(`[${logTag}] content set`);
    await page.evaluate(() => document.fonts.ready);
    console.log(`[${logTag}] fonts ready`);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    console.log(`[${logTag}] pdf rendered, bytes:`, pdf.length);
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
