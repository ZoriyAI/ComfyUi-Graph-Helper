/**
 * Compatibility exports of the clipboard and delete actions, which live in lib/clipboard.ts so they have one
 * implementation. No module in src or tests imports this file now; it stays for older import paths.
 */
export { copySelection, cutSelection, duplicateSelection, hasClipboardSelection, pasteSelection, removeSelection, subscribeClipboard } from './lib/clipboard';
