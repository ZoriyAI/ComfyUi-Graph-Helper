// Loaded with `-r` before the app in safe-start.test.ts: every message box answers with its first button
// (the default) at once and is recorded, so the test sees what was asked without a real dialog.
const electron = require('electron');
global.__asked = [];
electron.dialog.showMessageBox = async (...args) => {
  const options = args.find((arg) => arg && typeof arg === 'object' && 'buttons' in arg) || {};
  global.__asked.push({ message: options.message, buttons: options.buttons });
  return { response: 0, checkboxChecked: false };
};
