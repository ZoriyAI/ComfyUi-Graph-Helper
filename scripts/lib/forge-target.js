/**
 * Which system and processor an Electron Forge run builds for, and which of better-sqlite3's ready-made database
 * modules goes into that build. Used by forge.config.js.
 *
 * Why: better-sqlite3 ships one N-API module per system (prebuilds/<platform>-<arch>.node). A package carries only
 * the one it runs, so the Linux packages stay as they were (linux-x64 only) and the Windows and macOS builds the
 * install scripts make (scripts/install/) carry win32-x64, darwin-arm64 or darwin-x64. Forge reads the target from
 * `--platform` and `--arch` on its command line and otherwise builds for the machine it runs on; this does the same.
 * tests/unit/forgeTarget.test.ts covers it.
 */

/** The value of `--name value` or `--name=value` in argv, or ''. */
function optionValue(argv, name) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === name && i + 1 < argv.length) return argv[i + 1];
    if (argv[i].startsWith(`${name}=`)) return argv[i].slice(name.length + 1);
  }
  return '';
}

/** The build target as "<platform>-<arch>", e.g. linux-x64, win32-x64, darwin-arm64. */
function packageTarget(argv = process.argv, platform = process.platform, arch = process.arch) {
  const target = `${optionValue(argv, '--platform') || platform}-${optionValue(argv, '--arch') || arch}`;
  // A list (--arch=x64,arm64) or an odd word would make a pattern that ships the wrong module or none.
  if (!/^[a-z0-9]+-[a-z0-9]+$/.test(target)) throw new Error(`one target at a time, not ${target}`);
  return target;
}

/** The packager ignore pattern that drops every prebuilt database module except the target's own. */
function prebuildIgnore(target) {
  return new RegExp(`^\\/node_modules\\/better-sqlite3\\/prebuilds\\/(?!${target}\\.node$)`);
}

module.exports = { packageTarget, prebuildIgnore, optionValue };
