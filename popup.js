'use strict';

(() => {
  const controls = Object.fromEntries(Object.keys(ClearfeedSettings.defaults).map(key => [key, document.getElementById(key)]));
  const status = document.getElementById('status');
  const statusLabel = document.getElementById('status-label');
  const count = document.getElementById('count');
  const allTime = document.getElementById('all-time');
  const heroNote = document.getElementById('hero-note');
  const open = document.getElementById('open-x');
  const error = document.getElementById('error');
  const format = new Intl.NumberFormat();
  let prefs;
  let tab;
  let activity;
  let checking = true;

  function render() {
    if (!prefs) return;
    const onX = ClearfeedSettings.isX(tab?.url);
    const connected = Number.isSafeInteger(activity);
    const state = !prefs.enabled ? 'paused' : checking ? 'ready' : onX ? (connected ? 'active' : 'refresh') : 'ready';
    status.dataset.state = state;
    statusLabel.textContent = { active: 'Active on X', ready: 'Ready', paused: 'Paused', refresh: 'Refresh X' }[state];
    heroNote.textContent = prefs.enabled ? 'Hide promoted posts as you scroll on X.' : 'Ad blocking is paused. Turn it on to clear your feed.';
    count.value = connected ? format.format(activity) : '—';
    count.title = connected ? 'Since this tab loaded' :
      checking ? 'Checking this tab…' : onX ? 'Refresh to connect' : 'Open X to see activity';
    open.firstChild.textContent = onX ? 'Reload X ' : 'Open X ';
    document.documentElement.dataset.theme = prefs.theme;
    for (const [key, control] of Object.entries(controls)) {
      if (key === 'theme') control.value = prefs[key];
      else control.checked = prefs[key];
      control.disabled = false;
    }
  }

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
  }

  ClearfeedSettings.watch(next => {
    prefs = next;
    render();
  }, () => showError('Could not load settings. Try reopening the menu.'));

  ClearfeedSettings.watch(values => {
    allTime.value = format.format(values[CLEARFEED_ACTIVITY_KEY].total);
  }, () => showError('Could not load the all-time count.'), { [CLEARFEED_ACTIVITY_KEY]: { total: 0 } });

  for (const [key, control] of Object.entries(controls)) {
    control.addEventListener('change', async () => {
      error.hidden = true;
      try {
        await chrome.storage.local.set({ [key]: key === 'theme' ? control.value : control.checked });
      } catch {
        render();
        showError('Could not save that change. Please try again.');
      }
    });
  }

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message?.kind === 'clearfeed:activity' && sender.tab?.id === tab?.id && ClearfeedSettings.isX(sender.url) &&
        Number.isSafeInteger(message.count)) {
      activity = message.count;
      render();
    }
  });

  async function connect() {
    try {
      [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (ClearfeedSettings.isX(tab?.url)) {
        const response = await chrome.tabs.sendMessage(tab.id, { kind: 'clearfeed:status' }, { frameId: 0 });
        if (Number.isSafeInteger(response?.count)) activity = Math.max(response.count, activity ?? 0);
      }
    } catch {
      // Pages already open before installation need one refresh.
    } finally {
      checking = false;
      render();
    }
  }

  open.addEventListener('click', async () => {
    try {
      if (ClearfeedSettings.isX(tab?.url)) await chrome.tabs.reload(tab.id);
      else await chrome.tabs.create({ url: 'https://x.com/home' });
      if (window.innerWidth === 358) window.close();
    } catch {
      showError('Could not open X. Please try again.');
    }
  });
  document.getElementById('setup-help').addEventListener('click', async () => {
    try {
      await chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
    } catch {
      showError('Could not open setup help. Please try again.');
    }
  });
  connect();
})();
