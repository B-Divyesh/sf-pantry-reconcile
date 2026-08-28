import './styles.css';
import pantryLandscapeDesktop from './images/pantry-landscape.webp';
import pantryLandscapeMobile from './images/pantry-landscape-720.webp';
import { ageLabel, confidence, hasActiveNameConflict, makeId, makeItem, reconcileQueue, shoppingDelta, ZONE_LABELS, ZONES, type Action, type PantryBackup, type PantryEvent, type PantryItem, type Zone } from './domain';
import { decryptBackup, encryptBackup } from './crypto';
import { clearStorage, getEvents, getItems, removeItem, replaceBackup, saveEvent, saveItem, setStorageNamespace } from './storage';

type View = 'home' | 'reconcile' | 'shopping' | 'settings';
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const app = document.querySelector<HTMLDivElement>('#app')!;
const isDemo = location.pathname === '/demo' || new URL(location.href).searchParams.get('demo') === '1';
const validViews: View[] = ['home', 'reconcile', 'shopping', 'settings'];
const requestedView = new URL(location.href).searchParams.get('view') as View | null;
let items: PantryItem[] = [];
let events: PantryEvent[] = [];
let view: View = requestedView && validViews.includes(requestedView) ? requestedView : 'home';
let reconcileIds: string[] = [];
let completedThisPass = 0;
let search = '';
let installPrompt: InstallEvent | null = null;
let undoState: { item: PantryItem; label: string } | null = null;
let updateWorker: ServiceWorker | null = null;

setStorageNamespace(isDemo ? 'demo:' : '');

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);
const formatDate = (value: number) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(value);
const actionLabel: Record<Action, string> = { added: 'Added', seen: 'Seen', used: 'Used up', expired: 'Marked expired', restocked: 'Restocked', edited: 'Edited', removed: 'Removed' };

