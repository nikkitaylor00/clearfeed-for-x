'use strict';

importScripts('settings.js');

const MAX_RECENT_DOCUMENTS = 256;
let activityWrites = Promise.resolve();

async function saveActivity(documentId, count, savedCount) {
  const stored = await chrome.storage.local.get(CLEARFEED_ACTIVITY_KEY);
  const { total = 0, recent = [] } = stored[CLEARFEED_ACTIVITY_KEY] ?? {};
  const reports = new Map(recent);
  const previous = Math.max(reports.get(documentId) ?? 0, savedCount);
  if (count <= previous) return;

  // Commit the count and its deduplication record together, before acknowledging it.
  reports.delete(documentId);
  reports.set(documentId, count);
  await chrome.storage.local.set({
    [CLEARFEED_ACTIVITY_KEY]: {
      total: total + (count - previous),
      recent: [...reports].slice(-MAX_RECENT_DOCUMENTS)
    }
  });
}

function setBadge(tabId, count) {
  return chrome.action.setBadgeText({ tabId, text: count > 999 ? '999+' : count ? String(count) : '' })
    .catch(() => {}); // The tab may have been closed while the message was in flight.
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  chrome.action.setBadgeBackgroundColor({ color: '#5840d4' }).catch(() => {});
  chrome.action.setBadgeTextColor({ color: '#ffffff' }).catch(() => {});
  if (reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.kind !== 'clearfeed:activity' || sender.id !== chrome.runtime.id || sender.frameId !== 0 ||
      !Number.isInteger(sender.tab?.id) || !ClearfeedSettings.isX(sender.url) || !sender.documentId) return;

  const { count, badgeCount, savedCount } = message;
  if (!Number.isSafeInteger(count) || count < 0 ||
      !Number.isSafeInteger(badgeCount) || badgeCount < 0 || badgeCount > count ||
      !Number.isSafeInteger(savedCount) || savedCount < 0 || savedCount > count) return;

  const badge = setBadge(sender.tab.id, badgeCount);
  if (count === savedCount) {
    badge.then(() => reply({ ok: true }));
    return true;
  }

  // Reports from different tabs must not read and overwrite the same total.
  const write = activityWrites.then(() => saveActivity(sender.documentId, count, savedCount));
  activityWrites = write.catch(() => {});
  Promise.all([badge, write]).then(
    () => reply({ ok: true }),
    () => reply({ ok: false })
  );
  return true;
});

// Tab-specific badge values survive navigation unless reset.
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === 'loading') setBadge(tabId, 0);
});
