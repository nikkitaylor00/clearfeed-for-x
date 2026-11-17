import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

assert.equal(process.platform, 'win32');
const testRoot = process.env.CLEARFEED_TEST_ROOT;
const requireTools = createRequire(path.join(process.env.CLEARFEED_TEST_TOOLS, 'package.json'));
const { default: puppeteer } = await import(pathToFileURL(requireTools.resolve('puppeteer')).href);
const extension = path.join(testRoot, 'Clearfeed Extension');
const manifest = JSON.parse(await readFile(path.join(extension, 'manifest.json'), 'utf8'));
const browser = await puppeteer.launch({ headless: true, pipe: true, enableExtensions: true, protocolTimeout: 20000 });

const home = 'https://x.com/home';
const feed = `<!doctype html><html><body>
  <div id="organic" data-testid="cellInnerDiv">
    <article data-testid="tweet"><p>Regular post</p></article>
  </div>
  <div id="sponsored" data-testid="cellInnerDiv">
    <div data-testid="placementTracking">
      <article data-testid="tweet"><a href="/brand/status/123/analytics">Promoted post</a></article>
    </div>
  </div>
</body></html>`;
const poll = { polling: 100, timeout: 10000 };
async function checkFeed(page, blocksAds) {
  await page.waitForFunction(shouldBlock => {
    const organic = document.querySelector('#organic article');
    const sponsored = document.querySelector('#sponsored');
    const ad = sponsored?.querySelector('article');
    return organic?.getClientRects().length > 0 && ad &&
      (ad.getClientRects().length === 0) === shouldBlock &&
      (sponsored.dataset.clearfeedHidden === 'post') === shouldBlock;
  }, poll, blocksAds);
}
async function checkCount(menu, count) {
  await menu.waitForFunction(expected => document.querySelector('#all-time')?.value === expected, poll, count);
}
async function setBlocking(menu, enabled) {
  await menu.bringToFront();
  await menu.waitForFunction(() => document.querySelector('#enabled:enabled'), poll);
  await menu.evaluate(expected => {
    const toggle = document.querySelector('#enabled');
    if (toggle.checked !== expected) toggle.click();
  }, enabled);
}
try {
  const id = await browser.installExtension(extension);
  console.log('Loaded the extension from the extracted ZIP.');
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', async request => {
    if (request.isNavigationRequest() && request.url() === home) {
      await request.respond({ status: 200, contentType: 'text/html', body: feed });
    } else {
      await request.abort();
    }
  });
  await page.goto(home, { waitUntil: 'load' });
  await checkFeed(page, true);
  console.log('Promoted post hidden; regular post still visible.');

  const menu = await browser.newPage();
  await menu.goto(`chrome-extension://${id}/popup.html`, { waitUntil: 'load' });
  await checkCount(menu, '1');
  await setBlocking(menu, false);
  await page.bringToFront();
  await checkFeed(page, false);
  await setBlocking(menu, true);
  await page.bringToFront();
  await checkFeed(page, true);
  console.log('The menu can pause and resume blocking.');

  await page.reload({ waitUntil: 'load' });
  await checkFeed(page, true);
  await menu.bringToFront();
  await checkCount(menu, '2');
  console.log(`Clearfeed ${manifest.version} passed in ${await browser.version()} on Windows ${process.arch}.`);
} finally {
  await browser.close();
}
