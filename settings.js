'use strict';

const CLEARFEED_ACTIVITY_KEY = 'clearfeedActivity';

const ClearfeedSettings = Object.freeze({
  defaults: Object.freeze({ enabled: true, trends: true, suggestions: false, badge: true, theme: 'system' }),

  isX(url) {
    try {
      const { hostname, protocol } = new URL(url);
      return protocol === 'https:' && (hostname === 'x.com' || hostname === 'www.x.com');
    } catch {
      return false;
    }
  },

  // Subscribe first so saving a setting while a new tab starts never loses an update.
  watch(onChange, onError, defaults = this.defaults) {
    const pending = {};
    let values;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const patch = {};
      for (const [key, change] of Object.entries(changes)) {
        if (Object.hasOwn(defaults, key)) patch[key] = change.newValue ?? defaults[key];
      }
      if (!Object.keys(patch).length) return;
      if (!values) Object.assign(pending, patch);
      else {
        Object.assign(values, patch);
        onChange({ ...values });
      }
    });
    return chrome.storage.local.get(defaults).then(stored => {
      values = { ...stored, ...pending };
      onChange({ ...values });
    }).catch(onError);
  }
});
