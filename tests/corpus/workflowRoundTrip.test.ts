/**
 * Corpus round trip: every ComfyUI workflow in the folders named by WORKFLOW_CORPUS goes through the
 * same main-process functions the app uses for "Open a ComfyUI workflow" and "Save workflow for ComfyUI":
 *
 *   ipc.ts importWorkflowDocument -> commitCommand({ payload: { type: 'import-workflow' } }) -> revision row
 *   ipc.ts exportWorkflowDocument -> readProjection(db) -> exportWorkflow(snapshot, now, readCatalog(db))
 *
 * and is compared with the original (see workflowDiff.ts for what is normalised).
 * The second suite edits an imported workflow the way the canvas and the assistant do (move, set a
 * value, remove a node, reroute a link, add and link a node) and checks that the export carries
 * exactly that change.
 *
 * Run:  WORKFLOW_CORPUS=/path/a:/path/b [WORKFLOW_CORPUS_REPORT=/path/report.json] npx vitest run tests/corpus
 * Without WORKFLOW_CORPUS the suite is skipped, so CI stays green without the corpora.
 * The corpus files are only read as JSON.
 */
import * as fs from 'fs';
import * as path from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { readCatalog, upsertObjectInfo } from '../../src/main/catalog/repository';
import { migrate } from '../../src/main/settings/migrate';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { classifyWorkflow, exportWorkflow, type GraphSnapshot } from '../../src/shared/workflow/codec';
import { diffJson, isAcceptable, lossOnly, short, type Difference } from './workflowDiff';

const EXPORTED_AT = '2026-11-14T00:00:00.000Z';
const dirs = (process.env.WORKFLOW_CORPUS ?? '').split(path.delimiter).filter(Boolean);
const reportPath = process.env.WORKFLOW_CORPUS_REPORT;

type Json = Record<string, any>;

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) out.push(full);
  }
  return out;
}

interface CorpusFile {
  file: string;
  name: string;
  document: Json;
}

function loadCorpus(): { workflows: CorpusFile[]; apiPrompts: string[]; other: string[]; unreadable: string[] } {
  const workflows: CorpusFile[] = [];
  const apiPrompts: string[] = [];
  const other: string[] = [];
  const unreadable: string[] = [];
  for (const dir of dirs) {
    for (const file of walk(dir).sort()) {
      let document: unknown;
      try {
        document = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        unreadable.push(file);
        continue;
      }
      if (document && typeof document === 'object' && !Array.isArray(document) && Array.isArray((document as Json).nodes)) {
        workflows.push({ file, name: `${path.basename(dir)}/${path.relative(dir, file)}`, document: document as Json });
      } else if (classifyWorkflow(document) === 'api-prompt') {
        apiPrompts.push(file);
      } else {
        other.push(file);
      }
    }
  }
  return { workflows, apiPrompts, other, unreadable };
}

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

let actionSeq = 0;
function commit(db: Database.Database, payload: Record<string, unknown>) {
  const current = readProjection(db, DESKTOP_PROJECT_ID)!;
  actionSeq += 1;
  return commitCommand(db, {
    projectId: DESKTOP_PROJECT_ID,
    actionId: `corpus-${actionSeq}`,
    expectedRevisionId: current.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload,
  });
}