function icon(name: 'home' | 'check' | 'bag' | 'gear' | 'plus' | 'spark' | 'lock'): string {
  const paths = {
    home: '<path d="M4 11 12 4l8 7v9h-6v-6h-4v6H4z"/>',
    check: '<path d="M20 11a8 8 0 1 1-4-6.9"/><path d="m9 11 2 2 7-8"/>',
    bag: '<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19 13.8v-3.6l-2.1-.7-.5-1.2 1-2-2.6-2.6-2 1-1.3-.5L10.8 2H7.2l-.7 2.2-1.2.5-2-1L.7 6.3l1 2-.5 1.2-2.2.7v3.6l2.2.7.5 1.2-1 2 2.6 2.6 2-1 1.2.5.7 2.2h3.6l.7-2.2 1.3-.5 2 1 2.6-2.6-1-2 .5-1.2z" transform="translate(2) scale(.83)"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    spark: '<path d="m12 2 1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6L12 2Z"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24">${paths[name]}</svg>`;
}

function nav(): string {
  const entries: [View, string, ReturnType<typeof icon>][] = [
    ['home', 'Pantry', icon('home')], ['reconcile', 'Check', icon('check')], ['shopping', 'Shopping', icon('bag')], ['settings', 'Settings', icon('gear')],
  ];
  return `<nav class="app-nav" aria-label="Main navigation">${entries.map(([target, label, svg]) => {
    const url = new URL(location.href);
    if (target === 'home') url.searchParams.delete('view'); else url.searchParams.set('view', target);
    return `<a class="nav-item ${view === target ? 'active' : ''}" data-view="${target}" href="${url.pathname}${url.search}" ${view === target ? 'aria-current="page"' : ''}>${svg}<span>${label}</span>${target === 'shopping' && shoppingDelta(items).length ? `<b>${shoppingDelta(items).length}</b>` : ''}</a>`;
  }).join('')}</nav>`;
}

function shell(content: string): string {
  const demoBanner = isDemo ? `<aside class="demo-banner" aria-label="Demo controls"><span><strong>Demo</strong> — sample data, nothing is saved.</span><div><button class="ghost reset-demo">Reset demo</button><a class="secondary button-link" href="/">Start for real</a></div></aside>` : '';
  return `${demoBanner}<header class="topbar"><a class="brand" href="/" aria-label="Pantry Check home"><span class="brand-mark">${icon('check')}</span><span class="brand-name">Pantry Check</span></a><div class="status-cluster"><span class="offline-pill" ${navigator.onLine ? 'hidden' : ''}>Offline · changes stay here</span><button class="ghost small install-button" hidden>Install app</button><button class="primary compact add-button" aria-label="Add item">${icon('plus')}<span>Add item</span></button></div></header>${nav()}<main id="main">${content}</main><footer><p>Pantry Check is a private pantry review tool.</p><div><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div><p class="generated-note">Built by Param Factory · v1.0.1</p></footer><div id="live" class="sr-only" aria-live="polite"></div><div class="toast-region" aria-live="polite"></div>${itemDialog()}`;
}

function freshness(item: PantryItem): string {
  const state = confidence(item);
  return `<span class="confidence ${state}"><i></i>${state === 'fresh' ? 'Confident' : state === 'review' ? 'Needs a look' : 'Unconfirmed'}</span>`;
}

function itemRow(item: PantryItem): string {
  return `<li class="item-row"><div class="item-main"><span class="zone-dot ${item.zone}" aria-hidden="true"></span><div><strong>${escapeHtml(item.name)}</strong><span>${ZONE_LABELS[item.zone]}${item.quantity ? ` · ${escapeHtml(item.quantity)}` : ''}</span></div></div><div class="item-age">${freshness(item)}<span>${ageLabel(item.lastConfirmedAt)}</span></div><button class="icon-button edit-item" data-id="${item.id}" aria-label="Edit ${escapeHtml(item.name)}">•••</button></li>`;
}

function emptyHome(): string {
  return `<section class="hero empty-hero"><div class="hero-copy"><p class="eyebrow">A calmer shared kitchen</p><h1 tabindex="-1">Check the pantry<br><em>without tracking every bite.</em></h1><p>For shared kitchens that need a quick view of what is still there.</p><div class="hero-actions"><button class="primary add-button">Add your first item</button><a class="secondary button-link demo-link" href="/demo">Try it with sample data</a></div><p class="action-note">The demo opens a stocked sample pantry in a separate space.</p><ul class="proof-list" aria-label="Product facts"><li>Works offline after first visit</li><li>Pantry data stays on this device</li><li>No third-party requests</li></ul></div><picture class="hero-art"><source media="(max-width: 700px)" srcset="${pantryLandscapeMobile}"><img src="${pantryLandscapeDesktop}" width="1200" height="800" alt="Three luminous glass pantry shelves progress from hazy amber to clear mint, representing growing stock confidence." fetchpriority="high" decoding="async"></picture></section><section class="landing-section"><p class="eyebrow">How it works</p><h2>Review what changed in three steps</h2><ol class="how-it-works"><li><strong>Add staples.</strong> Name an item and choose its usual zone.</li><li><strong>Run a check.</strong> Mark each item seen, used up, or expired.</li><li><strong>Take the delta.</strong> Used items become a small shopping list.</li></ol></section><section class="landing-section limits-section"><p class="eyebrow">Privacy and limits</p><h2>It helps you remember, not judge food safety</h2><p>Expiry is a household note. Follow labels and your own judgement before eating.</p><p>Normal pantry use stays in this browser. You choose when to download or share a file.</p></section>`;
}

function zoneClarity(zoneItems: PantryItem[], uncertain: number): number {
  return zoneItems.length ? Math.round((zoneItems.length - uncertain) / zoneItems.length * 100) : 100;
}

function homeView(): string {
  const active = items.filter((item) => item.status === 'active');
  if (!active.length) return emptyHome();
  const queue = reconcileQueue(items);
  const review = queue.filter((item) => confidence(item) !== 'fresh');
  const filtered = active.filter((item) => item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return `<section class="dashboard-head"><div><p class="eyebrow">Household confidence</p><h1 tabindex="-1">${review.length ? `${review.length} item${review.length === 1 ? '' : 's'} worth a look` : 'Everything feels current'}</h1><p>${review.length ? 'Oldest and unconfirmed items are ready for a quick pass.' : 'No detailed stocktake needed today.'}</p></div><button class="primary start-check">${icon('check')}Start a check</button></section>
  <section class="zone-landscape" aria-label="Pantry zones">${ZONES.map((zone) => { const zoneItems = active.filter((item) => item.zone === zone); const uncertain = zoneItems.filter((item) => confidence(item) !== 'fresh').length; const clarity = zoneClarity(zoneItems, uncertain); return `<button class="zone-panel ${zone}" data-zone="${zone}"><span>${ZONE_LABELS[zone]}</span><strong>${zoneItems.length}</strong><small>${uncertain ? `${uncertain} to check` : 'Looking clear'}</small><progress class="zone-clarity" value="${clarity}" max="100" aria-label="${ZONE_LABELS[zone]} confidence: ${clarity}%">${clarity}%</progress></button>`; }).join('')}</section>
  <section class="inventory-section"><div class="section-heading"><div><p class="eyebrow">Current landscape</p><h2>Your items</h2></div><label class="search-label"><span class="sr-only">Search items</span><input type="search" class="search-input" value="${escapeHtml(search)}" placeholder="Search your pantry"></label></div>${filtered.length ? `<ul class="item-list">${filtered.map(itemRow).join('')}</ul>` : `<div class="inline-empty"><p>No items match “${escapeHtml(search)}”.</p><button class="ghost clear-search">Clear search</button></div>`}</section>`;
}

function reconcileView(): string {
  const queue = reconcileIds.map((id) => items.find((item) => item.id === id)).filter((item): item is PantryItem => Boolean(item?.status === 'active'));
  const current = queue[0];
  if (!items.some((item) => item.status === 'active')) return `<section class="focused-empty"><span class="orb">${icon('check')}</span><p class="eyebrow">Nothing to check yet</p><h1 tabindex="-1">Add what you usually keep around.</h1><p>Exact counts are optional. A name and zone are enough to begin.</p><button class="primary add-button">Add an item</button></section>`;
  if (!current) return `<section class="focused-empty complete"><span class="orb">${icon('spark')}</span><p class="eyebrow">Pass complete</p><h1 tabindex="-1">${completedThisPass ? `${completedThisPass} confirmation${completedThisPass === 1 ? '' : 's'} made.` : 'Your pantry is current.'}</h1><p>Your confidence ages naturally from here. Come back when real life makes the picture fuzzy.</p><div class="button-row"><button class="primary" data-view="home">View pantry</button><button class="secondary restart-check">Check again</button></div></section>`;
  const progress = completedThisPass + queue.length;
  return `<section class="reconcile-shell"><div class="reconcile-top"><div><p class="eyebrow">Quick check · uncertainty first</p><h1 tabindex="-1">What do you see?</h1></div><div class="progress-text"><strong>${completedThisPass + 1}</strong> of ${progress}</div></div><progress class="progress-track" aria-label="Check progress" value="${completedThisPass}" max="${progress}">${completedThisPass} of ${progress} checked</progress><article class="check-card ${current.zone}" data-id="${current.id}" tabindex="0" aria-label="Checking ${escapeHtml(current.name)}"><div class="shelf-glow"></div><span class="zone-label">${ZONE_LABELS[current.zone]}</span><div><h2>${escapeHtml(current.name)}</h2>${current.quantity ? `<p class="quantity">${escapeHtml(current.quantity)}</p>` : ''}<p>${ageLabel(current.lastConfirmedAt)}</p>${current.note ? `<p class="item-note">${escapeHtml(current.note)}</p>` : ''}</div><p class="swipe-hint">Swipe right for seen, left for used, down for expired</p></article><div class="reconcile-actions"><button class="action expired-action" data-action="expired"><span>↓</span>Expired<kbd>E</kbd></button><button class="action seen-action" data-action="seen"><span>✓</span>Seen<kbd>S</kbd></button><button class="action used-action" data-action="used"><span>←</span>Used up<kbd>U</kbd></button></div><p class="safety-note"><strong>Use your judgement.</strong> “Expired” is a household note, not a food-safety assessment.</p><button class="text-button end-pass" data-view="home">Finish for now</button></section>`;
}

function shoppingView(): string {
  const delta = shoppingDelta(items);
  if (!delta.length) return `<section class="focused-empty"><span class="orb sky">${icon('bag')}</span><p class="eyebrow">Shopping delta</p><h1 tabindex="-1">Nothing to replace.</h1><p>Items you use up or mark expired during a check collect here automatically.</p><button class="primary" data-view="reconcile">Start a check</button></section>`;
  return `<section class="shopping-head"><div><p class="eyebrow">Only what changed</p><h1 tabindex="-1">Shopping delta</h1><p>${delta.length} item${delta.length === 1 ? '' : 's'} left since your last passes.</p></div><div class="button-row"><button class="secondary share-delta">Share list</button><button class="ghost export-csv">Export CSV</button></div></section><ul class="shopping-list">${delta.map((item) => `<li><div><span class="status-symbol ${item.status}" aria-hidden="true">${item.status === 'expired' ? '!' : '−'}</span><div><strong>${escapeHtml(item.name)}</strong><span>${item.status === 'expired' ? 'Marked expired' : 'Used up'} · ${ZONE_LABELS[item.zone]}</span></div></div><button class="secondary restock-item" data-id="${item.id}">Mark restocked</button></li>`).join('')}</ul><p class="safety-note"><strong>Expiry labels are advisory.</strong> Follow storage guidance and use your own judgement before consuming food.</p>`;
}

function settingsView(): string {
  const recent = [...events].sort((a, b) => b.at - a.at);
  return `<section class="settings-head"><p class="eyebrow">Local-first controls</p><h1 tabindex="-1">Settings & ownership</h1><p>No household account is required. Back up or move your data when you choose.</p></section><div class="settings-grid"><section class="settings-block"><span class="settings-icon">${icon('lock')}</span><h2>Encrypted household transfer</h2><p>Create a password-protected backup. The passphrase never leaves this device and cannot be recovered.</p><form class="export-form"><label for="export-pass">Backup passphrase <span>8+ characters</span></label><input id="export-pass" type="password" minlength="8" autocomplete="new-password" required><button class="primary">Download encrypted backup</button></form><hr><form class="import-form"><label for="import-file">Restore encrypted backup</label><input id="import-file" type="file" accept=".pantry,application/json" required><label for="import-pass">Backup passphrase</label><input id="import-pass" type="password" minlength="8" autocomplete="current-password" required><button class="secondary">Restore and replace local data</button><p class="form-error" role="alert"></p></form></section></div><section class="history-section"><div class="section-heading"><div><p class="eyebrow">On this device</p><h2>Recent activity</h2></div></div>${recent.length ? `<ol class="history-list">${recent.map((event) => `<li><span>${actionLabel[event.action]} <strong>${escapeHtml(event.itemName)}</strong></span><time datetime="${new Date(event.at).toISOString()}">${formatDate(event.at)}</time></li>`).join('')}</ol>` : '<p class="inline-empty">Your checks will appear here.</p>'}</section>`;
}

function itemDialog(): string {
  return `<dialog class="item-dialog"><form method="dialog" class="dialog-card"><div class="dialog-heading"><div><p class="eyebrow">Pantry record</p><h2 class="dialog-title">Add an item</h2></div><button type="button" class="icon-button close-dialog" aria-label="Close">×</button></div><input type="hidden" name="id"><label for="item-name">Item name</label><input id="item-name" name="name" required maxlength="80" autocomplete="off"><div class="field-grid"><label for="item-zone">Zone<select id="item-zone" name="zone">${ZONES.map((zone) => `<option value="${zone}">${ZONE_LABELS[zone]}</option>`).join('')}</select></label><label for="item-quantity">Rough amount <span>optional</span><input id="item-quantity" name="quantity" maxlength="40" placeholder="e.g. half a jar"></label></div><label for="item-note">Household note <span>optional</span></label><textarea id="item-note" name="note" maxlength="160" rows="3" placeholder="Top shelf, opened Tuesday…"></textarea><p class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="danger delete-item" hidden>Remove item</button><span></span><button type="button" class="ghost cancel-dialog">Cancel</button><button type="submit" value="default" class="primary save-item">Save item</button></div></form></dialog>`;
}

function legalPage(kind: 'privacy' | 'terms'): void {
  const privacy = `<p class="eyebrow">Effective 28 August 2026</p><h1 tabindex="-1">Privacy, in plain language</h1><p>Pantry names, notes, activity, and shopping changes stay in IndexedDB on this device.</p><h2>What leaves your device</h2><p>Normal pantry use makes no third-party or cross-origin application requests.</p><h2>Your choices</h2><p>You can export an encrypted backup, export a shopping CSV, or clear site data in your browser.</p><h2>Analytics and safety</h2><p>There are no advertising cookies, behavioral analytics, or third-party scripts. Expiry prompts are advisory.</p>`;
  const terms = `<p class="eyebrow">Effective 28 August 2026</p><h1 tabindex="-1">Terms of use</h1><p>Pantry Check is a household planning utility. It does not determine whether food is safe to eat.</p><h2>Your data and responsibility</h2><p>Your local pantry data belongs to you. Keep your backup passphrase safe because Pantry Check cannot recover it.</p><h2>Availability</h2><p>The software is provided as-is under the MIT License. Offline use needs a successful first load and browser support.</p>`;
  document.title = `${kind === 'privacy' ? 'Privacy' : 'Terms'} — Pantry Check`;
  app.innerHTML = `<header class="topbar legal-topbar"><a class="brand" href="/"><span class="brand-mark">${icon('check')}</span><span class="brand-name">Pantry Check</span></a><a class="secondary button-link" href="/">Back to app</a></header><main id="main" class="legal-page"><article><p class="legal-kicker">${kind === 'privacy' ? 'Privacy policy' : 'Terms'}</p>${kind === 'privacy' ? privacy : terms}<p>Questions? <a href="mailto:hello@sociobot.in">hello@sociobot.in</a></p></article></main><footer><p>Pantry Check is a private pantry review tool.</p><div><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div><p class="generated-note">Built by Param Factory · v1.0.1</p></footer><div id="live" class="sr-only" aria-live="polite"></div>`;
}

function notFoundPage(): void {
  document.title = 'Page not found — Pantry Check';
  app.innerHTML = `<header class="topbar legal-topbar"><a class="brand" href="/"><span class="brand-mark">${icon('check')}</span><span class="brand-name">Pantry Check</span></a></header><main id="main" class="legal-page"><article><p class="legal-kicker">404</p><h1 tabindex="-1">This pantry shelf is empty.</h1><p>That page does not exist. Return to Pantry Check to review your pantry.</p><a class="primary button-link" href="/">Go to Pantry Check</a></article></main><footer><p>Pantry Check is a private pantry review tool.</p><div><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div><p class="generated-note">Built by Param Factory · v1.0.1</p></footer><div id="live" class="sr-only" aria-live="polite"></div>`;
}

function render(): void {
  if (location.pathname === '/privacy' || location.pathname === '/terms') { legalPage(location.pathname.slice(1) as 'privacy' | 'terms'); return; }
  if (location.pathname !== '/' && location.pathname !== '/demo') { notFoundPage(); return; }
  document.title = isDemo ? 'Demo — Pantry Check' : 'Pantry Check — check the pantry';
  const content = view === 'home' ? homeView() : view === 'reconcile' ? reconcileView() : view === 'shopping' ? shoppingView() : settingsView();
  app.innerHTML = shell(content);
  bindEvents();
  updateTransientUi();
}

function announce(message: string): void {
  const live = document.querySelector<HTMLElement>('#live');
  if (live) live.textContent = message;
}

function showToast(message: string, allowUndo = false): void {
  const region = document.querySelector<HTMLElement>('.toast-region');
  if (!region) return;
  region.innerHTML = `<div class="toast"><span>${escapeHtml(message)}</span>${allowUndo ? '<button class="undo-button">Undo</button>' : ''}</div>`;
  window.setTimeout(() => { if (region) region.innerHTML = ''; }, 6000);
}

function focusAndAnnounceRoute(): void {
  const heading = document.querySelector<HTMLElement>('main h1');
  requestAnimationFrame(() => heading?.focus());
  announce(heading?.textContent?.trim() ?? 'Pantry Check');
}

function setView(next: View, options: { reset?: boolean; replace?: boolean } = {}): void {
  view = next;
  if (next === 'reconcile' && (options.reset || !reconcileIds.length)) {
    reconcileIds = reconcileQueue(items).map((item) => item.id);
    completedThisPass = 0;
  }
  const url = new URL(location.href);
  if (next === 'home') url.searchParams.delete('view'); else url.searchParams.set('view', next);
  if (options.replace) history.replaceState({}, '', url); else history.pushState({}, '', url);
  render();
  focusAndAnnounceRoute();
}

async function record(item: PantryItem, action: Action): Promise<void> {
  const event: PantryEvent = { id: makeId(), itemId: item.id, itemName: item.name, action, at: Date.now() };
  await Promise.all([saveItem(item), saveEvent(event)]);
  items = items.filter((entry) => entry.id !== item.id).concat(item);
  events.push(event);
}

async function reconcile(action: 'seen' | 'used' | 'expired'): Promise<void> {
  const id = reconcileIds[0];
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  undoState = { item: { ...item }, label: item.name };
  const changed: PantryItem = { ...item, status: action === 'seen' ? 'active' : action, lastConfirmedAt: action === 'seen' ? Date.now() : item.lastConfirmedAt, updatedAt: Date.now() };
  try {
    await record(changed, action);
    reconcileIds.shift();
    completedThisPass += 1;
    render();
    showToast(`${item.name}: ${action === 'seen' ? 'confirmed' : action === 'used' ? 'added to shopping' : 'marked expired'}.`, true);
    announce(`${item.name} ${action === 'seen' ? 'confirmed' : action === 'used' ? 'used up' : 'marked expired'}.`);
  } catch (error) { showToast(error instanceof Error ? error.message : 'Could not save this change.'); }
}

function openItemDialog(item?: PantryItem): void {
  const dialog = document.querySelector<HTMLDialogElement>('.item-dialog')!;
  const form = dialog.querySelector<HTMLFormElement>('form')!;
  (form.elements.namedItem('id') as HTMLInputElement).value = item?.id ?? '';
  (form.elements.namedItem('name') as HTMLInputElement).value = item?.name ?? '';
  (form.elements.namedItem('zone') as HTMLSelectElement).value = item?.zone ?? 'fridge';
  (form.elements.namedItem('quantity') as HTMLInputElement).value = item?.quantity ?? '';
  (form.elements.namedItem('note') as HTMLTextAreaElement).value = item?.note ?? '';
  dialog.querySelector('.dialog-title')!.textContent = item ? 'Edit item' : 'Add an item';
  dialog.querySelector<HTMLButtonElement>('.delete-item')!.hidden = !item;
  dialog.showModal();
  requestAnimationFrame(() => (form.elements.namedItem('name') as HTMLInputElement).focus());
}

function download(contents: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvValue(value: string): string { return `"${value.replaceAll('"', '""')}"`; }

function bindEvents(): void {
  document.querySelectorAll<HTMLElement>('[data-view]').forEach((element) => element.addEventListener('click', (event) => {
    if (element instanceof HTMLAnchorElement) event.preventDefault();
    setView(element.dataset.view as View, { reset: element.dataset.view === 'reconcile' });
  }));
  document.querySelectorAll<HTMLButtonElement>('.add-button').forEach((button) => button.addEventListener('click', () => openItemDialog()));
  document.querySelectorAll<HTMLButtonElement>('.edit-item').forEach((button) => button.addEventListener('click', () => openItemDialog(items.find((item) => item.id === button.dataset.id))));
  document.querySelector('.start-check')?.addEventListener('click', () => setView('reconcile', { reset: true }));
  document.querySelector('.restart-check')?.addEventListener('click', () => setView('reconcile', { reset: true }));
  document.querySelector('.reset-demo')?.addEventListener('click', () => void resetDemo());
  document.querySelectorAll<HTMLButtonElement>('.zone-panel').forEach((button) => button.addEventListener('click', () => { reconcileIds = reconcileQueue(items, button.dataset.zone as Zone).map((item) => item.id); completedThisPass = 0; setView('reconcile'); }));
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => button.addEventListener('click', () => void reconcile(button.dataset.action as 'seen' | 'used' | 'expired')));
  const searchInput = document.querySelector<HTMLInputElement>('.search-input');
  searchInput?.addEventListener('input', () => { search = searchInput.value; const position = searchInput.selectionStart; render(); const next = document.querySelector<HTMLInputElement>('.search-input'); next?.focus(); next?.setSelectionRange(position, position); });
  document.querySelector('.clear-search')?.addEventListener('click', () => { search = ''; render(); });
  bindDialog(); bindShopping(); bindSettings(); bindSwipe();
  document.querySelector('.install-button')?.addEventListener('click', async () => { await installPrompt?.prompt(); installPrompt = null; updateTransientUi(); });
}

function bindDialog(): void {
  const dialog = document.querySelector<HTMLDialogElement>('.item-dialog');
  const form = dialog?.querySelector<HTMLFormElement>('form');
  if (!dialog || !form) return;
  dialog.querySelector('.close-dialog')?.addEventListener('click', () => dialog.close());
  dialog.querySelector('.cancel-dialog')?.addEventListener('click', () => dialog.close());
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const id = String(data.get('id') ?? '');
    const existing = items.find((item) => item.id === id);
    const nameInput = form.elements.namedItem('name') as HTMLInputElement;
    const name = String(data.get('name') ?? '').trim();
    const error = form.querySelector<HTMLElement>('.form-error')!;
    if (!name) { error.textContent = 'Enter an item name, not only spaces.'; nameInput.focus(); return; }
    if (hasActiveNameConflict(items, name, id || undefined)) { error.textContent = 'That active item is already in your pantry. Edit it instead.'; nameInput.focus(); return; }
    const item = existing ? { ...existing, name, zone: data.get('zone') as Zone, quantity: String(data.get('quantity') ?? '').trim(), note: String(data.get('note') ?? '').trim(), updatedAt: Date.now() } : makeItem(name, data.get('zone') as Zone, String(data.get('quantity') ?? ''), String(data.get('note') ?? ''));
    try { await record(item, existing ? 'edited' : 'added'); dialog.close(); render(); showToast(`${item.name} saved.`); } catch (caught) { error.textContent = caught instanceof Error ? caught.message : 'Could not save this item.'; }
  });
  dialog.querySelector('.delete-item')?.addEventListener('click', async () => {
    const id = (form.elements.namedItem('id') as HTMLInputElement).value;
    const item = items.find((entry) => entry.id === id);
    if (!item || !confirm(`Remove “${item.name}” from Pantry Check? Its activity history will remain.`)) return;
    await removeItem(id); items = items.filter((entry) => entry.id !== id); dialog.close(); render(); showToast(`${item.name} removed.`);
  });
}

