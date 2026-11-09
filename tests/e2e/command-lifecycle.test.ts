import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const DESKTOP = 'desktop';

let electronApp: ElectronApplication;
let window: Page;
let userData: string;

async function dbState(projectId: string) {
  const appRoot = path.join(__dirname, '../..');
  return electronApp.evaluate(async ({ app }, { id, appRoot }) => {
    const nodeModule = process.getBuiltinModule('module');
    const nodePath = process.getBuiltinModule('path');
    const Database = nodeModule.createRequire(nodePath.join(appRoot, 'package.json'))('better-sqlite3');
    const db = new Database(nodePath.join(app.getPath('userData'), 'comfyui-desktop.db'), {
      readonly: true,
      fileMustExist: true,
    });
    const project = db.prepare('SELECT current_revision_id FROM projects WHERE id = ?').get(id) as
      | { current_revision_id: string | null }
      | undefined;
    const revision = project?.current_revision_id
      ? (db.prepare('SELECT rev_seq, nodes FROM graph_revisions WHERE id = ?').get(project.current_revision_id) as {
          rev_seq: number;
          nodes: string;
        })
      : null;
    const runs = db
      .prepare('SELECT run_id, status, base_revision_id, expected_revision_id FROM runs WHERE project_id = ? ORDER BY rowid')
      .all(id);
    const commands = db
      .prepare('SELECT action_id, run_id, actor, payload_canonical, result_revision_id FROM applied_commands WHERE project_id = ?')
      .all(id);
    const revisionCount = db.prepare('SELECT COUNT(*) AS count FROM graph_revisions WHERE project_id = ?').get(id) as { count: number };
    db.close();
    return { project, revision, runs, commands, revisionCount: revisionCount.count };
  }, { id: projectId, appRoot });
}

async function api(method: string, args: unknown[]) {
  return window.evaluate(
    async ({ method, args }) => {
      const bridge = (window as unknown as { electronAPI: Record<string, (...values: unknown[]) => Promise<unknown>> }).electronAPI;
      return bridge[method](...args);
    },
    { method, args },
  );
}

test.beforeAll(async () => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'command-lifecycle-'));
  electronApp = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.locator('#chat-provider').waitFor();
});

test.afterAll(async () => {
  await electronApp?.close();
});

