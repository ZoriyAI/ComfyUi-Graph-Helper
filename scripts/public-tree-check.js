#!/usr/bin/env node
/**
 * Looks through every tracked file for things that must not reach a public repository: a personal e-mail
 * address, a link to a private work session, a line that says who typed a commit, a path inside somebody's
 * home folder, an address inside a private network, a key, a file that should never be tracked. It reads; it
 * changes nothing.
 *
 * Usage: node scripts/public-tree-check.js                (the files git tracks; exit 1 when something is found)
 *        node scripts/public-tree-check.js --dir FOLDER   (another folder: what git tracks there, or every file
 *                                                         when it is not a git work tree)
 *        node scripts/public-tree-check.js --values FILE  (also look for every line of FILE, letter case
 *                                                         ignored: the host of a private server, a name, the
 *                                                         name of a private node pack; a line starting with #
 *                                                         is a comment; FILE itself must stay out of git)
 *        node scripts/public-tree-check.js --show         (print what was found in full; by default the
 *                                                         middle of every find is hidden)
 *
 * The same list can come from the environment: PUBLIC_TREE_PRIVATE_VALUES=/path/to/file.
 *
 * Run by CI and the release workflow on every change, and by scripts/make-public-snapshot.sh on the source and on
 * the copy it makes. tests/unit/publicTreeCheck.test.ts tests the exported scanners.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/** Addresses nobody owns, and addresses that hide a person on purpose. */
const SAFE_MAIL_DOMAINS = [
  'example.com',
  'example.org',
  'example.net',
  'example.invalid',
  'users.noreply.github.com',
  'localhost.localdomain',
];
/** Endings set aside for examples and tests: no real mailbox or server can have them. */
const RESERVED_ENDINGS = new Set(['example', 'test', 'invalid', 'localhost', 'local']);
/** `git@github.com:owner/name.git` is a way to clone, not a mailbox. */
const SAFE_MAILS = ['git@github.com', 'git@gitlab.com'];
/** `icon@2x.png` and `name@1.2.3.tgz` look like an address to a pattern; these endings say they are files. */
const FILE_ENDINGS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'icns', 'json', 'js', 'cjs', 'mjs', 'ts', 'tsx', 'jsx', 'css',
  'md', 'txt', 'tgz', 'gz', 'zip', 'html', 'yml', 'yaml', 'lock', 'map', 'node', 'safetensors', 'gguf', 'ckpt',
  'pt', 'pth', 'bin', 'onnx', 'mp4', 'webm', 'wav', 'mp3', 'flac', 'deb', 'rpm', 'sh', 'py',
]);

/** Folder names that stand for "your home" in an example. */
const SAFE_HOME_NAMES = new Set([
  'user', 'you', 'me', 'name', 'username', 'yourname', 'your-name', 'your_name', 'someone', 'somebody', 'alice',
  'bob', 'ann', 'anna', 'owner', 'runner', 'shared', 'public', 'comfy', 'comfyui',
]);

/** Addresses the documents may use as an example of "another computer at home". */
const SAFE_PRIVATE_ADDRESS = /^(?:192\.168\.[01]\.\d{1,3}|10\.0\.0\.\d{1,3})$/;

/** Words inside a key that say it was made up for a test or an example. */
const MADE_UP_KEY = /test|fake|example|sample|dummy|demo|placeholder|your|x{4,}|0{6,}|1234|abcd|a1b2c3|secret-?value|\.\.\./i;

