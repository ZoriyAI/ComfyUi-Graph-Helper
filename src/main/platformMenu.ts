/**
 * The native application menu and the keychain switch, per system. main/index.ts reads both at start.
 *
 * Linux and Windows: no native menu at all. The renderer draws the only menu bar (File, Edit, View and the rest)
 * inside the window, and Electron's default menu would be a second one.
 * macOS: the menu bar at the top of the screen belongs to the system and must have the app's menu, or the usual
 * keys do nothing there: without an Edit menu, Cmd+C, Cmd+V, Cmd+X and Cmd+A do not work in text fields (a person
 * could not paste a key into Settings), and without the app menu there is no Cmd+Q or Cmd+H. So macOS gets the three
 * standard menus built from Electron's roles and nothing of the app's own: the in-window menu bar stays the place
 * for the app's commands. The page sees a key first; the canvas handles its own Cmd+C and Cmd+Z there.
 *
 * No Electron import, so the choice is unit-tested (tests/unit/platformStart.test.ts).
 */

/** One entry of a menu template: the subset of Electron's MenuItemConstructorOptions used here. */
export interface RoleMenuItem {
  role: 'appMenu' | 'editMenu' | 'windowMenu';
}

/** The application menu template for this system, or null for none (Menu.setApplicationMenu(null)). */
export function applicationMenuTemplate(platform: NodeJS.Platform = process.platform): RoleMenuItem[] | null {
  if (platform !== 'darwin') return null;
  return [{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }];
}

/**
 * Whether the `--password-store` switch means anything here. It picks a Linux keyring (GNOME Keyring or KWallet);
 * Windows always uses DPAPI and macOS the Keychain, so the app adds no such switch there.
 */
export function usesPasswordStoreSwitch(platform: NodeJS.Platform = process.platform): boolean {
  return platform === 'linux';
}
