'use strict';

(() => {
  const POST = 'article[data-testid="tweet"]';
  const TREND = '[data-testid="trend"]';
  const SUGGESTION = '[data-testid="sidebarColumn"] aside[aria-label]';
  const UNITS = [POST, TREND, SUGGESTION].join(',');
  const PLACEMENT = '[data-testid="placementTracking"]';
  const HIDDEN = 'data-clearfeed-hidden';
  const labels = new Set([
    'ad', 'ads', 'advertisement', 'promoted', 'sponsored', 'werbung', 'gesponsert', 'anzeige',
    'publicité', 'sponsorisé', 'annonce', 'anuncio', 'promocionado', 'patrocinado',
    'publicidade', 'pubblicità', 'sponsorizzato', 'reklam', 'reklama', '広告',
    '프로모션', '광고', '广告', '廣告', 'إعلان'
  ]);
  const suggestionLabels = new Set(['who to follow', 'you might like', 'suggested accounts']);
  const normalize = value => (value ?? '').normalize('NFKC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/gu, '').trim().toLowerCase();

  let prefs = ClearfeedSettings.defaults;
  let observing = false;
  let retired = false;
  let queued = false;
  let count = 0;
  let savedCount = 0;
  let lastReport;
  let retry;
  const dirty = new Set();
  const hidden = new Map();
  const countedIds = new Set();
  const countedNodes = new WeakMap();

  const hasLabel = (element, options = labels) =>
    options.has(normalize(element.textContent)) || options.has(normalize(element.getAttribute('aria-label')));

  function statusId(post) {
    if (!post) return null;
    const header = post.querySelector('[data-testid="User-Name"]');
    const dateLink = header?.querySelector('a:has(time)');
    const analytics = post.querySelector('a[href*="/status/"][href$="/analytics"]');
    const url = (dateLink || analytics)?.getAttribute('href');
    return url?.match(/\/status\/(\d+)(?:[/?#]|$)/u)?.[1] ?? null;
  }

  function promoted(post, cell) {
    // The marker wraps the article on today's X; allow an explicit child marker
    // too, but ignore placements nested inside a quote, card or post body.
    const placement = post.closest(PLACEMENT);
    if (placement && (!cell || cell.contains(placement))) return true;
    for (const marker of post.querySelectorAll(PLACEMENT)) {
      if (marker.closest(POST) === post && !marker.closest('[data-testid="tweetText"], [data-testid="card.wrapper"], [role="link"]')) return true;
    }

    // X renders the "Ad" label in the same header action group as the More
    // button. Stop before reaching the author or body: "Ad" can be post text.
    const menu = post.querySelector('[data-testid="caret"]');
    for (let group = menu?.parentElement, depth = 0; group && group !== post && depth < 4; group = group.parentElement, depth++) {
      if (group.querySelector('[data-testid="User-Name"], [data-testid="tweetText"]')) break;
      for (const candidate of group.querySelectorAll('span, [aria-label]')) {
        if (candidate.closest('a, button, [role="button"], [role="link"]') || candidate.closest(POST) !== post) continue;
        if (hasLabel(candidate)) return true;
      }
    }
    return false;
  }

  const trendLabels = new Set([...labels].filter(label => label !== 'ad' && label !== 'ads'));

  function promotedTrend(trend) {
    if (trend.closest(PLACEMENT) || trend.querySelector(PLACEMENT)) return true;
    // X uses a separate disclosure line after the trend name. The word
    // "Promoted" in the trend title itself isn't a disclosure.
    const parts = [...trend.querySelectorAll('span, [aria-label]')].filter(element =>
      !element.children.length && normalize(element.textContent || element.getAttribute('aria-label')) &&
      !element.closest('button, [role="button"]'));
    return parts.length > 1 && hasLabel(parts.at(-1), trendLabels);
  }

  function classify(unit) {
    if (unit.matches(POST)) {
      const cell = unit.closest('[data-testid="cellInnerDiv"]');
      if (promoted(unit, cell)) {
        const target = cell && cell.querySelectorAll(POST).length === 1 ? cell : unit;
        return { kind: 'post', target };
      }
    } else if (prefs.trends && unit.matches(TREND) && promotedTrend(unit)) {
      return { kind: 'trend', target: unit };
    } else if (prefs.suggestions && unit.matches(SUGGESTION) && suggestionLabels.has(normalize(unit.getAttribute('aria-label')))) {
      return { kind: 'suggestion', target: unit };
    }
    return null;
  }

  function show(unit, record) {
    record.target.removeAttribute(HIDDEN);
    hidden.delete(unit);
  }

  function hide(unit, next) {
    next.target.setAttribute(HIDDEN, next.kind);
    hidden.set(unit, next);
    if (next.kind === 'suggestion') return;
    const id = next.kind === 'post' ? statusId(unit) : null;
    if (id) {
      const alreadyCounted = countedIds.has(id) || countedNodes.get(unit) === null;
      countedIds.add(id);
      countedNodes.set(unit, id);
      if (alreadyCounted) return;
    } else {
      if (countedNodes.has(unit)) return;
      countedNodes.set(unit, null);
    }
    count++;
  }

  function stopFiltering() {
    observer.disconnect();
    observing = false;
    dirty.clear();
    for (const [unit, record] of hidden) show(unit, record);
  }

  function retire() {
    // An open X tab can still run this script after Chrome reloads the extension.
    retired = true;
    stopFiltering();
    clearTimeout(retry);
    retry = undefined;
    window.removeEventListener('pageshow', onPageShow);
  }

  function isInvalidated(error) {
    return error?.message === 'Extension context invalidated.';
  }

  function currentRuntime() {
    if (retired) return;
    try {
      const runtime = chrome.runtime;
      if (runtime?.id) return runtime;
    } catch (error) {
      if (!isInvalidated(error)) throw error;
    }
    retire();
  }

  async function report(force = false) {
    const badgeCount = prefs.enabled && prefs.badge ? count : 0;
    const key = badgeCount + ':' + count;
    if (!force && key === lastReport) return;
    const runtime = currentRuntime();
    if (!runtime) return;

    lastReport = key;
    const reportedCount = count;
    try {
      const response = await runtime.sendMessage({
        kind: 'clearfeed:activity', count: reportedCount, badgeCount, savedCount
      });
      if (response?.ok) {
        savedCount = Math.max(savedCount, reportedCount);
        if (savedCount === count) {
          clearTimeout(retry);
          retry = undefined;
        }
        return;
      }
    } catch (error) {
      if (isInvalidated(error)) {
        retire();
        return;
      }
      // The worker can be interrupted before sending its acknowledgment.
    }
    if (savedCount < count && !retry && currentRuntime()) {
      retry = setTimeout(() => {
        retry = undefined;
        report(true);
      }, 1000);
    }
  }

  function flush() {
    queued = false;
    if (!observing || !currentRuntime()) return;
    for (const [unit, record] of hidden) {
      if (!unit.isConnected) show(unit, record);
    }
    for (const unit of dirty) {
      if (!unit.isConnected) continue;
      const prior = hidden.get(unit);
      const next = classify(unit);
      if (prior && (!next || prior.target !== next.target || prior.kind !== next.kind)) show(unit, prior);
      // Reapply if React replaces the row attributes or reuses a row for another ad.
      if (next) hide(unit, next);
    }
    dirty.clear();
    report();
  }

  function collect(node, descendants = false) {
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!element) return;
    const parent = element.closest(UNITS);
    if (parent) dirty.add(parent);
    if (descendants) element.querySelectorAll(UNITS).forEach(unit => dirty.add(unit));
  }

  function queue() {
    if (!queued) {
      queued = true;
      queueMicrotask(flush);
    }
  }

  const observer = new MutationObserver(records => {
    for (const record of records) {
      collect(record.target, record.type === 'attributes');
      if (record.type === 'attributes' && hidden.has(record.target)) dirty.add(record.target);
      for (const node of record.addedNodes) collect(node, true);
    }
    if (dirty.size || hidden.size) queue();
  });

  function updateSettings(next) {
    if (!currentRuntime()) return;
    const rescan = !observing || prefs.trends !== next.trends || prefs.suggestions !== next.suggestions;
    prefs = next;
    if (!prefs.enabled) {
      stopFiltering();
    } else if (rescan) {
      if (!observing) {
        observing = true;
        observer.observe(document, {
          childList: true, subtree: true, characterData: true, attributes: true,
          attributeFilter: ['data-testid', 'aria-label']
        });
      }
      hidden.forEach((_record, unit) => dirty.add(unit));
      document.querySelectorAll(UNITS).forEach(unit => dirty.add(unit));
      if (dirty.size) flush();
    }
    report();
  }

  function onPageShow(event) {
    if (event.persisted) report(true);
  }

  const runtime = currentRuntime();
  if (!runtime) return;
  try {
    const extensionId = runtime.id;
    runtime.onMessage.addListener((message, sender, reply) => {
      if (!retired && sender.id === extensionId && message?.kind === 'clearfeed:status') reply({ count });
    });
    window.addEventListener('pageshow', onPageShow);
    ClearfeedSettings.watch(updateSettings, error => {
      if (isInvalidated(error)) retire();
    });
  } catch (error) {
    if (!isInvalidated(error)) throw error;
    retire();
  }
})();