test('IPC scenarios keep one canonical graph', async () => {
  const two = await api('startRun', ['two-tools']);
  const add = await api('commitCommand', [{
    projectId: 'two-tools',
    runId: two.runId,
    actionId: 'add-1',
    expectedRevisionId: two.expectedRevisionId,
    actor: 'ai',
    payload: { type: 'add-node', nodeType: 'TestNode', title: 'AI Test Node', x: 200, y: 200 },
  }]);
  expect(add.status).toBe('applied');
  const note = await api('commitCommand', [{
    projectId: 'two-tools',
    runId: two.runId,
    actionId: 'note-1',
    expectedRevisionId: add.projection.activeRun.expectedRevisionId,
    actor: 'ai',
    payload: { type: 'annotate-node', nodeId: add.result.nodeId, annotation: 'AI added annotation' },
  }]);
  expect(note.status).toBe('applied');
  const twoState = await dbState('two-tools');
  expect(twoState.commands).toHaveLength(2);
  expect(JSON.parse(twoState.revision!.nodes)).toHaveLength(1);
  expect(JSON.parse(twoState.revision!.nodes)[0].data.annotations).toEqual(['AI added annotation']);
  expect(twoState.runs[0].expected_revision_id).toBe(twoState.project!.current_revision_id);

  const before = await api('startRun', ['manual-before']);
  const human = await api('commitCommand', [{
    projectId: 'manual-before',
    runId: null,
    actionId: 'manual-1',
    expectedRevisionId: before.expectedRevisionId,
    actor: 'manual',
    payload: { type: 'add-node', nodeType: 'HumanNode', title: 'Human' },
  }]);
  expect(human.status).toBe('applied');
  const stale = await api('commitCommand', [{
    projectId: 'manual-before',
    runId: before.runId,
    actionId: 'add-1',
    expectedRevisionId: before.expectedRevisionId,
    actor: 'ai',
    payload: { type: 'add-node', nodeType: 'TestNode' },
  }]);
  const fresh = await api('commitCommand', [{
    projectId: 'manual-before',
    runId: before.runId,
    actionId: 'add-2',
    expectedRevisionId: human.projection.currentRevisionId,
    actor: 'ai',
    payload: { type: 'add-node', nodeType: 'TestNode' },
  }]);
  // The person's edit moves the run on: the stale revision conflicts, the current one continues the run.
  expect(stale.status).toBe('conflict');
  expect(human.projection.activeRun.expectedRevisionId).toBe(human.projection.currentRevisionId);
  expect(fresh.status).toBe('applied');
  const beforeState = await dbState('manual-before');
  expect(beforeState.runs[0].expected_revision_id).toBe(fresh.projection.currentRevisionId);
  expect(beforeState.project!.current_revision_id).toBe(fresh.projection.currentRevisionId);
  expect(JSON.parse(beforeState.revision!.nodes)).toHaveLength(2);

  const between = await api('startRun', ['manual-between']);
  const added = await api('commitCommand', [{
    projectId: 'manual-between',
    runId: between.runId,
    actionId: 'add-1',
    expectedRevisionId: between.expectedRevisionId,
    actor: 'ai',
    payload: { type: 'add-node', nodeType: 'TestNode' },
  }]);
  const edited = await api('commitCommand', [{
    projectId: 'manual-between',
    runId: null,
    actionId: 'manual-1',
    expectedRevisionId: added.projection.currentRevisionId,
    actor: 'manual',
    payload: { type: 'annotate-node', nodeId: added.result.nodeId, annotation: 'human note' },
  }]);
  const blockedNote = await api('commitCommand', [{
    projectId: 'manual-between',
    runId: between.runId,
    actionId: 'note-1',
    expectedRevisionId: added.projection.activeRun.expectedRevisionId,
    actor: 'ai',
    payload: { type: 'annotate-node', nodeId: added.result.nodeId, annotation: 'AI added annotation' },
  }]);
  expect(edited.status).toBe('applied');
  expect(blockedNote.status).toBe('conflict');
  const betweenState = await dbState('manual-between');
  expect(JSON.parse(betweenState.revision!.nodes)[0].data.annotations).toEqual(['human note']);

  const switched = await api('startRun', ['switch-left']);
  await api('switchProject', ['switch-left']);
  const afterSwitch = await api('commitCommand', [{
    projectId: 'switch-left',
    runId: switched.runId,
    actionId: 'add-1',
    expectedRevisionId: switched.expectedRevisionId,
    actor: 'ai',
    payload: { type: 'add-node', nodeType: 'TestNode' },
  }]);
  expect(afterSwitch.status).toBe('conflict');
  await api('switchProject', ['desktop']);
  const switchState = await dbState('switch-left');
  expect(switchState.runs[0].status).toBe('closed');
  expect(switchState.commands).toHaveLength(0);
  const otherProject = await api('commitCommand', [{
    projectId: DESKTOP,
    runId: switched.runId,
    actionId: 'add-foreign',
    expectedRevisionId: switched.expectedRevisionId,
    actor: 'ai',
    payload: { type: 'add-node', nodeType: 'TestNode' },
  }]);
  expect(otherProject.status).toBe('rejected');

  const replayRun = await api('startRun', ['replay']);
  const first = await api('commitCommand', [{
    projectId: 'replay',
    runId: replayRun.runId,
    actionId: 'add-1',
    expectedRevisionId: replayRun.expectedRevisionId,
    actor: 'ai',
    payload: { type: 'add-node', nodeType: 'TestNode', title: 'Same' },
  }]);
  await api('cancelRun', ['replay', replayRun.runId]);
  const revisionsBeforeReplay = (await dbState('replay')).revisionCount;
  const historical = await api('commitCommand', [{
    projectId: 'replay',
    runId: replayRun.runId,
    actionId: 'add-1',
    expectedRevisionId: 'stale',
    actor: 'ai',
    payload: { title: 'Same', nodeType: 'TestNode', type: 'add-node' },
  }]);
  expect(historical.status).toBe('historical');
  expect(historical.result).toEqual(first.result);
  expect(historical.projection.currentRevisionId).toBe(first.projection.currentRevisionId);
  expect((await dbState('replay')).revisionCount).toBe(revisionsBeforeReplay);

  const mismatch = await api('commitCommand', [{
    projectId: 'replay',
    runId: replayRun.runId,
    actionId: 'add-1',
    expectedRevisionId: first.projection.currentRevisionId,
    actor: 'ai',
    payload: { type: 'add-node', nodeType: 'TestNode', title: 'Different' },
  }]);
  expect(mismatch.status).toBe('rejected');
  expect(mismatch.result).toBeNull();
  const secondRun = await api('startRun', ['replay']);
  const wrongRun = await api('commitCommand', [{
    projectId: 'replay',
    runId: secondRun.runId,
    actionId: 'add-1',
    expectedRevisionId: secondRun.expectedRevisionId,
    actor: 'ai',
    payload: { type: 'add-node', nodeType: 'TestNode', title: 'Same' },
  }]);
  expect(wrongRun.status).toBe('rejected');

  const left = await api('startRun', ['project-a']);
  const right = await api('startRun', ['project-b']);
  expect((await api('commitCommand', [{
    projectId: 'project-a',
    runId: left.runId,
    actionId: 'shared-action',
    expectedRevisionId: left.expectedRevisionId,
    actor: 'ai',
    payload: { type: 'add-node', nodeType: 'LeftNode' },
  }])).status).toBe('applied');
  expect((await api('commitCommand', [{
    projectId: 'project-b',
    runId: right.runId,
    actionId: 'shared-action',
    expectedRevisionId: right.expectedRevisionId,
    actor: 'ai',
    payload: { type: 'add-node', nodeType: 'RightNode' },
  }])).status).toBe('applied');
  expect((await dbState('project-a')).commands).toHaveLength(1);
  expect((await dbState('project-b')).commands).toHaveLength(1);

  const lost = await api('startRun', ['lost']);
  const committed = await api('commitCommand', [{
    projectId: 'lost',
    runId: lost.runId,
    actionId: 'add-1',
    expectedRevisionId: lost.expectedRevisionId,
    actor: 'ai',
    payload: { type: 'add-node', nodeType: 'TestNode' },
  }]);
  const retry = await api('commitCommand', [{
    projectId: 'lost',
    runId: lost.runId,
    actionId: 'add-1',
    expectedRevisionId: lost.expectedRevisionId,
    actor: 'ai',
    payload: { type: 'add-node', nodeType: 'TestNode' },
  }]);
  expect(retry.status).toBe('historical');
  const lostRead = await api('readProjection', ['lost']);
  const lostState = await dbState('lost');
  expect(lostRead.revSeq).toBe(lostState.revision!.rev_seq);
  expect(lostRead.currentRevisionId).toBe(lostState.project!.current_revision_id);
  expect(lostRead.snapshot.nodes).toHaveLength(1);
  expect(lostRead.activeRun.runId).toBe(lost.runId);
  expect(lostRead.activeRun.expectedRevisionId).toBe(lostRead.currentRevisionId);
  const continued = await api('commitCommand', [{
    projectId: 'lost',
    runId: lost.runId,
    actionId: 'note-1',
    expectedRevisionId: lostRead.activeRun.expectedRevisionId,
    actor: 'ai',
    payload: { type: 'annotate-node', nodeId: committed.result.nodeId, annotation: 'continued' },
  }]);
  expect(continued.status).toBe('applied');

  const paused = await api('startRun', ['pause-first']);
  expect((await api('pauseRun', ['pause-first', paused.runId])).status).toBe('applied');
  expect((await api('commitCommand', [{
    projectId: 'pause-first',
    runId: paused.runId,
    actionId: 'add-1',
    expectedRevisionId: paused.expectedRevisionId,
    actor: 'ai',
    payload: { type: 'add-node', nodeType: 'TestNode' },
  }])).status).toBe('conflict');

  const finished = await api('startRun', ['commit-first']);
  const kept = await api('commitCommand', [{
    projectId: 'commit-first',
    runId: finished.runId,
    actionId: 'add-1',
    expectedRevisionId: finished.expectedRevisionId,
    actor: 'ai',
    payload: { type: 'add-node', nodeType: 'Kept' },
  }]);
  expect(kept.status).toBe('applied');
  expect((await api('pauseRun', ['commit-first', finished.runId])).status).toBe('applied');
  expect((await api('commitCommand', [{
    projectId: 'commit-first',
    runId: finished.runId,
    actionId: 'add-2',
    expectedRevisionId: kept.projection.activeRun.expectedRevisionId,
    actor: 'ai',
    payload: { type: 'add-node', nodeType: 'Late' },
  }])).status).toBe('conflict');
  expect(JSON.parse((await dbState('commit-first')).revision!.nodes).map((node: { data: { comfyType: string } }) => node.data.comfyType)).toEqual(['Kept']);

  const oldRun = await api('startRun', ['resume']);
  await api('pauseRun', ['resume', oldRun.runId]);
  const resumed = await api('resumeRun', ['resume']);
  // Resume reopens the paused run itself.
  expect(resumed.runId).toBe(oldRun.runId);
  const resumeState = await dbState('resume');
  expect(resumeState.runs.map((run: { run_id: string; status: string }) => [run.run_id, run.status])).toEqual([
    [oldRun.runId, 'running'],
  ]);
  expect(resumed.expectedRevisionId).toBe(resumeState.project!.current_revision_id);

  const manualRun = await api('startRun', ['manual-only']);
  const manualOnly = await api('commitCommand', [{
    projectId: 'manual-only',
    runId: null,
    actionId: 'manual-1',
    expectedRevisionId: manualRun.expectedRevisionId,
    actor: 'manual',
    payload: { type: 'add-node', nodeType: 'HumanNode' },
  }]);
  expect(manualOnly.status).toBe('applied');
  expect((await dbState('manual-only')).runs[0].expected_revision_id).toBe(manualOnly.projection.currentRevisionId);
  const disguised = await api('commitCommand', [{
    projectId: 'manual-only',
    runId: manualRun.runId,
    actionId: 'manual-2',
    expectedRevisionId: manualOnly.projection.currentRevisionId,
    actor: 'manual',
    payload: { type: 'add-node', nodeType: 'Nope' },
  }]);
  expect(disguised.status).toBe('rejected');

  const desktopBefore = await window.locator('.react-flow__node').count();
  await api('commitCommand', [{
    projectId: 'project-a',
    runId: left.runId,
    actionId: 'late-foreign',
    expectedRevisionId: (await api('readProjection', ['project-a'])).activeRun.expectedRevisionId,
    actor: 'ai',
    payload: { type: 'add-node', nodeType: 'Foreign' },
  }]);
  expect(await window.locator('.react-flow__node').count()).toBe(desktopBefore);

  const desktopRun = await api('startRun', [DESKTOP]);
  const desktopAdd = await api('commitCommand', [{
    projectId: DESKTOP,
    runId: desktopRun.runId,
    actionId: 'desktop-add',
    expectedRevisionId: desktopRun.expectedRevisionId,
    actor: 'ai',
    payload: { type: 'add-node', nodeType: 'TestNode', title: 'Visible' },
  }]);
  expect(desktopAdd.status).toBe('applied');
  await window.reload();
  await window.locator('#chat-provider').waitFor();
  await expect(window.locator('.react-flow__node')).toHaveCount(1);
  const shown = await api('readProjection', [DESKTOP]);
  const shownState = await dbState(DESKTOP);
  expect(shown.revSeq).toBe(shownState.revision!.rev_seq);
  expect(shown.currentRevisionId).toBe(shownState.project!.current_revision_id);
});
