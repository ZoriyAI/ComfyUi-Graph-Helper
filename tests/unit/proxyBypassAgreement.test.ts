/**
 * Checks that the app's own "never through a proxy" rule (isPrivateHost) and the bypass list Chromium is given with
 * a typed proxy (PROXY_BYPASS) name the same ranges, so no private address goes to a proxy by one path and not the
 * other.
 */
import { describe, expect, it } from 'vitest';
import { isPrivateHost, PROXY_BYPASS } from '../../src/shared/config/proxy';

describe('proxy bypass and private hosts agree', () => {
  it('lists every range isPrivateHost treats as private', () => {
    const parts = PROXY_BYPASS.split(';');
    for (const rule of ['0.0.0.0/8', '127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '169.254.0.0/16', 'fc00::/7', 'fe80::/10', '*.localhost', '*.local', '::1']) {
      expect(parts, rule).toContain(rule);
    }
  });

  it('treats the same hosts as private', () => {
    for (const host of ['0.0.0.0', '0.1.2.3', '127.0.0.1', '10.9.9.9', '172.16.0.1', '172.31.255.255', '192.168.0.1', '169.254.1.1', '[fd12::1]', '[fe80::1]', '[febf::1]', 'a.localhost', 'box.local']) {
      expect(isPrivateHost(host), host).toBe(true);
    }
    for (const host of ['1.0.0.1', '172.15.0.1', '172.32.0.1', '192.169.0.1', '169.253.0.1', '[fec0::1]', '[2001:db8::1]', 'example.com']) {
      expect(isPrivateHost(host), host).toBe(false);
    }
  });
});
