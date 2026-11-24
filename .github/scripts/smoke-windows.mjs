import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

assert.ok(['win32', 'darwin'].includes(process.platform));
const testRoot = process.env.CLEARFEED_TEST_ROOT;
const requireTools = createRequire(path.join(process.env.CLEARFEED_TEST_TOOLS, 'package.json'));
const { default: puppeteer } = await import(pathToFileURL(requireTools.resolve('puppeteer')).href);
const extension = path.join(testRoot, 'Clearfeed Extension');
const manifest = JSON.parse(await readFile(path.join(extension, 'manifest.json'), 'utf8'));
const launchOptions = { headless: true, pipe: true, enableExtensions: true, protocolTimeout: 20000, userDataDir: path.join(testRoot, 'test-browser-profile') };
let browser = await puppeteer.launch(launchOptions);

const home = 'https://x.com/home';
const feed = `<!doctype html><html><body>
  <div id="organic" data-testid="cellInnerDiv">
    <article data-testid="tweet"><div data-testid="User-Name"><a href="/nikki">Nikki</a></div><p data-testid="tweetText">Building with Chrome extensions</p></article>
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
    if (request.isNavigationRequest() && request.url().startsWith('https://x.com/')) {
      await request.respond({ status: 200, contentType: 'text/html', body: new URL(request.url()).pathname === '/tester' ? '<div data-testid="UserName">Tester</div>' : feed });
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
  await menu.click('#tab-favorites');
  await menu.select('#favorite-kind', 'people');
  await menu.type('#favorite-input', '@nikki');
  await menu.click('#favorite-form button');
  await page.bringToFront();
  await page.waitForFunction(() => document.querySelector('#organic').hasAttribute('data-clearfeed-favorite'), poll);
  await menu.bringToFront();
  await menu.select('#favorite-kind', 'topics');
  await menu.type('#favorite-input', 'Chrome extensions');
  await menu.click('#favorite-form button');
  await menu.waitForFunction(() => document.querySelector('#favorite-topics').textContent.includes('Chrome extensions'), poll);
  await menu.click('#favorite-only');
  await page.bringToFront();
  await page.waitForFunction(() => document.querySelector('#sponsored').hasAttribute('data-clearfeed-unmatched'), poll);
  await menu.bringToFront();
  await menu.reload();
  await menu.click('#tab-favorites');
  await menu.waitForFunction(() => document.querySelector('#favorite-only').checked && document.querySelector('#favorite-people').textContent.includes('@nikki'), poll);
  await menu.click('#favorite-people button');
  await page.bringToFront();
  await page.waitForFunction(() => document.querySelector('#organic').hasAttribute('data-clearfeed-favorite'), poll);
  await menu.bringToFront();
  await menu.click('#favorite-topics button');
  await page.bringToFront();
  await page.waitForFunction(() => !document.querySelector('#organic').hasAttribute('data-clearfeed-favorite') && !document.querySelector('#organic').hasAttribute('data-clearfeed-unmatched'), poll);
  await page.goto('https://x.com/tester', { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#clearfeed-save-person'), poll);
  await page.evaluate(() => document.querySelector('#clearfeed-save-person').click());
  await menu.bringToFront();
  await menu.waitForFunction(() => document.querySelector('#favorite-people').textContent.includes('@tester'), poll);
  await menu.type('#favorite-search', 'doesnotmatch');
  await menu.waitForFunction(() => document.querySelector('#favorite-people').textContent.includes('No matching favorites'), poll);
  const opened = browser.waitForTarget(target => target.url().startsWith('https://x.com/search?'));
  await menu.click('#favorite-open');
  const target = await opened;
  assert.equal(new URL(target.url()).searchParams.get('q'), '(from:tester)');
  console.log('Profile favorite button, favorites feed link and menu search passed.');
  await browser.close();
  browser = await puppeteer.launch(launchOptions);
  const restored = await browser.newPage();
  await restored.goto(`chrome-extension://${id}/popup.html`);
  await checkCount(restored, '2');
  await restored.click('#tab-favorites');
  await restored.waitForFunction(() => document.querySelector('#favorite-people').textContent.includes('@tester') && document.querySelector('#favorite-only').checked, poll);
  console.log('Favorites, preferences and all-time count survived a full Chrome restart.');
  console.log('Favorites saving, topic matching, filtering, removal and menu reload passed.');
  console.log(`Clearfeed ${manifest.version} passed in ${await browser.version()} on ${process.platform} ${process.arch}.`);
} finally {
  await browser.close();
}
