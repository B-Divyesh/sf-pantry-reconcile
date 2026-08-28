import './styles.css';
import { ageLabel, confidence, makeId, makeItem, reconcileQueue, shoppingDelta, ZONE_LABELS, ZONES, type Action, type PantryBackup, type PantryEvent, type PantryItem, type Zone } from './domain';
import { decryptBackup, encryptBackup } from './crypto';
import { getEvents, getItems, removeItem, replaceBackup, saveEvent, saveItem } from './storage';

type View = 'home' | 'reconcile' | 'shopping' | 'settings';
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const app = document.querySelector<HTMLDivElement>('#app')!;
let items: PantryItem[] = [];
let events: PantryEvent[] = [];
let view: View = new URL(location.href).searchParams.get('view') as View || 'home';
let reconcileIds: string[] = [];
let completedThisPass = 0;
let search = '';
let installPrompt: InstallEvent | null = null;
let undoState: { item: PantryItem; label: string } | null = null;
let updateWorker: ServiceWorker | null = null;
let licensed = false;

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
  return `<nav class="app-nav" aria-label="Main navigation">${entries.map(([target, label, svg]) => `<button class="nav-item ${view === target ? 'active' : ''}" data-view="${target}" ${view === target ? 'aria-current="page"' : ''}>${svg}<span>${label}</span>${target === 'shopping' && shoppingDelta(items).length ? `<b>${shoppingDelta(items).length}</b>` : ''}</button>`).join('')}</nav>`;
}

function shell(content: string): string {
  return `<header class="topbar"><a class="brand" href="/" aria-label="Pantry Check home"><span class="brand-mark">${icon('check')}</span><h1>Pantry Check</h1></a><div class="status-cluster"><span class="offline-pill" ${navigator.onLine ? 'hidden' : ''}>Offline · changes stay here</span><button class="ghost small install-button" hidden>Install app</button><button class="primary compact add-button" aria-label="Add item">${icon('plus')}<span>Add item</span></button></div></header>${nav()}<main id="main" tabindex="-1">${content}</main><footer><p>Private by default. Your pantry stays on this device.</p><div><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div><p class="generated-note">Landscape artwork generated for Pantry Check.</p></footer><div id="live" class="sr-only" aria-live="polite"></div><div class="toast-region" aria-live="polite"></div>${itemDialog()}`;
}

function freshness(item: PantryItem): string {
  const state = confidence(item);
  return `<span class="confidence ${state}"><i></i>${state === 'fresh' ? 'Confident' : state === 'review' ? 'Needs a look' : 'Unconfirmed'}</span>`;
}

function itemRow(item: PantryItem): string {
  return `<li class="item-row"><div class="item-main"><span class="zone-dot ${item.zone}" aria-hidden="true"></span><div><strong>${escapeHtml(item.name)}</strong><span>${ZONE_LABELS[item.zone]}${item.quantity ? ` · ${escapeHtml(item.quantity)}` : ''}</span></div></div><div class="item-age">${freshness(item)}<span>${ageLabel(item.lastConfirmedAt)}</span></div><button class="icon-button edit-item" data-id="${item.id}" aria-label="Edit ${escapeHtml(item.name)}">•••</button></li>`;
}

function emptyHome(): string {
  return `<section class="hero empty-hero"><div class="hero-copy"><p class="eyebrow">A calmer shared kitchen</p><h2>Know what’s there.<br><em>Without tracking every bite.</em></h2><p>Take a two-minute confidence pass through the fridge, freezer, and pantry. No account, barcode ritual, or perfect counts.</p><div class="hero-actions"><button class="primary add-button">Add your first item</button><button class="secondary template-preview">See how a check works</button></div><ul class="proof-list" aria-label="Product benefits"><li>Works offline</li><li>Lives on this device</li><li>Built for quick checks</li></ul></div><picture class="hero-art"><source media="(max-width: 700px)" srcset="/images/pantry-landscape-720.webp"><img src="/images/pantry-landscape.webp" width="1200" height="800" alt="Three luminous glass pantry shelves progress from hazy amber to clear mint, representing growing stock confidence." fetchpriority="high" decoding="async"></picture></section>`;
}

