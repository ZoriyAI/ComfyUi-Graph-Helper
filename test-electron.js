// Quick test that Electron can start
const { app } = require('electron');

console.log('Electron version:', process.versions.electron);
console.log('Node version:', process.versions.node);
console.log('Chrome version:', process.versions.chrome);
console.log('Platform:', process.platform);

app.whenReady().then(() => {
  console.log('App ready!');
  setTimeout(() => {
    console.log('Test passed, exiting...');
    app.quit();
  }, 1000);
});
