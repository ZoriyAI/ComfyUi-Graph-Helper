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
    // productName names the bundle folder; the binary keeps the package name the deb maker links to.
    executableName: 'comfyui-graph-builder',
    // Extension added per platform by the packager; Linux takes the window icon from resources/icon.png.
    icon: 'resources/icon',
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
          productName: 'ComfyUI Graph Helper',
          genericName: 'Graph editor',
          categories: ['Graphics', 'Development'],
          maintainer: 'ComfyUI Graph Helper maintainers',
          homepage: 'https://github.com/ZoriyAI/comfyuigraphhelper',
          icon: 'resources/icon.png',
        },
      },
    },
  ],
};
