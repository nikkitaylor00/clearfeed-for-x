'use strict';

const checkButton = document.getElementById('check');
const connection = document.getElementById('connection');

checkButton.addEventListener('click', async () => {
  checkButton.disabled = true;
  connection.textContent = 'Checking open X tabs…';
  try {
    const [tabs, settings] = await Promise.all([
      chrome.tabs.query({ currentWindow: true }),
      chrome.storage.local.get(ClearfeedSettings.defaults)
    ]);
    const xTabs = tabs.filter(tab => ClearfeedSettings.isX(tab.url));
    if (!xTabs.length) {
      connection.textContent = 'Open X in this Chrome window, then check again.';
      return;
    }

    const results = await Promise.allSettled(xTabs.map(tab =>
      chrome.tabs.sendMessage(tab.id, { kind: 'clearfeed:status' }, { frameId: 0 })
    ));
    const connected = results.some(result =>
      result.status === 'fulfilled' && Number.isSafeInteger(result.value?.count)
    );
    if (!connected) {
      connection.textContent = 'Refresh your X tab and check that Clearfeed has access to x.com.';
    } else if (settings.enabled) {
      connection.textContent = 'Clearfeed is connected to X and ad blocking is on.';
    } else {
      connection.textContent = 'Clearfeed is connected to X. Turn on Ad blocking in the toolbar menu.';
    }
  } catch {
    connection.textContent = 'Could not check the connection. Open the toolbar menu on X to see its status.';
  } finally {
    checkButton.disabled = false;
  }
});