/** Paths that must never be tracked at all, whatever they hold, each with the reason the report gives. */
const TRACKED_NEVER = [
  { pattern: /(^|\/)\.env(\.|$)/, why: 'a file with environment values' },
  { pattern: /\.(pem|p12|pfx|key|keystore)$/i, why: 'a private key or certificate store' },
  { pattern: /\.(db|db-wal|db-shm|sqlite|sqlite3)$/i, why: 'a database' },
  { pattern: /(^|\/)(test-results|playwright-report|coverage|dist|out)\//, why: 'a build or test output' },
  { pattern: /(^|\/)(uploads|agent-tools)\//, why: 'a folder of working notes' },
  { pattern: /(^|\/)\.claude\/(?!commands\/|skills\/)/, why: 'a folder of a coding assistant' },
  { pattern: /(^|\/)\.cursor\//, why: 'a folder of a coding assistant' },
];

/** Files above this size are reported: a large file in a source repository is usually a mistake. */
const BIG_FILE_BYTES = 2 * 1024 * 1024;

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

/** True for an IPv4 address inside a private range (10/8, 172.16/12, 192.168/16) or the 100.64/10 shared range. */
function privateAddress(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // the range overlay networks hand out
  return false;
}

/**
 * Everything of one text file that must not be public. `file` is only used to choose rules (tests may hold
 * made-up network addresses) and to fill the report.
 */
function scanText(file, text, privateValues = []) {
  const finds = [];
  const add = (rule, index, match) => finds.push({ rule, file, line: lineOf(text, index), match });
  const inTests = /^tests\//.test(file);

  // 1. A mailbox of a real person, or a name and password written into an address.
  const mail = /[A-Za-z0-9._%+-]+@((?:[A-Za-z0-9-]+\.)+([A-Za-z]{2,}))/g;
  for (let m = mail.exec(text); m; m = mail.exec(text)) {
    const whole = m[0].toLowerCase();
    const domain = m[1].toLowerCase();
    const ending = m[2].toLowerCase();
    if (FILE_ENDINGS.has(ending) || RESERVED_ENDINGS.has(ending)) continue;
    if (SAFE_MAILS.includes(whole)) continue;
    if (SAFE_MAIL_DOMAINS.some((safe) => domain === safe || domain.endsWith(`.${safe}`))) continue;
    // `https://name:password@host/`: the part before @ is a sign-in, not a mailbox.
    const before = text.slice(Math.max(0, m.index - 200), m.index);
    const inAddress = /[a-z][a-z0-9+.-]*:\/\/[^\s"'`<>]*$/i.test(before);
    if (inAddress) {
      if (!inTests) add('address with a password', m.index, m[0]);
      continue;
    }
    add('mail', m.index, m[0]);
  }

  // 2. A link to somebody's private work session.
  const session = /(?:claude\.ai\/(?:code\/session_|chat\/|share\/)[A-Za-z0-9_-]+|cursor\.com\/(?:agents|background-agent|dashboard)[^\s)"'`]*|origin\.cursor\.com[^\s)"'`]*|chatgpt\.com\/(?:c|share)\/[A-Za-z0-9-]+)/g;
  for (let m = session.exec(text); m; m = session.exec(text)) add('session link', m.index, m[0]);

  // 3. A line that says which tool typed a commit.
  const typedBy = /^(?:\s*)(?:Co-Authored-By:.*|Claude-Session:.*|.*Generated with \[?(?:Claude|Cursor|Copilot|Codex)\b.*)$/gim;
  for (let m = typedBy.exec(text); m; m = typedBy.exec(text)) add('commit trailer', m.index, m[0].trim());

  // 4. A path inside a real person's home folder.
  const home = /(?:\/home\/|\/Users\/|[A-Za-z]:\\\\?Users\\\\?)([A-Za-z0-9._-]+)(?=[\\/])/g;
  for (let m = home.exec(text); m; m = home.exec(text)) {
    const name = m[1].toLowerCase();
    if (SAFE_HOME_NAMES.has(name) || /^[<{$%]/.test(m[1]) || /^\.+$/.test(m[1])) continue;
    add('home folder', m.index, m[0]);
  }
  const rootHome = /(?<![A-Za-z0-9_.-])\/root\/[A-Za-z0-9._-]+/g;
  for (let m = rootHome.exec(text); m; m = rootHome.exec(text)) add('home folder', m.index, m[0]);

  // 5. An address inside a private network (tests make such addresses up on purpose).
  if (!inTests) {
    const ip = /(?<![\d.])(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?![\d.]*\d)/g;
    for (let m = ip.exec(text); m; m = ip.exec(text)) {
      if (!privateAddress(m[1]) || SAFE_PRIVATE_ADDRESS.test(m[1])) continue;
      add('private address', m.index, m[1]);
    }
  }

  // 6. A key.
  const keys = [
    /sk-ant-[A-Za-z0-9_-]{20,}/g,
    /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/g,
    /AIza[0-9A-Za-z_-]{35}/g,
    /gh[pousr]_[A-Za-z0-9]{36,}/g,
    /github_pat_[A-Za-z0-9_]{40,}/g,
    /hf_[A-Za-z0-9]{30,}/g,
    /xox[abprs]-[A-Za-z0-9-]{20,}/g,
    /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g,
  ];
  for (const pattern of keys) {
    for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
      if (MADE_UP_KEY.test(m[0])) continue;
      add('key', m.index, m[0]);
    }
  }

  // 7. The private values of this copy: hosts, names, anything listed in the file given with --values.
  if (privateValues.length > 0) {
    const lower = text.toLowerCase();
    for (const value of privateValues) {
      const needle = value.toLowerCase();
      for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, at + needle.length)) {
        add('private value', at, text.slice(at, at + needle.length));
      }
    }
  }
  return finds;
}

/** A binary file can still carry text (a picture keeps a workflow, a comment, an author). */
function scanBinary(file, buffer, privateValues = []) {
  const text = buffer.toString('latin1');
  return scanText(file, text, privateValues).filter((find) => find.rule === 'private value' || find.rule === 'session link');
}

/** Finds that come from a file's path and size alone. */
function scanName(file, size) {
  const finds = [];
  for (const { pattern, why } of TRACKED_NEVER) {
    if (pattern.test(file)) finds.push({ rule: 'file that must not be tracked', file, line: 0, match: why });
  }
  if (size > BIG_FILE_BYTES) {
    finds.push({ rule: 'large file', file, line: 0, match: `${(size / 1024 / 1024).toFixed(1)} MB` });
  }
  return finds;
}

/** The lines of the private values file; lines shorter than 3 characters are skipped, they would match everywhere. */
function readPrivateValues(file) {
  if (!file) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 3 && !line.startsWith('#'));
}

function listFolder(dir) {
  const out = [];
  const walk = (folder, prefix) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(folder, entry.name), rel);
      else if (entry.isFile()) out.push(rel);
    }
  };
  walk(dir, '');
  return out;
}