function bindShopping(): void {
  document.querySelectorAll<HTMLButtonElement>('.restock-item').forEach((button) => button.addEventListener('click', async () => {
    const item = items.find((entry) => entry.id === button.dataset.id); if (!item) return;
    if (hasActiveNameConflict(items, item.name, item.id)) {
      const message = `${item.name} is already active in your pantry. Edit that record instead of restocking this one.`;
      showToast(message); announce(message); return;
    }
    undoState = { item: { ...item }, label: item.name };
    await record({ ...item, status: 'active', lastConfirmedAt: Date.now(), updatedAt: Date.now() }, 'restocked'); render(); showToast(`${item.name} returned to ${ZONE_LABELS[item.zone]}.`, true);
  }));
  document.querySelector('.share-delta')?.addEventListener('click', async () => {
    const text = `Pantry Check — shopping delta\n${shoppingDelta(items).map((item) => `• ${item.name}${item.quantity ? ` (${item.quantity})` : ''}`).join('\n')}`;
    try { if (navigator.share) await navigator.share({ title: 'Shopping delta', text }); else { await navigator.clipboard.writeText(text); showToast('Shopping delta copied.'); } } catch (error) { if ((error as DOMException).name !== 'AbortError') showToast('Could not share. Try Export CSV instead.'); }
  });
  document.querySelector('.export-csv')?.addEventListener('click', () => {
    const rows = [['Item', 'Zone', 'Reason', 'Rough amount'], ...shoppingDelta(items).map((item) => [item.name, ZONE_LABELS[item.zone], item.status, item.quantity])];
    download(rows.map((row) => row.map(csvValue).join(',')).join('\n'), `pantry-shopping-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  });
}

function bindSettings(): void {
  document.querySelector<HTMLFormElement>('.export-form')?.addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget as HTMLFormElement; const passphrase = (form.elements.namedItem('export-pass') as HTMLInputElement).value;
    try { const backup: PantryBackup = { schema: 1, exportedAt: new Date().toISOString(), items, events }; download(await encryptBackup(backup, passphrase), `pantry-check-${new Date().toISOString().slice(0, 10)}.pantry`, 'application/json'); showToast('Encrypted backup downloaded.'); form.reset(); } catch (error) { showToast(error instanceof Error ? error.message : 'Could not make a backup.'); }
  });
  document.querySelector<HTMLFormElement>('.import-form')?.addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget as HTMLFormElement; const file = (form.elements.namedItem('import-file') as HTMLInputElement).files?.[0]; const passphrase = (form.elements.namedItem('import-pass') as HTMLInputElement).value; const error = form.querySelector<HTMLElement>('.form-error')!;
    if (!file) return;
    try { const backup = await decryptBackup(await file.text(), passphrase); if (!confirm(`Replace this device's pantry with ${backup.items.length} items from the backup?`)) return; await replaceBackup(backup); items = backup.items; events = backup.events; render(); showToast('Encrypted backup restored.'); } catch (caught) { error.textContent = caught instanceof Error ? caught.message : 'Could not restore this backup.'; }
  });
}

function bindSwipe(): void {
  const card = document.querySelector<HTMLElement>('.check-card'); if (!card) return;
  let startX = 0, startY = 0;
  card.addEventListener('pointerdown', (event) => { startX = event.clientX; startY = event.clientY; card.setPointerCapture(event.pointerId); });
  card.addEventListener('pointerup', (event) => { const dx = event.clientX - startX; const dy = event.clientY - startY; if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy)) void reconcile(dx > 0 ? 'seen' : 'used'); else if (dy > 80) void reconcile('expired'); });
}

