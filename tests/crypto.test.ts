import { describe, expect, it } from 'vitest';
import { decryptBackup, encryptBackup } from '../src/crypto';
import type { PantryBackup } from '../src/domain';

describe('encrypted household transfer', () => {
  const backup: PantryBackup = { schema: 1, exportedAt: '2026-08-28T00:00:00.000Z', items: [], events: [] };

  it('round-trips without storing plaintext', async () => {
    const encrypted = await encryptBackup(backup, 'shared kitchen phrase');
    expect(encrypted).not.toContain(backup.exportedAt);
    await expect(decryptBackup(encrypted, 'shared kitchen phrase')).resolves.toEqual(backup);
  });

  it('rejects a wrong passphrase', async () => {
    const encrypted = await encryptBackup(backup, 'shared kitchen phrase');
    await expect(decryptBackup(encrypted, 'another phrase')).rejects.toThrow('wrong or this backup is damaged');
  });
});
