/**
 * Protects the check before the browser opens for an MCP server sign-in: when the sign-in page is on a site
 * other than the server's own, the person is asked first and shown both names. A hostile server could
 * otherwise send them to a look-alike login page that collects their password.
 */
import { describe, expect, it, vi } from 'vitest';
import { confirmingOpener, differentSite } from '../../../src/main/signInSite';
import { SIGN_IN_CANCELLED } from '../../../src/main/mcp/oauth';
import { createTranslator } from '../../../src/shared/i18n';

describe('the browser sign-in names a site other than the server', () => {
  it("tells a sign-in page on the server's own site from one elsewhere", () => {
    expect(differentSite('https://auth.example.net/authorize?x=1', 'https://mcp.example.net/mcp')).toBeNull();
    expect(differentSite('http://127.0.0.1:9000/authorize', 'http://127.0.0.1:9000/mcp')).toBeNull();
    expect(differentSite('https://login.example.org/authorize', 'https://mcp.example.net/mcp')).toEqual({ site: 'login.example.org', server: 'mcp.example.net' });
  });

  it('asks before opening another site, with both names; Cancel ends the sign-in and opens nothing', async () => {
    const open = vi.fn(async () => undefined);
    // Answer 1 is Cancel, which is also the default button, so Enter alone does not open the site.
    const ask = vi.fn<Parameters<typeof confirmingOpener>[0]['ask']>(async () => 1);
    const opener = confirmingOpener({ open, mcpUrl: () => 'https://mcp.example.net/mcp', translate: () => createTranslator('ru'), ask });
    await expect(opener('https://login.example.org/authorize')).rejects.toThrow(SIGN_IN_CANCELLED);
    expect(open).not.toHaveBeenCalled();
    const asked = ask.mock.calls[0][0] as { message: string; detail: string; defaultId: number };
    expect(asked.message).toContain('login.example.org');
    expect(asked.detail).toContain('mcp.example.net');
    expect(asked.defaultId).toBe(1);
  });

  it("opens at once on the server's own site, and after a yes on another", async () => {
    const open = vi.fn(async () => undefined);
    const ask = vi.fn(async () => 0);
    const opener = confirmingOpener({ open, mcpUrl: () => 'https://mcp.example.net/mcp', translate: () => createTranslator('en'), ask });
    await opener('https://auth.example.net/authorize');
    expect(ask).not.toHaveBeenCalled();
    await opener('https://login.example.org/authorize');
    expect(ask).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(2);
  });
});
