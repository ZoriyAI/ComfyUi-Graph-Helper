/**
 * Declares `window.electronAPI`, the bridge the preload script exposes, so renderer code gets its types.
 * The shape is the preload's own ElectronAPI type, so a change there reaches every caller at compile time.
 */
import { ElectronAPI } from '../../preload/index';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