function homeView(): string {
  const active = items.filter((item) => item.status === 'active');
  if (!active.length) return emptyHome();
  const queue = reconcileQueue(items);
  const review = queue.filter((item) => confidence(item) !== 'fresh');
  const filtered = active.filter((item) => item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return `<section class="dashboard-head"><div><p class="eyebrow">Household confidence</p><h2>${review.length ? `${review.length} item${review.length === 1 ? '' : 's'} worth a look` : 'Everything feels current'}</h2><p>${review.length ? 'Oldest and unconfirmed items are ready for a quick pass.' : 'No detailed stocktake needed today.'}</p></div><button class="primary start-check">${icon('check')}Start a check</button></section>
  <section class="zone-landscape" aria-label="Pantry zones">${ZONES.map((zone) => { const zoneItems = active.filter((item) => item.zone === zone); const uncertain = zoneItems.filter((item) => confidence(item) !== 'fresh').length; return `<button class="zone-panel ${zone}" data-zone="${zone}"><span>${ZONE_LABELS[zone]}</span><strong>${zoneItems.length}</strong><small>${uncertain ? `${uncertain} to check` : 'Looking clear'}</small><i style="--clarity:${zoneItems.length ? Math.round((zoneItems.length - uncertain) / zoneItems.length * 100) : 100}%"></i></button>`; }).join('')}</section>
  <section class="inventory-section"><div class="section-heading"><div><p class="eyebrow">Current landscape</p><h2>Your items</h2></div><label class="search-label"><span class="sr-only">Search items</span><input type="search" class="search-input" value="${escapeHtml(search)}" placeholder="Search your pantry"></label></div>${filtered.length ? `<ul class="item-list">${filtered.map(itemRow).join('')}</ul>` : `<div class="inline-empty"><p>No items match “${escapeHtml(search)}”.</p><button class="ghost clear-search">Clear search</button></div>`}</section>`;
}

function reconcileView(): string {
  const queue = reconcileIds.map((id) => items.find((item) => item.id === id)).filter((item): item is PantryItem => Boolean(item?.status === 'active'));
  const current = queue[0];
  if (!items.some((item) => item.status === 'active')) return `<section class="focused-empty"><span class="orb">${icon('check')}</span><p class="eyebrow">Nothing to check yet</p><h2>Add what you usually keep around.</h2><p>Exact counts are optional. A name and zone are enough to begin.</p><button class="primary add-button">Add an item</button></section>`;
  if (!current) return `<section class="focused-empty complete"><span class="orb">${icon('spark')}</span><p class="eyebrow">Pass complete</p><h2>${completedThisPass ? `${completedThisPass} confirmation${completedThisPass === 1 ? '' : 's'} made.` : 'Your pantry is current.'}</h2><p>Your confidence ages naturally from here. Come back when real life makes the picture fuzzy.</p><div class="button-row"><button class="primary" data-view="home">View pantry</button><button class="secondary restart-check">Check again</button></div></section>`;
  const progress = completedThisPass + queue.length;
  return `<section class="reconcile-shell"><div class="reconcile-top"><div><p class="eyebrow">Quick check · uncertainty first</p><h2>What do you see?</h2></div><div class="progress-text"><strong>${completedThisPass + 1}</strong> of ${progress}</div></div><div class="progress-track" aria-label="Check progress"><i style="width:${progress ? completedThisPass / progress * 100 : 100}%"></i></div><article class="check-card ${current.zone}" data-id="${current.id}" tabindex="0" aria-label="Checking ${escapeHtml(current.name)}"><div class="shelf-glow"></div><span class="zone-label">${ZONE_LABELS[current.zone]}</span><div><h3>${escapeHtml(current.name)}</h3>${current.quantity ? `<p class="quantity">${escapeHtml(current.quantity)}</p>` : ''}<p>${ageLabel(current.lastConfirmedAt)}</p>${current.note ? `<p class="item-note">${escapeHtml(current.note)}</p>` : ''}</div><p class="swipe-hint">Swipe right for seen, left for used, down for expired</p></article><div class="reconcile-actions"><button class="action expired-action" data-action="expired"><span>↓</span>Expired<kbd>E</kbd></button><button class="action seen-action" data-action="seen"><span>✓</span>Seen<kbd>S</kbd></button><button class="action used-action" data-action="used"><span>←</span>Used up<kbd>U</kbd></button></div><p class="safety-note"><strong>Use your judgement.</strong> “Expired” is a household note, not a food-safety assessment.</p><button class="text-button end-pass" data-view="home">Finish for now</button></section>`;
}

function shoppingView(): string {
  const delta = shoppingDelta(items);
  if (!delta.length) return `<section class="focused-empty"><span class="orb sky">${icon('bag')}</span><p class="eyebrow">Shopping delta</p><h2>Nothing to replace.</h2><p>Items you use up or mark expired during a check collect here automatically.</p><button class="primary" data-view="reconcile">Start a check</button></section>`;
  return `<section class="shopping-head"><div><p class="eyebrow">Only what changed</p><h2>Shopping delta</h2><p>${delta.length} item${delta.length === 1 ? '' : 's'} left since your last passes.</p></div><div class="button-row"><button class="secondary share-delta">Share list</button><button class="ghost export-csv">Export CSV</button></div></section><ul class="shopping-list">${delta.map((item) => `<li><div><span class="status-symbol ${item.status}" aria-hidden="true">${item.status === 'expired' ? '!' : '−'}</span><div><strong>${escapeHtml(item.name)}</strong><span>${item.status === 'expired' ? 'Marked expired' : 'Used up'} · ${ZONE_LABELS[item.zone]}</span></div></div><button class="secondary restock-item" data-id="${item.id}">Mark restocked</button></li>`).join('')}</ul><p class="safety-note"><strong>Expiry labels are advisory.</strong> Follow storage guidance and use your own judgement before consuming food.</p>`;
}

function settingsView(): string {
  const recent = [...events].sort((a, b) => b.at - a.at).slice(0, licensed ? 50 : 5);
  return `<section class="settings-head"><p class="eyebrow">Local-first controls</p><h2>Settings & ownership</h2><p>No household account is required. Back up or move your data when you choose.</p></section><div class="settings-grid"><section class="settings-block"><span class="settings-icon">${icon('lock')}</span><h3>Encrypted household transfer</h3><p>Create a password-protected backup. The passphrase never leaves this device and cannot be recovered.</p><form class="export-form"><label for="export-pass">Backup passphrase <span>8+ characters</span></label><input id="export-pass" type="password" minlength="8" autocomplete="new-password" required><button class="primary">Download encrypted backup</button></form><hr><form class="import-form"><label for="import-file">Restore encrypted backup</label><input id="import-file" type="file" accept=".pantry,application/json" required><label for="import-pass">Backup passphrase</label><input id="import-pass" type="password" minlength="8" autocomplete="current-password" required><button class="secondary">Restore and replace local data</button><p class="form-error" role="alert"></p></form></section><section class="settings-block paid-block"><div class="paid-label">One-time unlock</div><h3>${licensed ? 'Household Plus is active' : 'Household Plus'}</h3><p>₹799 once. Unlock one-tap starter templates and your full local activity timeline. Core checking, safety notes, and every export remain free.</p>${licensed ? `<button class="secondary add-template">Add weeknight basics</button>` : `<a class="primary button-link" href="https://api.sociobot.in/api/v1/products/pantry-reconcile/checkout">Buy once for ₹799</a><form class="license-form"><label for="license-token">Have a license? Paste it here</label><div class="inline-form"><input id="license-token" autocomplete="off" spellcheck="false" required><button class="secondary">Verify</button></div><p class="form-error" role="alert"></p></form>`}<p class="fine-print">Secure checkout and refunds are handled by Sociobot/Dodo, the merchant of record. <a href="/terms">Terms apply.</a></p></section></div><section class="history-section"><div class="section-heading"><div><p class="eyebrow">On this device</p><h2>Recent activity</h2></div>${!licensed && events.length > 5 ? '<span class="paid-label">Latest 5 on free</span>' : ''}</div>${recent.length ? `<ol class="history-list">${recent.map((event) => `<li><span>${actionLabel[event.action]} <strong>${escapeHtml(event.itemName)}</strong></span><time datetime="${new Date(event.at).toISOString()}">${formatDate(event.at)}</time></li>`).join('')}</ol>` : '<p class="inline-empty">Your checks will appear here.</p>'}</section>`;
}

function itemDialog(): string {
  return `<dialog class="item-dialog"><form method="dialog" class="dialog-card"><div class="dialog-heading"><div><p class="eyebrow">Pantry record</p><h2 class="dialog-title">Add an item</h2></div><button class="icon-button close-dialog" value="cancel" aria-label="Close">×</button></div><input type="hidden" name="id"><label for="item-name">Item name</label><input id="item-name" name="name" required maxlength="80" autocomplete="off"><div class="field-grid"><label for="item-zone">Zone<select id="item-zone" name="zone">${ZONES.map((zone) => `<option value="${zone}">${ZONE_LABELS[zone]}</option>`).join('')}</select></label><label for="item-quantity">Rough amount <span>optional</span><input id="item-quantity" name="quantity" maxlength="40" placeholder="e.g. half a jar"></label></div><label for="item-note">Household note <span>optional</span></label><textarea id="item-note" name="note" maxlength="160" rows="3" placeholder="Top shelf, opened Tuesday…"></textarea><p class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="danger delete-item" hidden>Remove item</button><span></span><button value="cancel" class="ghost">Cancel</button><button type="submit" value="default" class="primary save-item">Save item</button></div></form></dialog>`;
}

function legalPage(kind: 'privacy' | 'terms'): void {
  const privacy = `<p class="eyebrow">Effective 28 August 2026</p><h2>Privacy, in plain language</h2><p>Pantry Check is built to work without an account. Pantry names, notes, activity, and shopping changes are stored in IndexedDB on this device.</p><h3>What leaves your device</h3><p>Nothing during normal pantry use. If you buy Household Plus, the license token is sent to Sociobot only to verify it. Checkout is hosted by Sociobot/Dodo, the merchant of record, under their own privacy terms.</p><h3>Your choices</h3><p>You can export an encrypted backup, export a shopping CSV, or clear site data in your browser. Shared text and downloaded files go only where you choose to send them.</p><h3>Analytics and safety</h3><p>There are no advertising cookies, behavioral analytics, or third-party scripts. Expiry prompts are advisory and are not a food-safety guarantee.</p>`;
  const terms = `<p class="eyebrow">Effective 28 August 2026</p><h2>Terms of use</h2><p>Pantry Check is a household planning utility. It does not determine whether food is safe to eat. Follow product labels and local food-safety advice, and use your own judgement.</p><h3>Your data and responsibility</h3><p>Your local pantry data belongs to you. Keep your backup passphrase safe: Pantry Check cannot recover it. You are responsible for reviewing imported data and shared shopping lists.</p><h3>Household Plus</h3><p>Household Plus is a ₹799 one-time license for the features described before checkout. Sociobot/Dodo is the merchant of record and handles payment and refunds. A refunded, revoked, or wrong-product license stops unlocking paid features; free features and exports continue to work.</p><h3>Availability</h3><p>The software is provided as-is under the MIT License. Offline behavior depends on a successful first load and browser support. We may update these terms when the product changes.</p>`;
  document.title = `${kind === 'privacy' ? 'Privacy' : 'Terms'} — Pantry Check`;
  app.innerHTML = `<header class="topbar legal-topbar"><a class="brand" href="/"><span class="brand-mark">${icon('check')}</span><h1>Pantry Check</h1></a><a class="secondary button-link" href="/">Back to app</a></header><main id="main" class="legal-page"><article><p class="legal-kicker">${kind === 'privacy' ? 'Privacy policy' : 'Terms'}</p>${kind === 'privacy' ? privacy : terms}<p>Questions? <a href="mailto:hello@sociobot.in">hello@sociobot.in</a></p></article></main><footer><p>Pantry Check · a Param Factory product</p><div><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div></footer>`;
}

function render(): void {
  if (location.pathname === '/privacy' || location.pathname === '/terms') { legalPage(location.pathname.slice(1) as 'privacy' | 'terms'); return; }
  document.title = 'Pantry Check — know what is really at home';
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

function setView(next: View, options: { reset?: boolean } = {}): void {
  view = next;
  if (next === 'reconcile' && (options.reset || !reconcileIds.length)) {
    reconcileIds = reconcileQueue(items).map((item) => item.id);
    completedThisPass = 0;
  }
  const url = new URL(location.href);
  if (next === 'home') url.searchParams.delete('view'); else url.searchParams.set('view', next);
  history.replaceState({}, '', url);
  render();
  requestAnimationFrame(() => document.querySelector<HTMLElement>('#main')?.focus());
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
  document.querySelectorAll<HTMLElement>('[data-view]').forEach((element) => element.addEventListener('click', () => setView(element.dataset.view as View, { reset: element.dataset.view === 'reconcile' })));
  document.querySelectorAll<HTMLButtonElement>('.add-button').forEach((button) => button.addEventListener('click', () => openItemDialog()));
  document.querySelectorAll<HTMLButtonElement>('.edit-item').forEach((button) => button.addEventListener('click', () => openItemDialog(items.find((item) => item.id === button.dataset.id))));
  document.querySelector('.start-check')?.addEventListener('click', () => setView('reconcile', { reset: true }));
  document.querySelector('.restart-check')?.addEventListener('click', () => setView('reconcile', { reset: true }));
  document.querySelector('.template-preview')?.addEventListener('click', async () => {
    const now = Date.now();
    const demo = makeItem('Milk', 'fridge', 'one carton', 'Example item — edit or remove it anytime', now);
    demo.lastConfirmedAt = now - 8 * 86_400_000;
    await record(demo, 'added'); setView('reconcile', { reset: true });
  });
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
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const id = String(data.get('id') ?? '');
    const existing = items.find((item) => item.id === id);
    const name = String(data.get('name') ?? '').trim();
    const error = form.querySelector<HTMLElement>('.form-error')!;
    if (items.some((item) => item.status === 'active' && item.id !== id && item.name.toLowerCase() === name.toLowerCase())) { error.textContent = 'That active item is already in your pantry. Edit it instead.'; return; }
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
  document.querySelector<HTMLFormElement>('.license-form')?.addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget as HTMLFormElement; const token = (form.elements.namedItem('license-token') as HTMLInputElement).value.trim(); localStorage.setItem('sb_license:pantry-reconcile', token); const valid = await verifyLicense(token, true); form.querySelector<HTMLElement>('.form-error')!.textContent = valid ? '' : 'That license could not be verified.'; if (valid) { licensed = true; render(); showToast('Household Plus unlocked.'); } });
  document.querySelector('.add-template')?.addEventListener('click', () => void addTemplate());
}

