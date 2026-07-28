/**
 * Hubly Design System v1 — shared Operate UI building blocks.
 * Vanilla HTML-string helpers. New modules MUST consume these (Rule #14).
 * Do not invent parallel card/drawer/timeline markup when a DS helper exists.
 *
 * Global: window.HublyDS
 */
(function (global) {
  'use strict';

  function esc(v) {
    if (typeof global.escapeHtml === 'function') return global.escapeHtml(v);
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function initials(name) {
    var p = String(name || '?').trim().split(/\s+/).filter(Boolean);
    return !p.length ? '?' : (p.length === 1 ? p[0].slice(0, 2) : (p[0][0] + p[p.length - 1][0])).toUpperCase();
  }

  /** Quick Action / primary control button */
  function actionButton(act, label, cls) {
    return '<button type="button" class="jos-btn ' + esc(cls || 'jos-btn-sm') + '" data-jos-act="' + esc(act) + '">' + esc(label) + '</button>';
  }

  /** Status / membership / stage badge */
  function statusBadge(label, tone) {
    var t = tone || 'info';
    return '<span class="jos-pill ' + esc(t) + '">' + esc(label) + '</span>';
  }

  /** AI / health score ring (0–100) */
  function scoreRing(score, label) {
    var n = Math.max(0, Math.min(100, Number(score) || 0));
    return '<div class="jos-health"><div class="jos-health-ring" style="--jos-pct:' + n + '"><span>' + n + '</span></div>' +
      (label ? '<div><div class="jos-kpi-lbl">' + esc(label) + '</div></div>' : '') + '</div>';
  }

  /** Metric / KPI tile */
  function metricCard(label, value, hint) {
    return '<div class="jos-kpi"><div class="jos-kpi-lbl">' + esc(label) + '</div><div class="jos-kpi-v" style="font-size:16px">' + esc(value) + '</div>' +
      (hint ? '<div class="jos-muted" style="font-size:11px">' + esc(hint) + '</div>' : '') + '</div>';
  }

  /** Section kicker + title */
  function sectionHeader(kicker, title, actionsHtml) {
    return '<div class="jos-between jos-ds-section-h">' +
      '<div>' + (kicker ? '<div class="jos-kicker">' + esc(kicker) + '</div>' : '') +
      (title ? '<h3 style="margin:4px 0 0;font-size:15px;font-weight:800">' + esc(title) + '</h3>' : '') +
      '</div>' + (actionsHtml || '') + '</div>';
  }

  /** Page header block */
  function pageHeader(title, sub, actionsHtml) {
    return '<div class="jos-page-head hub-page-header"><div><h1 class="hub-page-title">' + esc(title) + '</h1>' +
      (sub ? '<p class="hub-page-sub">' + esc(sub) + '</p>' : '') + '</div>' +
      (actionsHtml ? '<div class="jos-page-actions hub-page-actions">' + actionsHtml + '</div>' : '') + '</div>';
  }

  /** Search input */
  function searchBar(id, placeholder, value) {
    return '<label class="jos-ds-search hub-page-search"><input id="' + esc(id) + '" type="search" placeholder="' + esc(placeholder || 'Search…') + '" value="' + esc(value || '') + '"></label>';
  }

  /** Shared page shell — title / actions / optional stats / search / content */
  function pageLayout(opts) {
    opts = opts || {};
    return '<div class="hub-page' + (opts.className ? (' ' + esc(opts.className)) : '') + '">' +
      pageHeader(opts.title || '', opts.sub || '', opts.actionsHtml || '') +
      (opts.statsHtml ? '<div class="hub-stats-row">' + opts.statsHtml + '</div>' : '') +
      (opts.filterHtml ? '<div class="hub-filter-bar">' + opts.filterHtml + '</div>' : '') +
      (opts.searchHtml || '') +
      '<div class="hub-content-area">' + (opts.contentHtml || '') + '</div></div>';
  }

  function pageActions(html) {
    return '<div class="hub-page-actions">' + (html || '') + '</div>';
  }

  function pageSearch(id, placeholder, value) {
    return searchBar(id, placeholder, value);
  }

  function statsRow(cardsHtml) {
    return '<div class="hub-stats-row">' + (cardsHtml || '') + '</div>';
  }

  function filterBar(html) {
    return '<div class="hub-filter-bar">' + (html || '') + '</div>';
  }

  function contentArea(html) {
    return '<div class="hub-content-area">' + (html || '') + '</div>';
  }

  function kpiCard(label, value, trend) {
    return '<div class="hub-kpi-card"><div class="hub-kpi-lbl">' + esc(label) + '</div>' +
      '<div class="hub-kpi-v">' + esc(value) + '</div>' +
      (trend ? '<div class="hub-kpi-trend">' + esc(trend) + '</div>' : '') + '</div>';
  }

  /** Filter drawer shell — bodyHtml is field markup; act prefix e.g. pipe-filter */
  function filterDrawer(opts) {
    opts = opts || {};
    var open = !!opts.open;
    var prefix = opts.actPrefix || 'filter';
    if (!open) return '';
    return '<div class="jos-ds-drawer jos-cust-drawer" id="' + esc(opts.id || 'jos-ds-filter') + '">' +
      '<div class="jos-between"><div class="jos-kicker">' + esc(opts.title || 'Filters') + '</div>' +
      actionButton(prefix + '-close', 'Close', 'jos-btn jos-btn-sm') + '</div>' +
      '<div class="jos-ds-drawer-body jos-mt">' + (opts.bodyHtml || '') + '</div>' +
      '<div class="jos-btn-row jos-mt">' +
      actionButton(prefix + '-apply', 'Apply', 'jos-btn-brand jos-btn-sm') +
      actionButton(prefix + '-reset', 'Reset', 'jos-btn jos-btn-sm') +
      actionButton(prefix + '-save', 'Save Filter', 'jos-btn jos-btn-sm') +
      '</div></div>';
  }

  /** Avatar + name row */
  function profileHeader(opts) {
    opts = opts || {};
    return '<div class="jos-px-person"><div class="jos-px-av">' + esc(opts.initials || initials(opts.name)) + '</div><div>' +
      '<strong class="t">' + esc(opts.name || '—') + (opts.favorite ? ' ★' : '') + '</strong>' +
      (opts.meta ? '<div class="s">' + esc(opts.meta) + '</div>' : '') +
      '</div></div>';
  }

  /** Action toolbar row */
  function actionToolbar(buttonsHtml) {
    return '<div class="jos-btn-row jos-ds-toolbar">' + (buttonsHtml || '') + '</div>';
  }

  /** AI insight card */
  function aiInsightCard(opts) {
    opts = opts || {};
    return '<div class="jos-ai"><div class="sk">' + esc(opts.kicker || 'AI · in-app') + '</div>' +
      (opts.body ? '<p style="font-size:13px;margin-top:6px">' + esc(opts.body) + '</p>' : '') +
      (opts.rowsHtml || '') +
      (opts.actionsHtml ? '<div class="jos-btn-row jos-mt">' + opts.actionsHtml + '</div>' : '') +
      '</div>';
  }

  /** Timeline list — items: { ico, kind, t, s, at } */
  function timeline(items, empty) {
    if (!items || !items.length) return '<div class="jos-empty">' + esc(empty || 'No timeline yet.') + '</div>';
    return '<div class="jos-timeline">' + items.map(function (n) {
      return '<div class="jos-tl-item"><div class="jos-tl-ico ' + esc(n.kind || 'book') + '">' + esc(n.ico || '·') + '</div><div>' +
        '<div class="jos-tl-t">' + esc(n.t || '') + '</div><div class="jos-tl-s">' + esc(n.s || '') +
        (n.at ? ' · ' + esc(String(n.at).slice(0, 16)) : '') + '</div></div></div>';
    }).join('') + '</div>';
  }

  /** Recent activity feed — items: { type, label, at } */
  function activityFeed(items, empty) {
    if (!items || !items.length) return '<div class="jos-muted">' + esc(empty || 'No activity') + '</div>';
    return '<div class="jos-stack">' + items.map(function (a) {
      return '<div class="jos-sched-row"><div class="time">' + esc(String(a.type || '').slice(0, 4)) + '</div><div><div class="who">' +
        esc(a.label || '') + '</div><div class="svc">' + esc(a.at || '') + '</div></div></div>';
    }).join('') + '</div>';
  }

  /** Notes panel */
  function notesPanel(notes, empty) {
    var rows = Array.isArray(notes) ? notes : (notes ? [notes] : []);
    if (!rows.length) return '<div class="jos-muted">' + esc(empty || 'No notes yet.') + '</div>';
    return '<div class="jos-stack">' + rows.map(function (n) {
      return '<div class="jos-note">' + esc(typeof n === 'string' ? n : (n.text || n.label || '')) + '</div>';
    }).join('') + '</div>';
  }

  /** Attachments / files panel */
  function attachmentsPanel(files, empty) {
    if (!files || !files.length) return '<div class="jos-empty">' + esc(empty || 'No attachments.') + '</div>';
    return '<div class="jos-stack">' + files.map(function (f) {
      var name = typeof f === 'string' ? f : (f.name || f.label || 'File');
      var kind = typeof f === 'object' ? (f.kind || '') : '';
      return '<div class="jos-file-row"><strong>' + esc(name) + '</strong>' +
        (kind ? '<div class="jos-muted jos-mt">' + esc(kind) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  }

  /** Empty state */
  function emptyState(title, body, actionsHtml) {
    return '<div class="jos-empty hub-empty">' + (title ? '<h3>' + esc(title) + '</h3>' : '') +
      (body ? '<p>' + esc(body) + '</p>' : '') +
      (actionsHtml ? '<div class="jos-btn-row">' + actionsHtml + '</div>' : '') + '</div>';
  }

  /** Lead card (list / board) */
  function leadCard(opts) {
    opts = opts || {};
    var id = opts.id || '';
    var on = !!opts.selected;
    return '<button type="button" class="jos-list-card jos-ds-lead-card' + (on ? ' on' : '') + '" data-jos-lead-row="' + esc(String(id)) + '"' +
      (opts.pipeId ? ' data-jos-pipe-card="' + esc(String(opts.pipeId)) + '"' : '') + '>' +
      '<div class="jos-between">' + profileHeader({ name: opts.name, meta: opts.meta || opts.phone || opts.email, favorite: opts.favorite }) +
      (opts.score != null ? statusBadge('AI ' + opts.score, 'info') : '') + '</div>' +
      '<div class="meta">' +
      (opts.stageLabel ? statusBadge(opts.stageLabel, opts.stageTone || 'quote') : '') +
      (opts.source ? '<span class="jos-tag">' + esc(opts.source) + '</span>' : '') +
      ((opts.tags || []).slice(0, 3).map(function (t) { return '<span class="jos-tag">' + esc(t) + '</span>'; }).join('')) +
      '</div>' +
      (opts.foot ? '<div class="s jos-ds-card-foot">' + esc(opts.foot) + '</div>' : '') +
      '</button>';
  }

  /** Customer card */
  function customerCard(opts) {
    opts = opts || {};
    return '<button type="button" class="jos-list-card jos-cust-card' + (opts.selected ? ' on' : '') + '" data-jos-cust-row="' + esc(String(opts.id || '')) + '">' +
      '<div class="jos-between">' + profileHeader({ name: opts.name, meta: opts.phone || opts.email, favorite: opts.favorite }) +
      '<div class="jos-cust-card-ltv">' + esc(opts.ltv || '$0') + '</div></div>' +
      '<div class="meta">' +
      (opts.member ? statusBadge(opts.member, 'ok') : '') +
      (opts.vip ? statusBadge('VIP', 'hot') : '') +
      (opts.score != null ? statusBadge('AI ' + opts.score, 'info') : '') +
      ((opts.tags || []).slice(0, 3).map(function (t) { return '<span class="jos-tag">' + esc(t) + '</span>'; }).join('')) +
      '</div>' +
      (opts.foot ? '<div class="s jos-cust-last">' + esc(opts.foot) + '</div>' : '') +
      '</button>';
  }

  /** Job card */
  function jobCard(opts) {
    opts = opts || {};
    var tone = opts.status === 'completed' ? 'won' : (opts.status === 'cancelled' ? 'lost' : (opts.status === 'pending' ? 'quote' : 'booked'));
    return '<div class="jos-card jos-card-tight jos-card-hover jos-ds-job-card' + (opts.selected ? ' on' : '') + '" data-jos-job="' + esc(String(opts.id || '')) + '" role="button" tabindex="0">' +
      '<div class="jos-between"><strong>' + esc(opts.service || 'Job') + '</strong>' + statusBadge(opts.statusLabel || opts.status || '—', tone) + '</div>' +
      '<div class="jos-muted jos-mt">' + esc([opts.when, opts.customer, opts.amount].filter(Boolean).join(' · ')) + '</div></div>';
  }

  /** Pipeline board card (kanban) */
  function pipelineCard(opts) {
    opts = opts || {};
    return '<div class="jos-pipe-card' + (opts.selected ? ' on' : '') + '" data-jos-pipe-card="' + esc(String(opts.id || '')) + '" role="button" tabindex="0" draggable="true">' +
      '<div class="jos-between"><div class="jos-pipe-name">' + esc(opts.name || '—') + '</div>' +
      (opts.sourceHtml || (opts.source ? '<span class="jos-src">' + esc(opts.source) + '</span>' : '')) + '</div>' +
      (opts.meta ? '<div class="jos-pipe-meta">' + esc(opts.meta) + '</div>' : '') +
      '<div class="jos-pipe-foot">' +
      (opts.badge ? statusBadge(opts.badge, opts.badgeTone || 'info') : '<span class="jos-src">' + esc(opts.source || '') + '</span>') +
      (opts.amount ? '<span class="jos-pipe-amt">' + esc(opts.amount) + '</span>' : '') +
      '</div></div>';
  }

  var HublyDS = {
    version: '1.1.0',
    esc: esc,
    initials: initials,
    actionButton: actionButton,
    quickActionButton: actionButton,
    statusBadge: statusBadge,
    scoreRing: scoreRing,
    metricCard: metricCard,
    kpiCard: kpiCard,
    sectionHeader: sectionHeader,
    pageHeader: pageHeader,
    pageLayout: pageLayout,
    pageActions: pageActions,
    pageSearch: pageSearch,
    statsRow: statsRow,
    filterBar: filterBar,
    contentArea: contentArea,
    searchBar: searchBar,
    filterDrawer: filterDrawer,
    profileHeader: profileHeader,
    actionToolbar: actionToolbar,
    aiInsightCard: aiInsightCard,
    timeline: timeline,
    activityFeed: activityFeed,
    notesPanel: notesPanel,
    attachmentsPanel: attachmentsPanel,
    emptyState: emptyState,
    leadCard: leadCard,
    customerCard: customerCard,
    jobCard: jobCard,
    pipelineCard: pipelineCard
  };

  global.HublyDS = HublyDS;
})(typeof window !== 'undefined' ? window : globalThis);
