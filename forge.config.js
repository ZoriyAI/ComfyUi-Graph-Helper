/**
 * Linux distributable for the already-built Electron app.
 * Electron Forge is the packager Electron documents for this step:
 * https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging
 * The deb maker requires dpkg and fakeroot:
 * https://www.electronforge.io/config/makers/deb
 * asar: true keeps @electron/packager's default unpack of native .node files.
 */
module.exports = {
  packagerConfig: {
    asar: true,
    ignore: [
      /^\/\.git($|\/)/,
      /^\/out($|\/)/,
      /^\/src($|\/)/,
      /^\/tests($|\/)/,
      /^\/test-results($|\/)/,
      /^\/coverage($|\/)/,
      /^\/docs($|\/)/,
      /^\/\.env($|\.)/,
    ],
  },
  rebuildConfig: {
    force: true,
  },
  makers: [
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: 'ComfyUI Graph Builder',
        },
      },
    },
  ],
};