function updateTransientUi(): void {
  document.querySelectorAll<HTMLElement>('.offline-pill').forEach((pill) => { pill.hidden = navigator.onLine; });
  const install = document.querySelector<HTMLButtonElement>('.install-button'); if (install) install.hidden = !installPrompt;
  if (updateWorker) {
    const region = document.querySelector<HTMLElement>('.toast-region');
    if (region) region.innerHTML = '<div class="toast"><span>A fresh version is ready.</span><button class="undo-button update-button">Reload to update</button></div>';
  }
}

window.addEventListener('keydown', (event) => {
  if (view !== 'reconcile' || document.querySelector('dialog[open]') || ['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName)) return;
  const action = ({ s: 'seen', u: 'used', e: 'expired' } as const)[event.key.toLowerCase() as 's' | 'u' | 'e']; if (action) { event.preventDefault(); void reconcile(action); }
});
window.addEventListener('online', () => { updateTransientUi(); showToast('Back online. Your local changes were already safe.'); });
window.addEventListener('offline', updateTransientUi);
window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); installPrompt = event as InstallEvent; updateTransientUi(); });
window.addEventListener('popstate', () => {
  const next = new URL(location.href).searchParams.get('view') as View | null;
  view = next && validViews.includes(next) ? next : 'home';
  if (view === 'reconcile') { reconcileIds = reconcileQueue(items).map((item) => item.id); completedThisPass = 0; }
  render();
  focusAndAnnounceRoute();
});
document.addEventListener('click', async (event) => {
  const target = event.target as HTMLElement;
  if (target.closest('.update-button') && updateWorker) { updateWorker.postMessage({ type: 'SKIP_WAITING' }); return; }
  if (target.closest('.undo-button') && undoState) { const previous = undoState.item; undoState = null; await saveItem(previous); items = items.filter((item) => item.id !== previous.id).concat(previous); if (view === 'reconcile' && !reconcileIds.includes(previous.id)) { reconcileIds.unshift(previous.id); completedThisPass = Math.max(0, completedThisPass - 1); } render(); showToast(`${previous.name} restored.`); }
});

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.register('/sw.js');
  if (registration.waiting) updateWorker = registration.waiting;
  registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', () => { if (registration.waiting && navigator.serviceWorker.controller) { updateWorker = registration.waiting; updateTransientUi(); } }));
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updateWorker) location.reload(); });
}