/** The tracked files that `git archive` would put into a public copy (`export-ignore` in .gitattributes keeps a file out). */
function listTracked(root) {
  const raw = execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  const files = raw.toString('utf8').split('\0').filter(Boolean);
  let kept = new Set();
  try {
    const attrs = execFileSync('git', ['check-attr', '-z', '--stdin', 'export-ignore'], {
      cwd: root,
      input: raw,
      maxBuffer: 64 * 1024 * 1024,
    })
      .toString('utf8')
      .split('\0');
    // The answer comes in threes: path, attribute, value.
    for (let i = 0; i + 2 < attrs.length; i += 3) if (attrs[i + 2] === 'set') kept.add(attrs[i]);
  } catch {
    kept = new Set();
  }
  return files.filter((file) => !kept.has(file));
}

/** A NUL byte in the first 8000 bytes means binary, the same test git uses. */
function looksBinary(buffer) {
  const end = Math.min(buffer.length, 8000);
  for (let i = 0; i < end; i += 1) if (buffer[i] === 0) return true;
  return false;
}

/** Looks through a whole tree. `files` are paths relative to `root`. */
function scanTree(root, files, privateValues = []) {
  const finds = [];
  for (const file of files) {
    const full = path.join(root, file);
    let buffer;
    try {
      buffer = fs.readFileSync(full);
    } catch {
      continue; // a tracked file removed from the work tree: nothing to read
    }
    finds.push(...scanName(file, buffer.length));
    // The list of installed packages is written by the package manager: addresses of registries only.
    if (file === 'package-lock.json') {
      finds.push(...scanText(file, buffer.toString('utf8'), privateValues).filter((find) => find.rule === 'private value'));
      continue;
    }
    if (looksBinary(buffer)) finds.push(...scanBinary(file, buffer, privateValues));
    else finds.push(...scanText(file, buffer.toString('utf8'), privateValues));
  }
  return finds;
}

/** Hides the middle of a find, so the report does not itself repeat a private value in a CI log. */
function hide(match) {
  if (match.length <= 6) return `${match.slice(0, 1)}…`;
  return `${match.slice(0, 3)}…${match.slice(-2)}`;
}

function main(argv) {
  const args = argv.slice(2);
  const take = (name) => {
    const at = args.indexOf(name);
    return at === -1 ? null : args[at + 1] ?? null;
  };
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(`${fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\*\n?/, '').replace(/^ \* ?/gm, '')}\n`);
    return 0;
  }
  const show = args.includes('--show');
  const dir = take('--dir');
  const valuesFile = take('--values') ?? process.env.PUBLIC_TREE_PRIVATE_VALUES ?? null;
  const root = dir ? path.resolve(dir) : path.join(__dirname, '..');
  // A folder that is a git work tree is read through git (what is staged or tracked there); any other folder as it is.
  const files = !dir || fs.existsSync(path.join(root, '.git')) ? listTracked(root) : listFolder(root);
  const privateValues = readPrivateValues(valuesFile);
  // This script and its test name the patterns they look for.
  const own = new Set(['scripts/public-tree-check.js', 'tests/unit/publicTreeCheck.test.ts']);
  const finds = scanTree(root, files.filter((file) => !own.has(file)), privateValues);

  if (finds.length === 0) {
    process.stdout.write(`Nothing private found in ${files.length} files${privateValues.length ? ` (${privateValues.length} private values looked for)` : ' (no list of private values was given)'}.\n`);
    return 0;
  }
  const byRule = new Map();
  for (const find of finds) byRule.set(find.rule, [...(byRule.get(find.rule) ?? []), find]);
  for (const [rule, list] of byRule) {
    process.stdout.write(`\n${rule}: ${list.length}\n`);
    for (const find of list) {
      const where = find.line > 0 ? `${find.file}:${find.line}` : find.file;
      const what = show || find.line === 0 ? find.match : hide(find.match);
      process.stdout.write(`  ${where}  ${what}\n`);
    }
  }
  process.stdout.write(`\n${finds.length} place(s) to clean before this tree becomes public.\n`);
  return 1;
}

if (require.main === module) process.exit(main(process.argv));

module.exports = { scanText, scanBinary, scanName, scanTree, privateAddress };
