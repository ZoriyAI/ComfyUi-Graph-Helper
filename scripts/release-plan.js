/** Release reads fail closed. All gh calls use argv, never shell evaluation. */
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const semver = require('semver');

const SHA = /^[a-f0-9]{40}$/;
const DEFAULT_RUNTIME = { tag: '20251108', sha256: '2fca8b443c92510f1483a883f60061ad09b46b978b2631c807cd873a47ec260d' };
function fail(message) { throw new Error(message); }
function ghRunner(args) { return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
function api(gh, endpoint, paginated = false) {
  const value = JSON.parse(gh(['api', ...(paginated ? ['--paginate', '--slurp'] : []), endpoint]));
  if (!paginated) return value;
  if (!Array.isArray(value) || !value.every(Array.isArray)) fail('Invalid paginated API response');
  return value.flat();
}
function releases(gh, repo) {
  const rows = api(gh, `repos/${repo}/releases?per_page=100`, true);
  for (const row of rows) {
    if (!row || !Number.isSafeInteger(row.id) || row.id <= 0 || typeof row.tag_name !== 'string' || !row.tag_name ||
        typeof row.draft !== 'boolean' || typeof row.prerelease !== 'boolean') fail('Malformed release record');
  }
  return rows;
}
function published(gh, repo, tag) {
  const matches = releases(gh, repo).filter(row => row.tag_name === tag);
  if (matches.some(row => row.draft)) fail(`Draft release conflicts with ${tag}; deliberate recovery is required`);
  if (matches.length > 1) fail(`Duplicate releases for ${tag}`);
  return matches.length === 1;
}
function object(value) {
  if (!value || !SHA.test(value.sha) || !['commit', 'tag'].includes(value.type)) fail('Invalid tag object');
  return value;
}
function tagTarget(gh, repo, tag) {
  const rows = api(gh, `repos/${repo}/git/matching-refs/tags/${encodeURIComponent(tag)}?per_page=100`, true);
  if (!rows.every(row => row && typeof row.ref === 'string' && row.object && typeof row.object.sha === 'string' && typeof row.object.type === 'string')) fail('Malformed tag reference');
  const matches = rows.filter(row => row.ref === `refs/tags/${tag}`);
  if (matches.length > 1) fail('Duplicate exact tag reference');
  if (!matches.length) return null;
  let target = object(matches[0].object);
  const seen = new Set();
  while (target.type === 'tag') {
    if (seen.has(target.sha) || seen.size >= 16) fail('Annotated tag cycle or depth exceeded');
    seen.add(target.sha);
    const annotation = api(gh, `repos/${repo}/git/tags/${target.sha}`);
    if (!annotation || annotation.sha !== target.sha) fail('Malformed annotated tag');
    target = object(annotation.object);
  }
  return target.sha;
}
function validate({ version, source, tag, notes }) {
  if (typeof version !== 'string' || !semver.valid(version) || !/^[0-9][0-9A-Za-z.+-]*$/.test(version)) fail('Invalid package version');
  if (!SHA.test(source)) fail('Expected a full tested commit SHA');
  if (tag && (tag !== `v${version}` || !notes)) fail('Release tag, package version and release notes must agree');
}
function checkTag(gh, options) {
  const target = tagTarget(gh, options.repo, options.tag);
  if (target && target !== options.source) fail(`Tag ${options.tag} does not point to tested source ${options.source}`);
  if (!target && options.event === 'push' && options.ref.startsWith('refs/tags/')) fail('Event tag disappeared');
  return target;
}
function plan(options, gh = ghRunner) {
  const main = options.event === 'push' && options.ref === 'refs/heads/main';
  const tag = main ? `v${options.version}` : options.event === 'push' && options.ref.startsWith('refs/tags/v') ? options.ref.slice(10) : options.event === 'workflow_dispatch' ? options.input || '' : '';
  const opts = { ...options, tag };
  validate(opts);
  const output = { run: !(options.event === 'schedule' && !options.recent), release_tag: tag, publish: false, source_sha: options.source };
  if (!tag) return output;
  const exists = published(gh, options.repo, tag);
  if (exists && (main || options.phase === 'recheck')) return { ...output, run: false };
  checkTag(gh, opts);
  return { ...output, publish: !exists };
}
function publish(options, files, gh = ghRunner) {
  validate(options);
  if (!files.length) fail('No release files');
  // Recheck again immediately before the write, including external writers outside the job lock.
  if (published(gh, options.repo, options.tag)) return false;
  if (!checkTag(gh, options)) {
    gh(['api', '--method', 'POST', `repos/${options.repo}/git/refs`, '-f', `ref=refs/tags/${options.tag}`, '-f', `sha=${options.source}`]);
  }
  if (checkTag(gh, options) !== options.source) fail('Release tag missing after creation');
  gh(['release', 'create', options.tag, ...files, '--verify-tag', '--repo', options.repo, '--target', options.source,
    '--title', `Graph Helper for ComfyUI ${options.tag}`, '--notes-file', `docs/releases/${options.tag}.md`]);
  return true;
}
function previous(options, gh = ghRunner) {
  const release = releases(gh, options.repo).find(row => !row.draft && !row.prerelease && row.tag_name !== options.tag);
  if (!release) return '';
  const assets = api(gh, `repos/${options.repo}/releases/${release.id}/assets?per_page=100`, true);
  if (!assets.every(asset => asset && Number.isSafeInteger(asset.id) && asset.id > 0 && typeof asset.name === 'string' && asset.name)) fail('Malformed release asset');
  if (!assets.some(asset => asset.name.endsWith('.deb'))) return '';
  gh(['release', 'download', release.tag_name, '--repo', options.repo, '--pattern', '*.deb', '--dir', options.directory]);
  return release.tag_name;
}
function runtime(tag, sha256) {
  if (!tag && !sha256) return DEFAULT_RUNTIME;
  if (!tag || !sha256 || !/^[0-9A-Za-z._-]+$/.test(tag) || !/^[a-f0-9]{64}$/.test(sha256)) fail('AppImage runtime overrides require both a safe tag and SHA-256');
  if (tag === DEFAULT_RUNTIME.tag && sha256 !== DEFAULT_RUNTIME.sha256) fail('Default AppImage runtime checksum mismatch');
  return { tag, sha256 };
}
function outputs(values) {
  for (const [key, value] of Object.entries(values)) {
    if (String(value).includes('\n') || String(value).includes('\r')) fail('Invalid output');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}
if (require.main === module) {
  try {
    const phase = process.argv[2];
    if (phase === 'runtime') outputs(runtime(process.env.RUNTIME_TAG, process.env.RUNTIME_SHA256));
    else {
      const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
      const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      if (process.env.SOURCE_SHA && process.env.SOURCE_SHA !== source) fail('Checkout differs from tested source');
      // Validate before constructing any path from package metadata.
      validate({ version, source, tag: '' });
      const opts = { version, source, notes: fs.existsSync(`docs/releases/v${version}.md`), event: process.env.GITHUB_EVENT_NAME,
        ref: process.env.GITHUB_REF || '', input: process.env.RELEASE_INPUT || '', repo: process.env.GITHUB_REPOSITORY,
        tag: process.env.RELEASE_TAG || '', phase,
        recent: !!execFileSync('git', ['log', '--since=8 days ago', '--format=%H', '-1'], { encoding: 'utf8' }).trim() };
      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(opts.repo)) fail('Invalid repository');
      if (phase === 'plan' || phase === 'recheck') {
        const result = plan(opts);
        if (phase === 'recheck' && result.release_tag !== opts.tag) fail('Release candidate changed');
        outputs(result);
        console.log(result.run ? 'Build planned for tested source' : 'No new release or weekly commits; skipped');
      } else if (phase === 'previous') {
        const directory = `${process.env.RUNNER_TEMP}/previous`;
        fs.mkdirSync(directory, { recursive: true });
        outputs({ tag: previous({ ...opts, directory }) });
      } else if (phase === 'publish') {
        publish(opts, fs.readdirSync('release').map(name => `release/${name}`));
      } else fail('Unknown release phase');
    }
  } catch (error) {
    console.error(`Release stopped: ${error.message}`);
    process.exitCode = 1;
  }
}
module.exports = { plan, publish, previous, runtime };