async function init(): Promise<void> {
  if (location.pathname !== '/' && location.pathname !== '/demo' && location.pathname !== '/privacy' && location.pathname !== '/terms') { render(); return; }
  try {
    [items, events] = await Promise.all([getItems(), getEvents()]);
    if (isDemo && items.length === 0 && events.length === 0) await seedDemo();
    render();
    void registerServiceWorker();
  }
  catch (error) {
    app.innerHTML = `<main id="main" class="fatal-error"><h1>Pantry Check could not open local storage.</h1><p>${escapeHtml(error instanceof Error ? error.message : 'Your browser blocked local storage.')}</p><p>Check private-browsing or storage settings, then reload. No data was sent anywhere.</p><button class="primary retry-storage">Try again</button></main>`;
    document.querySelector<HTMLButtonElement>('.retry-storage')?.addEventListener('click', () => location.reload());
  }
}

async function seedDemo(): Promise<void> {
  const now = Date.now();
  const oats = makeItem('Oat milk', 'fridge', 'half a carton', 'Use it for breakfasts.', now - 8 * 86_400_000);
  oats.id = 'demo-oat-milk'; oats.lastConfirmedAt = now - 7 * 86_400_000;
  const peas = makeItem('Frozen peas', 'freezer', 'one bag', '', now - 12 * 86_400_000);
  peas.id = 'demo-frozen-peas'; peas.lastConfirmedAt = now - 4 * 86_400_000;
  const lentils = makeItem('Red lentils', 'pantry', 'one jar', '', now - 35 * 86_400_000);
  lentils.id = 'demo-red-lentils'; lentils.lastConfirmedAt = now - 33 * 86_400_000;
  const pasta = makeItem('Pasta', 'pantry', 'one box', 'Add to the next shop.', now - 4 * 86_400_000);
  pasta.id = 'demo-pasta'; pasta.status = 'used'; pasta.updatedAt = now - 2 * 86_400_000;
  const sampleItems = [oats, peas, lentils, pasta];
  const sampleEvents: PantryEvent[] = sampleItems.map((item, index) => ({ id: `demo-event-${index}`, itemId: item.id, itemName: item.name, action: index === 3 ? 'used' : 'added', at: now - (index + 1) * 86_400_000 }));
  await Promise.all([...sampleItems.map(saveItem), ...sampleEvents.map(saveEvent)]);
  items = sampleItems;
  events = sampleEvents;
}

async function resetDemo(): Promise<void> {
  if (!isDemo) return;
  try {
    await clearStorage();
    items = [];
    events = [];
    reconcileIds = [];
    completedThisPass = 0;
    await seedDemo();
    view = 'home';
    const url = new URL(location.href);
    url.searchParams.delete('view');
    history.replaceState({}, '', url);
    render();
    showToast('Sample pantry reset.');
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Could not reset the sample pantry.');
  }
}

void init();
