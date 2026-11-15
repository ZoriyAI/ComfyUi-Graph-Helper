import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parse } from 'yaml';
const { plan, publish, previous, runtime } = createRequire(import.meta.url)('../../scripts/release-plan.js');
const source = 'a'.repeat(40);
const opts = { event: 'push', ref: 'refs/heads/main', version: '0.9.0', source, notes: true, repo: 'owner/repo', recent: true, tag: 'v0.9.0' };
const release = { id: 1, tag_name: 'v0.9.0', draft: false, prerelease: false };
const ref = (sha = source, type = 'commit', tag = 'v0.9.0') => ({ ref: `refs/tags/${tag}`, object: { sha, type } });
function fixture(...responses: unknown[]) {
  const calls: string[][] = [];
  const gh = (args: string[]) => {
    calls.push(args);
    if (!responses.length) throw new Error('Unexpected gh call');
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return typeof response === 'string' ? response : JSON.stringify(response);
  };
  return { gh, calls };
}
describe('release decisions using the publication helper', () => {
  it('publishes a new main version and ignores exact-tag prefix matches', () => {
    const { gh, calls } = fixture([[{ ...release, tag_name: 'v0.9.01' }]], [[ref(source, 'commit', 'v0.9.01')]]);
    expect(plan(opts, gh)).toEqual({ run: true, publish: true, release_tag: 'v0.9.0', source_sha: source });
    expect(calls.every(args => args.includes('--paginate') && args.includes('--slurp'))).toBe(true);
  });
  it('skips published main before reading its historical tag, including later pages', () => {
    const { gh, calls } = fixture([[], [release]]);
    expect(plan(opts, gh)).toMatchObject({ run: false, publish: false });
    expect(calls).toHaveLength(1);
  });
  it('retains plain manual and weekly inactivity behavior without API calls', () => {
    const { gh, calls } = fixture();
    expect(plan({ ...opts, event: 'workflow_dispatch', input: '' }, gh)).toMatchObject({ run: true, publish: false, release_tag: '' });
    expect(plan({ ...opts, event: 'schedule', recent: false }, gh).run).toBe(false);
    expect(plan({ ...opts, event: 'schedule' }, gh).run).toBe(true);
    expect(calls).toHaveLength(0);
  });
  it('keeps explicit manual/tag builds, with matching lightweight or annotated tags', () => {
    expect(plan({ ...opts, event: 'workflow_dispatch', input: 'v0.9.0' }, fixture([[release]], [[ref()]]).gh)).toMatchObject({ run: true, publish: false });
    expect(plan({ ...opts, ref: 'refs/tags/v0.9.0' }, fixture([[]], [[ref('b'.repeat(40), 'tag')]], { sha: 'b'.repeat(40), object: { type: 'commit', sha: source } }).gh).publish).toBe(true);
    expect(() => plan({ ...opts, ref: 'refs/tags/v0.9.0' }, fixture([[]], [[]]).gh)).toThrow('disappeared');
  });
  it('rejects mismatches before reads and conflicts before writes', () => {
    for (const change of [{ input: 'v0.8.0', event: 'workflow_dispatch' }, { notes: false }, { version: '../escape' }, { source: 'main' }]) {
      const { gh, calls } = fixture();
      expect(() => plan({ ...opts, ...change }, gh)).toThrow();
      expect(calls).toHaveLength(0);
    }
    expect(() => plan(opts, fixture([[]], [[ref('b'.repeat(40))]]).gh)).toThrow('tested source');
    expect(() => plan(opts, fixture([[{ ...release, draft: true }]]).gh)).toThrow('Draft');
    expect(() => plan(opts, fixture([[]], [[ref(source, 'tree')]]).gh)).toThrow('object');
    expect(() => plan(opts, fixture([[]], [[ref(source, 'tag')]], { sha: source, object: { type: 'tag', sha: source } }).gh)).toThrow('cycle');
  });
  it('fails closed on command/API, JSON and record errors', () => {
    for (const failure of [new Error('401'), new Error('404'), new Error('429'), new Error('500 on page 2'), new Error('network'), '{broken', {}, [[{}]]]) {
      expect(() => plan(opts, fixture(failure).gh)).toThrow();
    }
    expect(() => plan(opts, fixture([[]], new Error('tag API failed')).gh)).toThrow('tag API');
  });
  it('stops duplicate publication during final rechecks', () => {
    expect(plan({ ...opts, phase: 'recheck' }, fixture([[release]]).gh).publish).toBe(false);
    const late = fixture([[release]]);
    expect(publish(opts, ['release/app.deb'], late.gh)).toBe(false);
    expect(late.calls).toHaveLength(1);
    expect(() => plan({ ...opts, phase: 'recheck' }, fixture([[]], [[ref('b'.repeat(40))]]).gh)).toThrow('tested source');
  });
  it('creates a missing tag once, rereads it and publishes only verified tested source', () => {
    const { gh, calls } = fixture([[]], [[]], {}, [[ref()]], '');
    expect(publish(opts, ['release/app.deb'], gh)).toBe(true);
    expect(calls[2]).toEqual(['api', '--method', 'POST', 'repos/owner/repo/git/refs', '-f', 'ref=refs/tags/v0.9.0', '-f', `sha=${source}`]);
    expect(calls[4]).toEqual(['release', 'create', 'v0.9.0', 'release/app.deb', '--verify-tag', '--repo', 'owner/repo', '--target', source, '--title', 'Graph Helper for ComfyUI v0.9.0', '--notes-file', 'docs/releases/v0.9.0.md']);
    const failed = fixture([[]], [[]], new Error('write failed'));
    expect(() => publish(opts, ['release/app.deb'], failed.gh)).toThrow('write failed');
    expect(failed.calls).toHaveLength(3);
  });
  it('skips upgrade only after proven missing release or asset; download failure fails', () => {
    const old = { ...release, tag_name: 'v0.8.0' };
    expect(previous(opts, fixture([[]]).gh)).toBe('');
    expect(previous(opts, fixture([[old]], [[]]).gh)).toBe('');
    expect(() => previous(opts, fixture(new Error('release API')).gh)).toThrow('release API');
    expect(() => previous(opts, fixture([[old]], new Error('assets API')).gh)).toThrow('assets API');
    expect(() => previous(opts, fixture([[old]], [[{ id: 1, name: 'app.deb' }]], new Error('download failed')).gh)).toThrow('download failed');
    expect(previous({ ...opts, directory: '/tmp/previous' }, fixture([[old]], [[{ id: 1, name: 'app.deb' }]], '').gh)).toBe('v0.8.0');
  });
  it('always pins the runtime and requires paired overrides', () => {
    expect(runtime('', '')).toEqual({ tag: '20251108', sha256: '2fca8b443c92510f1483a883f60061ad09b46b978b2631c807cd873a47ec260d' });
    expect(() => runtime('20251108', '')).toThrow();
    expect(() => runtime('', 'a'.repeat(64))).toThrow();
    expect(() => runtime('20251108', 'a'.repeat(64))).toThrow();
    expect(runtime('custom', 'a'.repeat(64)).tag).toBe('custom');
  });
});
it('retains release gates, permission boundaries and pinned tested source in parsed workflow', () => {
  const workflow = parse(readFileSync('.github/workflows/release.yml', 'utf8'));
  expect(workflow.on.push).toEqual({ branches: ['main'], tags: ['v*'] });
  expect(workflow.on.workflow_dispatch.inputs.release_tag).toBeDefined();
  expect(workflow.on.schedule).toHaveLength(1);
  expect(workflow.permissions).toEqual({ contents: 'read' });
  const { plan: planning, e2e, walks, package: packaging, rpm, release: publishing } = workflow.jobs;
  expect(publishing.needs).toEqual(['plan', 'e2e', 'walks', 'package', 'rpm']);
  expect(publishing.environment).toBe('release');
  expect(publishing.permissions).toEqual({ contents: 'write', 'id-token': 'write', attestations: 'write' });
  expect(publishing.if).toBe("needs.plan.outputs.publish == 'true'");
  expect(publishing.concurrency).toEqual({ group: 'release-${{ needs.plan.outputs.release_tag }}', 'cancel-in-progress': false });
  for (const job of [e2e, walks, packaging, rpm, publishing]) {
    expect(job.steps.find((s: any) => s.uses?.startsWith('actions/checkout')).with).toEqual({ 'persist-credentials': false, ref: '${{ needs.plan.outputs.source_sha }}' });
  }
  for (const job of [e2e, walks, packaging]) expect(job.if).toBe("needs.plan.outputs.run == 'true'");
  expect(rpm.needs).toEqual(['plan', 'package']);
  expect(walks.strategy.matrix.include).toHaveLength(3);
  expect(planning.steps.some((s: any) => s.run === 'node scripts/changelog.js --check')).toBe(true);
  expect(planning.steps.some((s: any) => s.run === 'node scripts/public-tree-check.js')).toBe(true);
  const names = packaging.steps.map((s: any) => s.name).filter(Boolean);
  for (const name of ['Smoke-test every format', 'Desktop entries are valid', 'Shell scripts', 'Lintian', 'Upgrade from the previous release keeps settings and the graph', 'Release files, checksums and the component list']) expect(names).toContain(name);
  expect(names.some((s: string) => s.startsWith('The installed .deb'))).toBe(true);
  const recheck = publishing.steps.findIndex((s: any) => s.id === 'recheck');
  expect(publishing.steps.slice(recheck + 1).every((s: any) => s.if === "steps.recheck.outputs.publish == 'true'")).toBe(true);
  expect(publishing.steps.some((s: any) => s.uses?.startsWith('actions/attest-build-provenance'))).toBe(true);
  expect(publishing.steps.find((s: any) => s.name === 'Checksums still match').run).toContain('sha256sum -c');
});