/** The exact export path of ipc.ts exportWorkflowDocument, with a fixed clock. */
function exportFromDb(db: Database.Database) {
  const projection = readProjection(db, DESKTOP_PROJECT_ID)!;
  return exportWorkflow(projection.snapshot as GraphSnapshot, EXPORTED_AT, readCatalog(db));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** The original as ComfyUI would hold it after the app saved it: only extra.info.modified moves. */
function expectedUnchanged(document: Json): Json {
  const copy = clone(document);
  if (copy.extra?.info && typeof copy.extra.info === 'object') copy.extra.info.modified = EXPORTED_AT;
  return copy;
}

interface LinkView {
  id: number;
  origin: unknown;
  originSlot: number;
  target: unknown;
  targetSlot: number;
  type: unknown;
}

function linkView(link: unknown): LinkView | null {
  if (Array.isArray(link)) return { id: link[0], origin: link[1], originSlot: link[2], target: link[3], targetSlot: link[4], type: link[5] };
  if (link && typeof link === 'object') {
    const record = link as Json;
    return { id: record.id, origin: record.origin_id, originSlot: record.origin_slot, target: record.target_id, targetSlot: record.target_slot, type: record.type };
  }
  return null;
}

function setLinkTarget(link: any, target: unknown, slot: number): void {
  if (Array.isArray(link)) {
    link[3] = target;
    link[4] = slot;
  } else {
    link.target_id = target;
    link.target_slot = slot;
  }
}

function plainType(type: unknown): type is string {
  return typeof type === 'string' && type !== '' && type !== '*' && !type.includes(',');
}

function compare(label: string, expected: Json, actual: Json, problems: string[], classes: Map<string, Difference>): void {
  const differences = diffJson(expected, actual);
  for (const difference of lossOnly(differences)) {
    const key = `${label}: ${difference.cls}`;
    if (!classes.has(key)) classes.set(key, difference);
    problems.push(`${label}: ${difference.cls} at ${difference.path}: ${short(difference.before, 80)} -> ${short(difference.after, 80)}`);
  }
}

// ---------------------------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------------------------

interface FileReport {
  file: string;
  format: string;
  nodes: number;
  links: number;
  subgraphs: number;
  bytes: number;
  importMs: number;
  exportMs: number;
  status: 'pass' | 'loss' | 'rejected' | 'crash' | 'export-refused';
  error?: string;
  classes: string[];
  acceptable: string[];
  special: Record<string, number>;
  edits: Record<string, string>;
  /** What the app tells the person on import: node types it reports as missing. */
  missingNodes: string[];
}

const report: { files: FileReport[]; apiPrompts: string[]; other: string[]; unreadable: string[] } = {
  files: [],
  apiPrompts: [],
  other: [],
  unreadable: [],
};
const byFile = new Map<string, FileReport>();

function specialCounts(document: Json): Record<string, number> {
  const counts: Record<string, number> = {};
  const subgraphIds = new Set(
    (Array.isArray(document.definitions?.subgraphs) ? document.definitions.subgraphs : []).map((item: Json) => item?.id),
  );
  const bump = (key: string) => {
    counts[key] = (counts[key] ?? 0) + 1;
  };
  for (const node of document.nodes as Json[]) {
    const type = String(node?.type);
    if (type === 'Reroute') bump('Reroute');
    else if (type === 'PrimitiveNode') bump('PrimitiveNode');
    else if (type === 'Note' || type === 'MarkdownNote') bump('Note');
    else if (type === 'SetNode' || type === 'GetNode') bump('Set/Get');
    else if (type.startsWith('workflow>') || type.startsWith('workflow/')) bump('groupNode');
    else if (subgraphIds.has(type)) bump('subgraphInstance');
    if (node?.mode === 2) bump('muted');
    if (node?.mode === 4) bump('bypassed');
    if (node?.widgets_values && typeof node.widgets_values === 'object' && !Array.isArray(node.widgets_values)) bump('dictWidgets');
    if (Array.isArray(node?.inputs) && node.inputs.some((input: Json) => input?.widget)) bump('widgetInputs');
    if (node?.flags?.collapsed) bump('collapsed');
    if (node?.flags?.pinned) bump('pinned');
  }
  return counts;
}

afterAll(() => {
  if (dirs.length === 0) return;
  const files = report.files;
  const pass = files.filter((item) => item.status === 'pass').length;
  const editsPass = files.filter((item) => Object.values(item.edits).every((value) => value === 'pass' || value.startsWith('skip'))).length;
  const slowest = [...files].sort((a, b) => b.importMs + b.exportMs - (a.importMs + a.exportMs)).slice(0, 5);
  const largest = [...files].sort((a, b) => b.nodes - a.nodes).slice(0, 5);
  const classCount = new Map<string, number>();
  for (const item of files) for (const cls of new Set(item.classes)) classCount.set(cls, (classCount.get(cls) ?? 0) + 1);
  const lines = [
    `[corpus] workflows ${files.length}, round trip lossless ${pass}/${files.length}, edits clean ${editsPass}/${files.length}`,
    `[corpus] api prompts ${report.apiPrompts.length}, other json ${report.other.length}, unreadable ${report.unreadable.length}`,
    ...[...classCount.entries()].sort((a, b) => b[1] - a[1]).map(([cls, count]) => `[corpus]   ${count} files: ${cls}`),
    ...largest.map((item) => `[corpus] largest ${item.nodes} nodes ${item.links} links ${item.subgraphs} subgraphs ${(item.bytes / 1024).toFixed(0)} KiB ${path.basename(item.file)}`),
    ...slowest.map((item) => `[corpus] slowest import ${item.importMs.toFixed(1)} ms export ${item.exportMs.toFixed(1)} ms ${path.basename(item.file)}`),
  ];
  console.log(lines.join('\n'));
  if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
});

// ---------------------------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------------------------

const corpus = dirs.length > 0 ? loadCorpus() : { workflows: [], apiPrompts: [], other: [], unreadable: [] };
report.apiPrompts = corpus.apiPrompts;
report.other = corpus.other;
report.unreadable = corpus.unreadable;
const cases = corpus.workflows;

describe.skipIf(dirs.length === 0)('corpus round trip: import then export changes nothing', () => {
  it.each(cases)('$name', ({ file, document }) => {
    const db = openDb();
    const entry: FileReport = {
      file,
      format: classifyWorkflow(document),
      nodes: document.nodes.length,
      links: Array.isArray(document.links) ? document.links.length : 0,
      subgraphs: Array.isArray(document.definitions?.subgraphs) ? document.definitions.subgraphs.length : 0,
      bytes: fs.statSync(file).size,
      importMs: 0,
      exportMs: 0,
      status: 'pass',
      classes: [],
      acceptable: [],
      special: specialCounts(document),
      edits: {},
      missingNodes: [],
    };
    report.files.push(entry);
    byFile.set(file, entry);
    try {
      const started = performance.now();
      const imported = commit(db, { type: 'import-workflow', document: clone(document) });
      entry.importMs = performance.now() - started;
      entry.missingNodes = ((imported.result ?? {}) as { missingNodes?: string[] }).missingNodes ?? [];
      if (imported.status !== 'applied') {
        entry.status = 'rejected';
        entry.error = short(imported.result);
        expect.fail(`import ${imported.status}: ${entry.error}`);
      }
      const exportStart = performance.now();
      const exported = exportFromDb(db);
      entry.exportMs = performance.now() - exportStart;
      if (!exported.ok) {
        entry.status = 'export-refused';
        entry.error = exported.error;
        expect.fail(`export refused: ${exported.error}`);
      }
      const differences = diffJson(expectedUnchanged(document), JSON.parse(JSON.stringify(exported.workflow)));
      entry.acceptable = [...new Set(diffJson(document, exported.workflow).filter(isAcceptable).map((item) => item.cls))];
      const loss = lossOnly(differences);
      entry.classes = [...new Set(loss.map((item) => item.cls))];
      if (loss.length > 0) {
        entry.status = 'loss';
        const sample = loss.slice(0, 8).map((item) => `${item.cls} at ${item.path}: ${short(item.before, 60)} -> ${short(item.after, 60)}`);
        expect.fail(`${loss.length} differences\n${sample.join('\n')}`);
      }
    } catch (error) {
      if (entry.status === 'pass') {
        entry.status = 'crash';
        entry.error = error instanceof Error ? error.message : String(error);
      }
      throw error;
    } finally {
      db.close();
    }
  });
});

const PROBE_TYPE = 'CorpusProbeNode';

function probeCatalog(db: Database.Database, inputType: string): void {
  upsertObjectInfo(db, parseObjectInfo({
    [PROBE_TYPE]: {
      input: { required: { value: [inputType] } },
      input_order: { required: ['value'] },
      output: [],
      output_name: [],
      name: PROBE_TYPE,
      display_name: 'Probe',
      description: '',
      python_module: 'custom_nodes.corpus_probe',
      category: 'probe',
      output_node: true,
    },
  }));
}

describe.skipIf(dirs.length === 0)('corpus edits: a change made in the app exports as only that change', () => {
  it.each(cases)('$name', ({ file, document }) => {
    const entry = byFile.get(file);
    const edits: Record<string, string> = {};
    const problems: string[] = [];
    const classes = new Map<string, Difference>();
    const nodes = document.nodes as Json[];
    const links = (Array.isArray(document.links) ? document.links : []) as unknown[];
    const fresh = () => {
      const db = openDb();
      const imported = commit(db, { type: 'import-workflow', document: clone(document) });
      if (imported.status !== 'applied') throw new Error(`import ${imported.status}`);
      return db;
    };
    const run = (name: string, body: () => string[] | 'skip') => {
      try {
        const outcome = body();
        if (outcome === 'skip') {
          edits[name] = 'skip: no suitable node';
          return;
        }
        edits[name] = outcome.length === 0 ? 'pass' : outcome[0];
        problems.push(...outcome.map((item) => `${name}: ${item}`));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        edits[name] = `crash: ${message}`;
        problems.push(`${name}: crash ${message}`);
      }
    };
    if (classifyWorkflow(document) === 'unknown') {
      if (entry) entry.edits = { all: 'skip: import rejected' };
      return;
    }

    run('move', () => {
      const index = nodes.findIndex((node) => Array.isArray(node?.pos));
      if (index < 0) return 'skip';
      const db = fresh();
      const node = nodes[index];
      const x = Number(node.pos[0]) + 37;
      const y = Number(node.pos[1]) + 11;
      const moved = commit(db, { type: 'move-node', nodeId: String(node.id), x, y });
      if (moved.status !== 'applied') return [`move ${moved.status}`];
      const exported = exportFromDb(db);
      db.close();
      if (!exported.ok) return [`export refused: ${exported.error}`];
      const expected = expectedUnchanged(document);
      expected.nodes[index].pos[0] = x;
      expected.nodes[index].pos[1] = y;
      const local: string[] = [];
      compare('move', expected, exported.workflow, local, classes);
      return local;
    });

    run('set-value-array', () => {
      const db = fresh();
      const catalogTypes = new Set(readCatalog(db).nodeTypes);
      const index = nodes.findIndex((node) => Array.isArray(node?.widgets_values)
        && node.widgets_values.length > 0
        && !catalogTypes.has(node.type)
        && (typeof node.widgets_values[0] === 'string' || typeof node.widgets_values[0] === 'number'));
      if (index < 0) {
        db.close();
        return 'skip';
      }
      const before = nodes[index].widgets_values[0];
      const value = typeof before === 'number' ? before + 1 : `${before}-changed`;
      const changed = commit(db, { type: 'set-parameter', nodeId: String(nodes[index].id), key: 'probe', value, widgetIndex: 0 });
      if (changed.status !== 'applied') {
        db.close();
        return [`set-parameter ${changed.status} ${short(changed.result)}`];
      }
      const exported = exportFromDb(db);
      db.close();
      if (!exported.ok) return [`export refused: ${exported.error}`];
      const expected = expectedUnchanged(document);
      expected.nodes[index].widgets_values[0] = value;
      const local: string[] = [];
      compare('set-value-array', expected, exported.workflow, local, classes);
      return local;
    });

    run('set-value-dict', () => {
      const index = nodes.findIndex((node) => node?.widgets_values && typeof node.widgets_values === 'object'
        && !Array.isArray(node.widgets_values)
        && Object.values(node.widgets_values).some((value) => typeof value === 'string' || typeof value === 'number'));
      if (index < 0) return 'skip';
      const widgets = nodes[index].widgets_values as Json;
      const key = Object.keys(widgets).find((name) => typeof widgets[name] === 'string' || typeof widgets[name] === 'number')!;
      const value = typeof widgets[key] === 'number' ? widgets[key] + 1 : `${widgets[key]}-changed`;
      const db = fresh();
      const changed = commit(db, { type: 'set-parameter', nodeId: String(nodes[index].id), key, value });
      if (changed.status !== 'applied') {
        db.close();
        return [`set-parameter ${changed.status} ${short(changed.result)}`];
      }
      const exported = exportFromDb(db);
      db.close();
      if (!exported.ok) return [`export refused: ${exported.error}`];
      const expected = expectedUnchanged(document);
      expected.nodes[index].widgets_values[key] = value;
      const local: string[] = [];
      compare('set-value-dict', expected, exported.workflow, local, classes);
      return local;
    });

    run('remove-node', () => {
      const views = links.map(linkView);
      const index = nodes.findIndex((node) => views.some((link) => link && String(link.target) === String(node?.id))
        && views.some((link) => link && String(link.origin) === String(node?.id)));
      if (index < 0) return 'skip';
      const node = nodes[index];
      const db = fresh();
      const removed = commit(db, { type: 'remove-node', nodeId: String(node.id) });
      if (removed.status !== 'applied') {
        db.close();
        return [`remove ${removed.status}`];
      }
      const exported = exportFromDb(db);
      db.close();
      if (!exported.ok) return [`export refused: ${exported.error}`];
      const expected = expectedUnchanged(document);
      const gone = new Set(views.filter((link) => link && (String(link.origin) === String(node.id) || String(link.target) === String(node.id))).map((link) => link!.id));
      expected.nodes.splice(index, 1);
      expected.links = expected.links.filter((link: unknown) => !gone.has(linkView(link)?.id as number));
      for (const other of expected.nodes as Json[]) {
        for (const input of Array.isArray(other.inputs) ? other.inputs : []) {
          if (input && gone.has(input.link)) input.link = null;
        }
        for (const output of Array.isArray(other.outputs) ? other.outputs : []) {
          if (output && Array.isArray(output.links)) output.links = output.links.filter((id: number) => !gone.has(id));
        }
      }
      const local: string[] = [];
      compare('remove-node', expected, exported.workflow, local, classes);
      return local;
    });

    run('reroute-link', () => {
      const views = links.map(linkView);
      for (let linkIndex = 0; linkIndex < views.length; linkIndex += 1) {
        const link = views[linkIndex];
        if (!link) continue;
        const origin = nodes.find((node) => String(node?.id) === String(link.origin));
        const output = Array.isArray(origin?.outputs) ? origin!.outputs[link.originSlot] : null;
        if (!output || !plainType(output.type)) continue;
        for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
          const node = nodes[nodeIndex];
          if (!node || String(node.id) === String(link.target) || String(node.id) === String(link.origin)) continue;
          const inputs = Array.isArray(node.inputs) ? node.inputs : [];
          const slot = inputs.findIndex((input: Json) => input && input.link == null && input.type === output.type && input.slot_index === undefined);
          if (slot < 0) continue;
          const db = fresh();
          const moved = commit(db, { type: 'retarget-edge', edgeId: `link-${link.id}`, target: String(node.id), targetHandle: `in-${slot}` });
          if (moved.status !== 'applied') {
            // The app refused this pair (its port types differ from the file's slot types): try the next one.
            db.close();
            continue;
          }
          const exported = exportFromDb(db);
          db.close();
          if (!exported.ok) return [`export refused: ${exported.error}`];
          const expected = expectedUnchanged(document);
          setLinkTarget(expected.links[linkIndex], node.id, slot);
          const oldTarget = (expected.nodes as Json[]).find((item) => String(item.id) === String(link.target));
          const oldInput = oldTarget?.inputs?.[link.targetSlot];
          if (oldInput && oldInput.link === link.id) oldInput.link = null;
          expected.nodes[nodeIndex].inputs[slot].link = link.id;
          const local: string[] = [];
          compare('reroute-link', expected, exported.workflow, local, classes);
          return local;
        }
      }
      return 'skip';
    });

    run('add-and-link', () => {
      let originIndex = -1;
      let slot = -1;
      for (let index = 0; index < nodes.length && originIndex < 0; index += 1) {
        const outputs = Array.isArray(nodes[index]?.outputs) ? nodes[index].outputs : [];
        const found = outputs.findIndex((output: Json, position: number) => output && plainType(output.type)
          && (output.slot_index === undefined || output.slot_index === position));
        if (found >= 0) {
          originIndex = index;
          slot = found;
        }
      }
      if (originIndex < 0) return 'skip';
      const origin = nodes[originIndex];
      const type = origin.outputs[slot].type as string;
      const db = fresh();
      probeCatalog(db, type);
      const added = commit(db, { type: 'add-node', nodeType: PROBE_TYPE, title: 'Probe', x: 5, y: 7 });
      if (added.status !== 'applied') {
        db.close();
        return [`add ${added.status} ${short(added.result)}`];
      }
      const newId = (added.result as { nodeId: string }).nodeId;
      const linked = commit(db, { type: 'connect', source: String(origin.id), sourceHandle: `out-${slot}`, target: newId, targetHandle: 'in-0' });
      if (linked.status !== 'applied') {
        db.close();
        return [`connect ${linked.status} ${short(linked.result)}`];
      }
      const exported = exportFromDb(db);
      db.close();
      if (!exported.ok) return [`export refused: ${exported.error}`];
      const workflow = exported.workflow as Json;
      const local: string[] = [];
      const added_ = (workflow.nodes as Json[])[nodes.length];
      const newLink = linkView((workflow.links as unknown[])[links.length]);
      if (!added_) return ['the added node is not in the export'];
      if (!newLink) return ['the new link is not in the export'];
      const lastNode = workflow.version === 1 ? workflow.state?.lastNodeId : workflow.last_node_id;
      const lastLink = workflow.version === 1 ? workflow.state?.lastLinkId : workflow.last_link_id;
      if (typeof added_.id !== 'number') local.push(`added node id is not a number: ${short(added_.id)}`);
      else if (typeof lastNode === 'number' && added_.id > lastNode) local.push('last_node_id is lower than the added node id');
      if (nodes.some((node) => node?.id === added_.id)) local.push('added node id collides with an existing node');
      if (typeof newLink.id !== 'number' || (typeof lastLink === 'number' && newLink.id > lastLink)) local.push('new link id is not counted in last_link_id');
      if (newLink.target !== added_.id) local.push(`link target ${short(newLink.target)} is not the added node id ${short(added_.id)}`);
      if (!Array.isArray(added_.inputs) || added_.inputs[0]?.link !== newLink.id) local.push('added node has no input slot holding the new link');
      else if (added_.inputs[0].name !== 'value' || added_.inputs[0].type !== type) local.push('added node input slot has the wrong name or type');
      if (!Array.isArray(added_.outputs)) local.push('added node has no outputs array');
      if (typeof added_.order !== 'number') local.push('added node has no order');
      if (!added_.properties || typeof added_.properties !== 'object') local.push('added node has no properties');
      const exportedOrigin = (workflow.nodes as Json[])[originIndex];
      if (!exportedOrigin.outputs[slot].links?.includes(newLink.id)) local.push('origin output does not list the new link');
      // Everything else stays as it was.
      const expected = expectedUnchanged(document);
      const rest = clone(workflow);
      rest.nodes.splice(nodes.length, 1);
      rest.links.splice(links.length, 1);
      const restOrigin = rest.nodes[originIndex];
      restOrigin.outputs[slot].links = (restOrigin.outputs[slot].links ?? []).filter((id: unknown) => id !== newLink.id);
      if (expected.nodes[originIndex].outputs[slot].links == null && restOrigin.outputs[slot].links.length === 0) {
        restOrigin.outputs[slot].links = expected.nodes[originIndex].outputs[slot].links;
      }
      for (const key of ['last_node_id', 'last_link_id']) if (key in expected) rest[key] = expected[key];
      if (expected.state) rest.state = { ...rest.state, lastNodeId: expected.state.lastNodeId, lastLinkId: expected.state.lastLinkId };
      compare('add-and-link', expected, rest, local, classes);
      return local;
    });

    if (entry) entry.edits = edits;
    if (problems.length > 0) expect.fail(problems.slice(0, 10).join('\n'));
  });
});
