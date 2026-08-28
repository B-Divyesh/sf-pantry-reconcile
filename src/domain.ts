export type Zone = 'fridge' | 'freezer' | 'pantry';
export type ItemStatus = 'active' | 'used' | 'expired';
export type Action = 'added' | 'seen' | 'used' | 'expired' | 'restocked' | 'edited' | 'removed';

export interface PantryItem {
  id: string;
  name: string;
  zone: Zone;
  quantity: string;
  note: string;
  status: ItemStatus;
  addedAt: number;
  lastConfirmedAt: number | null;
  updatedAt: number;
}

export interface PantryEvent {
  id: string;
  itemId: string;
  itemName: string;
  action: Action;
  at: number;
}

export interface PantryBackup {
  schema: 1;
  exportedAt: string;
  items: PantryItem[];
  events: PantryEvent[];
}

export const ZONES: Zone[] = ['fridge', 'freezer', 'pantry'];
export const ZONE_LABELS: Record<Zone, string> = { fridge: 'Fridge', freezer: 'Freezer', pantry: 'Pantry' };
export const REVIEW_AFTER_DAYS: Record<Zone, number> = { fridge: 5, freezer: 21, pantry: 30 };

/**
 * Names are compared the way a household reads a label: surrounding space and
 * letter case do not make a different pantry record. Keeping this rule here
 * lets every path that creates an active record use the same invariant.
 */
export function normalizeItemName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export function hasActiveNameConflict(items: PantryItem[], name: string, excludingId?: string): boolean {
  const normalized = normalizeItemName(name);
  return normalized.length > 0 && items.some((item) => item.status === 'active' && item.id !== excludingId && normalizeItemName(item.name) === normalized);
}

export function ageInDays(timestamp: number | null, now = Date.now()): number | null {
  return timestamp === null ? null : Math.max(0, Math.floor((now - timestamp) / 86_400_000));
}

export function ageLabel(timestamp: number | null, now = Date.now()): string {
  const days = ageInDays(timestamp, now);
  if (days === null) return 'Never checked';
  if (days === 0) return 'Checked today';
  if (days === 1) return 'Checked yesterday';
  return `Checked ${days} days ago`;
}

export function confidence(item: PantryItem, now = Date.now()): 'fresh' | 'review' | 'unknown' {
  const days = ageInDays(item.lastConfirmedAt, now);
  if (days === null) return 'unknown';
  return days >= REVIEW_AFTER_DAYS[item.zone] ? 'review' : 'fresh';
}

export function reconcileQueue(items: PantryItem[], zone: Zone | 'all' = 'all', now = Date.now()): PantryItem[] {
  return items
    .filter((item) => item.status === 'active' && (zone === 'all' || item.zone === zone))
    .sort((a, b) => {
      const score = (item: PantryItem) => confidence(item, now) === 'unknown' ? 0 : confidence(item, now) === 'review' ? 1 : 2;
      return score(a) - score(b) || (a.lastConfirmedAt ?? 0) - (b.lastConfirmedAt ?? 0) || a.name.localeCompare(b.name);
    });
}

export function shoppingDelta(items: PantryItem[]): PantryItem[] {
  return items.filter((item) => item.status !== 'active').sort((a, b) => b.updatedAt - a.updatedAt);
}

export function makeId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function makeItem(name: string, zone: Zone, quantity = '', note = '', now = Date.now()): PantryItem {
  return { id: makeId(), name: name.trim(), zone, quantity: quantity.trim(), note: note.trim(), status: 'active', addedAt: now, lastConfirmedAt: null, updatedAt: now };
}
