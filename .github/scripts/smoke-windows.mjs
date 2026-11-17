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
const browser = await puppeteer.launch({ headless: true, pipe: true, enableExtensions: true });

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
const adSelector = '#sponsored article';
try {
  const id = await browser.installExtension(extension);
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
  await page.waitForSelector('#sponsored[data-clearfeed-hidden="post"]');
  await page.waitForSelector(adSelector, { hidden: true });
  await page.waitForSelector('#organic article', { visible: true });

  const menu = await browser.newPage();
  await menu.goto(`chrome-extension://${id}/popup.html`, { waitUntil: 'load' });
  await menu.waitForFunction(() => document.querySelector('#all-time').textContent.trim() === '1');
  await menu.waitForSelector('#enabled:checked:enabled');
  await menu.click('#enabled');
  await page.waitForSelector(adSelector, { visible: true });
  await menu.click('#enabled');
  await page.waitForSelector(adSelector, { hidden: true });

  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#sponsored[data-clearfeed-hidden="post"]');
  await page.waitForSelector('#organic article', { visible: true });
  await menu.waitForFunction(() => document.querySelector('#all-time').textContent.trim() === '2');
  console.log(`Clearfeed ${manifest.version} passed in ${await browser.version()} on Windows ${process.arch}.`);
} finally {
  await browser.close();
}