function bindSwipe(): void {
  const card = document.querySelector<HTMLElement>('.check-card'); if (!card) return;
  let startX = 0, startY = 0;
  card.addEventListener('pointerdown', (event) => { startX = event.clientX; startY = event.clientY; card.setPointerCapture(event.pointerId); });
  card.addEventListener('pointerup', (event) => { const dx = event.clientX - startX; const dy = event.clientY - startY; if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy)) void reconcile(dx > 0 ? 'seen' : 'used'); else if (dy > 80) void reconcile('expired'); });
}

async function addTemplate(): Promise<void> {
  const template: [string, Zone, string][] = [['Milk', 'fridge', '1 carton'], ['Eggs', 'fridge', '1 box'], ['Frozen peas', 'freezer', '1 bag'], ['Bread', 'freezer', '1 loaf'], ['Pasta', 'pantry', '1 pack'], ['Tinned tomatoes', 'pantry', '2 tins']];
  const existing = new Set(items.filter((item) => item.status === 'active').map((item) => item.name.toLowerCase()));
  const additions = template.filter(([name]) => !existing.has(name.toLowerCase())).map(([name, zone, quantity]) => makeItem(name, zone, quantity));
  await Promise.all(additions.map((item) => record(item, 'added'))); render(); showToast(`${additions.length} weeknight basic${additions.length === 1 ? '' : 's'} added.`);
}

