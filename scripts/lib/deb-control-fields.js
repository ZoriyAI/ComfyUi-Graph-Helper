/**
 * Adds fields to the control file of a finished .deb, leaving its files untouched.
 *
 * Who uses it: forge.config.js (postMake hook), to declare that the package replaces the one the app was shipped as
 * before 1.0 (Replaces and Conflicts), so installing the new .deb over the old one removes the old package instead
 * of leaving two copies of the app. Why a hook: electron-installer-debian writes the control file from a fixed
 * template that has no Replaces or Conflicts fields.
 *
 * How: read the control file, add the fields before Description, then unpack and rebuild the package inside one
 * fakeroot session, so every file keeps the owner and mode the maker gave it (chrome-sandbox stays SUID root).
 * Needs dpkg-deb and fakeroot, which the deb maker needs anyway. Tested in tests/unit/debControlFields.test.ts.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

/** The control text with the fields set: an existing field of the same name is replaced; new ones go before Description. */
function withControlFields(control, fields) {
  const names = Object.keys(fields);
  const kept = [];
  let skipping = false;
  for (const line of control.replace(/\n+$/, '').split('\n')) {
    // A continuation line (leading space) belongs to the field above it.
    if (/^\s/.test(line)) {
      if (!skipping) kept.push(line);
      continue;
    }
    const name = line.slice(0, line.indexOf(':'));
    skipping = names.includes(name);
    if (!skipping) kept.push(line);
  }
  const added = names.map((name) => `${name}: ${fields[name]}`);
  const at = kept.findIndex((line) => line.startsWith('Description:'));
  if (at < 0) kept.push(...added);
  else kept.splice(at, 0, ...added);
  return `${kept.join('\n')}\n`;
}

/** Rewrites `debFile` in place with `fields` (name to value) in its control file. */
function addControlFields(debFile, fields, run = execFileSync) {
  const control = run('dpkg-deb', ['--info', debFile, 'control'], { encoding: 'utf8' });
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'deb-control-'));
  try {
    const newControl = path.join(work, 'control');
    fs.writeFileSync(newControl, withControlFields(control, fields));
    const rebuilt = path.join(work, 'out.deb');
    const script = 'set -e; dpkg-deb --raw-extract "$1" "$2/root"; cp "$3" "$2/root/DEBIAN/control"; dpkg-deb --build "$2/root" "$4" >/dev/null';
    run('fakeroot', ['sh', '-c', script, 'sh', debFile, work, newControl, rebuilt], { stdio: 'inherit' });
    fs.copyFileSync(rebuilt, debFile);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

module.exports = { addControlFields, withControlFields };
