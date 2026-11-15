/**
 * Desktop environments Electron already maps to an OS password manager.
 * An unrecognized session needs the documented `--password-store=gnome-libsecret`
 * switch before the app is ready, or Linux stays on `basic_text`.
 * KDE keeps its own kwallet selection. A caller-supplied switch is left alone.
 * The switch does not make a cipher safe: the runtime probe still rejects `v10`.
 * Called by main at start (src/main/index.ts) and by the secret scripts in scripts/.
 */

/** XDG_CURRENT_DESKTOP names Electron already maps to libsecret, so no switch is needed. */
const LIBSECRET_DESKTOPS = new Set(['x-cinnamon', 'deepin', 'gnome', 'pantheon', 'xfce', 'ukui', 'unity']);

/** Which --password-store switch to add at start, or null when Electron already picks the right store. */
export function passwordStoreFlag(desktop: string | undefined, argv: readonly string[]): 'gnome-libsecret' | null {
  if (argv.some((arg) => arg === '--password-store' || arg.startsWith('--password-store='))) return null;
  const tokens = (desktop ?? '').split(/[:;]/).map((token) => token.trim().toLowerCase()).filter(Boolean);
  if (tokens.some((token) => token === 'kde' || token.startsWith('kde'))) return null;
  if (tokens.some((token) => LIBSECRET_DESKTOPS.has(token))) return null;
  return 'gnome-libsecret';
}
