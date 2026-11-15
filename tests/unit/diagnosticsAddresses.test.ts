/**
 * Checks that a diagnostics report hides the ComfyUI address the MCP server reported at its last sync, not only the
 * addresses typed in Settings: personAddresses (main/ipc/diagnosticsIpc.ts) feeds the report's address scrubber.
 */
import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import { migrate } from '../../src/main/settings/migrate';
import { writeState } from '../../src/main/mcp/sync';

// diagnosticsIpc imports electron; the test runs outside it, so a minimal stand-in is enough.
vi.mock('electron', () => ({ app: { getVersion: () => '0', getPath: () => '/tmp' }, dialog: {}, shell: {}, safeStorage: {} }));

const db = new Database(':memory:');
migrate(db);
vi.mock('../../src/main/database', () => ({ getDatabase: () => db }));

describe('addresses a diagnostics report hides', () => {
  it('include the ComfyUI address the MCP server reported', async () => {
    writeState(db, { server_identity: JSON.stringify({ installation_id: null, comfyui_url: 'http://10.1.2.3:8188' }) });
    const { personAddresses } = await import('../../src/main/ipc/diagnosticsIpc');
    expect(personAddresses()).toContain('http://10.1.2.3:8188');
  });
});
