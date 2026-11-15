/** Browser access configuration and public desktop status. Pairing secrets never enter the remote bootstrap. */
export interface BrowserAccessConfig { enabled: boolean; address: string; port: number }
/** A local address the host can explicitly bind. */
export interface BrowserAddress { address: string; name: string }
/** One paired browser, identified independently of its private cookie. */
export interface BrowserDevice { id: string; name: string; pairedAt: number }
/** Actual listener state; a URL exists only after listen succeeds. */
export interface BrowserAccessStatus {
  state: 'disabled' | 'starting' | 'listening' | 'error';
  error: 'port-in-use' | 'address-unavailable' | 'failed' | null;
  url: string | null;
  addresses: BrowserAddress[];
  devices: BrowserDevice[];
  pairing: { code: string; expiresAt: number } | null;
}