async function verifyLicense(token: string, force = false): Promise<boolean> {
  const cachedRaw = localStorage.getItem('sb_license_verdict:pantry-reconcile');
  if (!force && cachedRaw) { try { const cached = JSON.parse(cachedRaw) as { token: string; valid: boolean; checkedAt: number }; if (cached.token === token && Date.now() - cached.checkedAt < 86_400_000) return cached.valid; } catch { /* reverify */ } }
  if (!navigator.onLine) return cachedRaw ? Boolean((JSON.parse(cachedRaw) as { valid: boolean }).valid) : false;
  try { const response = await fetch(`https://api.sociobot.in/api/v1/products/pantry-reconcile/verify?license=${encodeURIComponent(token)}`); const result = await response.json() as { valid: boolean }; localStorage.setItem('sb_license_verdict:pantry-reconcile', JSON.stringify({ token, valid: result.valid, checkedAt: Date.now() })); return result.valid; } catch { return cachedRaw ? Boolean((JSON.parse(cachedRaw) as { valid: boolean }).valid) : false; }
}

async function setupLicense(): Promise<void> {
  const url = new URL(location.href); const fromCheckout = url.searchParams.get('license');
  if (fromCheckout) { localStorage.setItem('sb_license:pantry-reconcile', fromCheckout); url.searchParams.delete('license'); history.replaceState({}, '', url); }
  const token = localStorage.getItem('sb_license:pantry-reconcile'); if (token) { licensed = await verifyLicense(token); if (licensed) render(); }
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
  try { [items, events] = await Promise.all([getItems(), getEvents()]); render(); await setupLicense(); void registerServiceWorker(); }
  catch (error) { app.innerHTML = `<main id="main" class="fatal-error"><h1>Pantry Check could not open local storage.</h1><p>${escapeHtml(error instanceof Error ? error.message : 'Your browser blocked local storage.')}</p><p>Check private-browsing or storage settings, then reload. No data was sent anywhere.</p><button class="primary" onclick="location.reload()">Try again</button></main>`; }
}

void init();
