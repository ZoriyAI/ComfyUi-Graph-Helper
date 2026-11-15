#!/usr/bin/env node
/**
 * Reads the Electron fuses baked into a built binary and checks them against forge.config.js and against the rules
 * that must hold in every release, whatever the config says.
 *
 *   node scripts/check-fuses.js <executable> [<executable> …]
 *
 * Prints one FUSES_OK line per binary, or a FUSES_* line and exits 1. If the fuses plugin ever stopped working
 * silently, this is where it shows. Run by smoke-linux-package.js and smoke-linux-portable.js on what they check.
 */
const path = require('path');

/** Fuses that must be in this state in every build people download. true = on, false = off. */
const REQUIRED = {
  RunAsNode: false,
  EnableNodeOptionsEnvironmentVariable: false,
  EnableNodeCliInspectArguments: false,
  OnlyLoadAppFromAsar: true,
  GrantFileProtocolExtraPrivileges: false,
};

/** The fuse settings forge.config.js asks for, by option name. */
function configuredFuses(FuseV1Options) {
  const forge = require(path.join(__dirname, '..', 'forge.config.js'));
  const plugin = (forge.plugins || []).find((entry) => entry.name === '@electron-forge/plugin-fuses');
  if (!plugin) throw new Error('FUSES_PLUGIN_MISSING in forge.config.js');
  const wanted = {};
  for (const [key, value] of Object.entries(plugin.config)) {
    if (key === 'version' || typeof value !== 'boolean') continue;
    wanted[FuseV1Options[Number(key)]] = value;
  }
  return wanted;
}

/** Differences between what a binary has and what it must have; empty when it is right. */
function fuseProblems(actual, wanted, FuseState) {
  const problems = [];
  for (const [name, on] of Object.entries(wanted)) {
    const state = actual[name];
    const expected = on ? FuseState.ENABLE : FuseState.DISABLE;
    if (state !== expected) problems.push(`${name}=${state === FuseState.ENABLE ? 'on' : state === FuseState.DISABLE ? 'off' : String(state)} (want ${on ? 'on' : 'off'})`);
  }
  return problems;
}

async function main(files) {
  if (files.length === 0) {
    console.error('Usage: node scripts/check-fuses.js <executable> [<executable> …]');
    process.exit(2);
  }
  const { getCurrentFuseWire, FuseV1Options, FuseState } = await import('@electron/fuses');
  const configured = configuredFuses(FuseV1Options);
  for (const [name, on] of Object.entries(REQUIRED)) {
    if (configured[name] !== on) {
      console.error(`FUSES_CONFIG forge.config.js sets ${name}=${configured[name]}; every release needs ${on}`);
      process.exit(1);
    }
  }
  let failed = false;
  for (const file of files) {
    const wire = await getCurrentFuseWire(file);
    const actual = {};
    for (const [key, value] of Object.entries(wire)) {
      if (key !== 'version') actual[FuseV1Options[Number(key)]] = value;
    }
    const problems = fuseProblems(actual, configured, FuseState);
    if (problems.length > 0) {
      failed = true;
      console.error(`FUSES_WRONG ${file}: ${problems.join(', ')}`);
    } else {
      console.log(`FUSES_OK ${file} ${Object.entries(configured).map(([name, on]) => `${name}=${on ? 'on' : 'off'}`).join(' ')}`);
    }
  }
  if (failed) process.exit(1);
}

module.exports = { REQUIRED, fuseProblems };

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
