/**
 * Checks the "same site" rule of the MCP browser sign-in warning under shared suffixes: two names under co.uk or
 * github.io belong to different owners, so the person must be asked before the sign-in page opens.
 */
import { describe, expect, it } from 'vitest';
import { differentSite, siteOf } from '../../../src/main/signInSite';

describe('sign-in site under a shared suffix', () => {
  it('keeps three labels under a known two-label suffix', () => {
    expect(siteOf('auth.example.co.uk')).toBe('example.co.uk');
    expect(siteOf('alice.github.io')).toBe('alice.github.io');
    expect(siteOf('auth.example.org')).toBe('example.org');
  });

  it('warns for two sites under one shared suffix, not for one site', () => {
    expect(differentSite('https://a.co.uk/authorize', 'https://b.co.uk/mcp')).toEqual({ site: 'a.co.uk', server: 'b.co.uk' });
    expect(differentSite('https://evil.github.io/login', 'https://good.github.io/mcp')).not.toBeNull();
    expect(differentSite('https://auth.shop.com.au/login', 'https://mcp.shop.com.au/mcp')).toBeNull();
  });
});
