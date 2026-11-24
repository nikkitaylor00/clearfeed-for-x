/* Favorites are local preferences, independent of ad-blocking settings. */
'use strict';
(() => {
  const key = 'clearfeedFavorites';
  const empty = { people: [], topics: [], highlight: true, color: '#007aff' };
  let state = { ...empty };
  const palette = { Blue: '#007aff', Teal: '#00897b', Sage: '#66845b', Graphite: '#737780', Amber: '#b87900', Violet: '#8e5bd9' };
  function spotlightColor() {
    return /^#[0-9a-f]{6}$/i.test(state.color) ? state.color : empty.color;
  }
  function applyColor() {
    const color = spotlightColor();
    const rgb = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16)).join(', ');
    document.documentElement.style.setProperty('--clearfeed-spotlight', color);
    document.documentElement.style.setProperty('--clearfeed-spotlight-rgb', rgb);
  }
  const normalize = value => value.normalize('NFKC').trim().toLocaleLowerCase();
  const searchUrl = query => 'https://x.com/search?' + new URLSearchParams({ q: query, f: 'live' });
  function query() {
    return [...state.people.map(person => 'from:' + person), ...state.topics.map(topic => '"' + topic.replaceAll('"', '') + '"')].join(' OR ');
  }
  async function save(patch) {
    const current = (await chrome.storage.local.get(key))[key] || empty;
    await chrome.storage.local.set({ [key]: { ...empty, ...current, ...patch } });
  }
  const menu = location.protocol === 'chrome-extension:';
  let refresh;
  if (menu) {
    const panel = document.getElementById('favorites-panel');
    const controls = [...document.querySelector('.shell').children].filter(node => !node.matches('.masthead, .favorites-tabs, #favorites-panel, footer, #error'));
    for (const name of ['controls', 'favorites']) document.getElementById('tab-' + name).onclick = () => {
      panel.hidden = name !== 'favorites';
      controls.forEach(node => { node.hidden = name !== 'controls'; });
      for (const tab of ['controls', 'favorites']) document.getElementById('tab-' + tab).setAttribute('aria-pressed', String(name === tab));
    };
    const message = document.getElementById('favorite-message');
    const attempt = async operation => {
      try { await operation(); message.textContent = ''; }
      catch { message.textContent = 'Could not save this change. Please try again.'; }
    };
    const colors = document.getElementById('spotlight-colors');
    for (const [name, color] of Object.entries(palette)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', name);
      button.title = name;
      button.dataset.color = color;
      button.style.setProperty('--swatch', color);
      button.onclick = () => attempt(() => save({ color }));
      colors.append(button);
    }
    document.getElementById('spotlight-custom').onchange = event => attempt(() => save({ color: event.target.value }));
    refresh = () => {
      applyColor();
      const color = spotlightColor();
      for (const button of colors.children) button.setAttribute('aria-pressed', String(button.dataset.color === color));
      document.getElementById('spotlight-custom').value = color;
      document.getElementById('spotlight-preview').textContent = (Object.entries(palette).find(([, hex]) => hex === color)?.[0] || 'Custom') + ' spotlight';
      const filter = normalize(document.getElementById('favorite-search').value);
      for (const kind of ['people', 'topics']) {
        const list = document.getElementById('favorite-' + kind);
        list.replaceChildren();
        for (const value of state[kind].filter(value => normalize(value).includes(filter))) {
          const row = document.createElement('li');
          const link = document.createElement('a');
          link.textContent = kind === 'people' ? '@' + value : value;
          link.href = kind === 'people' ? 'https://x.com/' + value : searchUrl('"' + value.replaceAll('"', '') + '"');
          link.target = '_blank'; link.rel = 'noopener';
          const remove = document.createElement('button');
          remove.textContent = 'Remove'; remove.setAttribute('aria-label', 'Remove ' + value);
          remove.onclick = () => attempt(() => save({ [kind]: state[kind].filter(item => item !== value) }));
          row.append(link, remove); list.append(row);
        }
        if (!list.children.length) { const row = document.createElement('li'); row.textContent = 'No matching favorites'; list.append(row); }
      }
      document.getElementById('favorite-highlight').checked = state.highlight;
      document.getElementById('favorite-open').disabled = !query();
    };
    document.getElementById('favorite-search').oninput = refresh;
    document.getElementById('favorite-form').onsubmit = event => {
      event.preventDefault();
      const input = document.getElementById('favorite-input');
      const kind = document.getElementById('favorite-kind').value;
      let value = input.value.normalize('NFKC').trim();
      if (kind === 'people') value = value.replace(/^@/, '').toLowerCase();
      if (!value || (kind === 'people' && !/^[a-z0-9_]{1,15}$/.test(value))) { message.textContent = 'Enter a valid X handle, up to 15 letters, numbers or underscores.'; return; }
      attempt(async () => {
        if (!state[kind].some(item => normalize(item) === normalize(value))) await save({ [kind]: [...state[kind], value] });
        input.value = '';
      });
    };
    for (const [id, preference] of [['favorite-highlight', 'highlight']]) {
      document.getElementById(id).onchange = event => attempt(() => save({ [preference]: event.target.checked }));
    }
    document.getElementById('favorite-open').onclick = () => chrome.tabs.create({ url: searchUrl('(' + query() + ')') });
  } else {
    const reserved = new Set(['home', 'explore', 'search', 'notifications', 'messages', 'settings', 'i', 'compose']);
    let queued = false;
    let observer;
    function scan() {
      queued = false;
      observer.disconnect();
      applyColor();
      // Restore rows marked by older builds without changing X's virtual row heights.
      document.querySelectorAll('[data-clearfeed-unmatched]').forEach(row => row.removeAttribute('data-clearfeed-unmatched'));
      for (const post of document.querySelectorAll('article[data-testid="tweet"]')) {
        const author = post.querySelector('[data-testid="User-Name"] a[href]');
        const handle = author?.getAttribute('href')?.split('/').filter(Boolean)[0]?.toLowerCase();
        const text = normalize(post.querySelector('[data-testid="tweetText"]')?.textContent || '');
        const match = state.people.includes(handle) || state.topics.some(topic => {
          const needle = normalize(topic);
          const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp('(^|[^\\p{L}\\p{N}_])' + escaped + '($|[^\\p{L}\\p{N}_])', 'u').test(text);
        });
        const row = post.closest('[data-testid="cellInnerDiv"]') || post;
        row.toggleAttribute('data-clearfeed-favorite', match && state.highlight);

      }
      const profile = document.querySelector('[data-testid="UserName"]');
      const handle = location.pathname.match(/^\/([a-zA-Z0-9_]{1,15})\/?$/)?.[1]?.toLowerCase();
      let button = document.getElementById('clearfeed-save-person');
      if (profile && handle && !reserved.has(handle)) {
        if (!button) { button = document.createElement('button'); button.id = 'clearfeed-save-person'; profile.after(button); }
        const label = state.people.includes(handle) ? 'Saved in Clearfeed' : 'Add to Clearfeed favorites';
        if (button.textContent !== label) button.textContent = label;
        button.onclick = async () => {
          try {
            const current = (await chrome.storage.local.get(key))[key] || empty;
            const people = current.people.includes(handle) ? current.people.filter(person => person !== handle) : [...current.people, handle];
            await save({ people });
          } catch { button.textContent = 'Refresh X to save favorites'; }
        };
      } else button?.remove();
      observer.observe(document, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href', 'data-testid'] });
    }
    observer = new MutationObserver(() => { if (!queued) { queued = true; setTimeout(scan, 100); } });
    refresh = scan;
    window.addEventListener('popstate', scan);
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[key]) { state = { ...empty, ...changes[key].newValue }; refresh(); }
  });
  chrome.storage.local.get(key).then(values => { state = { ...empty, ...values[key] }; refresh(); }).catch(() => {});
})();
