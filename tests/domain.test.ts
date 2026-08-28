import { describe, expect, it } from 'vitest';
import { ageLabel, confidence, hasActiveNameConflict, makeItem, reconcileQueue, shoppingDelta } from '../src/domain';

const DAY = 86_400_000;

describe('pantry confidence', () => {
  it('uses zone-specific review windows', () => {
    const now = Date.UTC(2026, 7, 28);
    const fridge = makeItem('Milk', 'fridge', '', '', now);
    const freezer = makeItem('Peas', 'freezer', '', '', now);
    fridge.lastConfirmedAt = now - 6 * DAY;
    freezer.lastConfirmedAt = now - 6 * DAY;
    expect(confidence(fridge, now)).toBe('review');
    expect(confidence(freezer, now)).toBe('fresh');
    expect(ageLabel(fridge.lastConfirmedAt, now)).toBe('Checked 6 days ago');
  });

  it('puts unconfirmed and oldest active items first', () => {
    const now = Date.UTC(2026, 7, 28);
    const fresh = makeItem('Fresh', 'pantry', '', '', now);
    const old = makeItem('Old', 'pantry', '', '', now);
    const unknown = makeItem('Unknown', 'pantry', '', '', now);
    fresh.lastConfirmedAt = now;
    old.lastConfirmedAt = now - 40 * DAY;
    expect(reconcileQueue([fresh, old, unknown], 'all', now).map((item) => item.name)).toEqual(['Unknown', 'Old', 'Fresh']);
  });

  it('keeps only used and expired items in the shopping delta', () => {
    const active = makeItem('Rice', 'pantry');
    const used = { ...makeItem('Milk', 'fridge'), status: 'used' as const };
    const expired = { ...makeItem('Peas', 'freezer'), status: 'expired' as const };
    expect(shoppingDelta([active, used, expired]).map((item) => item.name).sort()).toEqual(['Milk', 'Peas']);
  });

  it('treats trimmed, case-insensitive active names as conflicts, including a restock candidate', () => {
    const active = makeItem('Pasta', 'pantry');
    const used = { ...makeItem(' pasta ', 'pantry'), status: 'used' as const };
    expect(hasActiveNameConflict([active, used], '  PASTA  ', used.id)).toBe(true);
    expect(hasActiveNameConflict([active], '   ')).toBe(false);
    expect(hasActiveNameConflict([used], 'pasta', used.id)).toBe(false);
  });
});
