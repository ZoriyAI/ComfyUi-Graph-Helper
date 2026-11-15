/**
 * The assistant's draftLesson tool. With the fake model server (tests/fixtures/llm) a whole turn runs: the model
 * drafts a lesson that lacks the words of a step, the app refuses it with the reason, the model drafts it again,
 * and the corrected draft waits as a card; nothing is in My lessons until the person accepts. The tool itself is
 * also held to the format, the installed classes, the try from an empty canvas and the content of its description.
 */

import Database from 'better-sqlite3';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { runAgentTurn } from '../../../src/main/agent/turn';
import { mainLLMService } from '../../../src/main/llmService';
import { ensureWorkspace, startRun } from '../../../src/main/commands/commit';
import { migrate } from '../../../src/main/settings/migrate';
import { upsertObjectInfo } from '../../../src/main/catalog/repository';
import { nodeClassDetail } from '../../../src/main/knowledge/repository';
import { createLessonDraftTool } from '../../../src/main/agent/lessonDraftTool';
import { MAIN_TOOL_SPECS } from '../../../src/main/agent/toolSpecs';
import { LessonDrafts, lessonDrafts } from '../../../src/main/lessons/drafts';
import { parseObjectInfo } from '../../../src/shared/catalog/objectInfo';
import { DESKTOP_PROJECT_ID } from '../../../src/shared/project';
import { startFakeLlm, FAKE_MODEL, type FakeLlm } from '../../fixtures/llm/fakeLlmServer';
import { fakeKnowledge, fakeProposals } from './fakes';
import { sampleDoc } from '../../fixtures/lessons/sampleLesson';

function openDb(withCatalog: boolean): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  if (withCatalog) {
    upsertObjectInfo(db, parseObjectInfo({
      CheckpointLoaderSimple: { input: { required: { ckpt_name: [['juggernautXL_v9.safetensors']] } }, output: ['MODEL', 'CLIP', 'VAE'], output_name: ['MODEL', 'CLIP', 'VAE'], display_name: 'Load Checkpoint', category: 'loaders', python_module: 'nodes' },
      KSampler: { input: { required: { model: ['MODEL'], steps: ['INT', { default: 20, min: 1, max: 10000 }] } }, output: ['LATENT'], output_name: ['LATENT'], display_name: 'KSampler', category: 'sampling', python_module: 'nodes' },
    }));
    // As after a sync: the catalog counts as read, so a class it lacks is not installed.
    db.prepare('UPDATE node_catalog SET synced_at = 1').run();
  }
  return db;
}

const run = (tool: ReturnType<typeof createLessonDraftTool>, lesson: unknown) => tool.execute({ lesson }) as Promise<Record<string, unknown>>;

describe('the draftLesson tool', () => {
  it('tells the model the format and the content rules, and asks for no explicit text', () => {
    const description = MAIN_TOOL_SPECS.draftLesson.description;
    for (const words of ['texts.en', 'roles', 'links', 'fields', 'prefer', '{role}', 'intro', '18+', 'consent', 'technique', 'minors', 'no explicit example prompts', 'nothing is saved without them']) {
      expect(description, words).toContain(words);
    }
  });

  it('shows a draft that reads and can be done with the classes of this ComfyUI, and keeps nothing', async () => {
    const db = openDb(true);
    const drafts = new LessonDrafts();
    const tool = createLessonDraftTool({ db, nodeClassDetail, drafts });
    const result = await run(tool, sampleDoc());
    expect(result).toMatchObject({ success: true, title: 'A first lesson', steps: 3, triedWith: 'catalog' });
    expect(drafts.get(String(result.lessonDraftId))?.doc.id).toBe('my-first');
  });

  it('drafts a lesson with a checklist, a rubric and a quiz, and refuses one whose question has no words', async () => {
    const description = MAIN_TOOL_SPECS.draftLesson.description;
    for (const words of ['checklist', 'rubric', 'quiz', 'run: true', 'transfer: true', 'own word']) expect(description, words).toContain(words);
    const db = openDb(true);
    const drafts = new LessonDrafts();
    const tool = createLessonDraftTool({ db, nodeClassDetail, drafts });
    const doc = sampleDoc();
    doc.steps.push(
      { id: 'run', checklist: [{ id: 'ran', run: true }] },
      { id: 'look', rubric: [{ id: 'fit', levels: ['no', 'yes'] }] },
      { id: 'recall', quiz: [{ id: 'q', choices: ['a', 'b'], answer: 'a' }] },
    );
    Object.assign(doc.texts.en!.steps, {
      run: { title: 'Run it', body: 'Run the workflow in ComfyUI.', items: { ran: { label: 'I ran it.' } } },
      look: { title: 'Look', body: 'Your own assessment.', criteria: { fit: { title: 'It fits.', levels: { no: 'No', yes: 'Yes' } } } },
      recall: { title: 'Check yourself', body: 'One question.', questions: { q: { text: 'Which?', choices: { a: 'A', b: 'B' }, explain: 'A, because.' } } },
    });
    const result = await run(tool, doc);
    expect(result).toMatchObject({ success: true, steps: 6 });
    expect(drafts.get(String(result.lessonDraftId))?.doc.steps.at(-1)).toEqual({ id: 'recall', quiz: [{ id: 'q', choices: ['a', 'b'], answer: 'a' }] });
    delete (doc.texts.en!.steps.recall as { questions?: unknown }).questions;
    expect(await run(tool, doc)).toMatchObject({ success: false, error: expect.stringContaining('the question "q" lacks its text') });
    // A secret in the words of an item is found too.
    const secret = sampleDoc({ id: 'my-secret' });
    secret.steps.push({ id: 'run', checklist: [{ id: 'ran' }] });
    Object.assign(secret.texts.en!.steps, { run: { title: 'Run', body: 'Run it.', items: { ran: { label: 'Use the key sk-proj-abcdefghijklmnopqrstuvwxyz0123456789ABCD.' } } } });
    expect(await run(tool, secret)).toMatchObject({ success: false, error: expect.stringContaining('secret') });
  });

  it('refuses a class this ComfyUI does not have, a broken lesson, a secret, and a step that cannot be done', async () => {
    const db = openDb(true);
    const drafts = new LessonDrafts();
    const tool = createLessonDraftTool({ db, nodeClassDetail, drafts });
    const missing = sampleDoc();
    missing.steps[2].roles![0].classes = ['KSamplerTurbo'];
    expect(await run(tool, missing)).toMatchObject({ success: false, error: expect.stringContaining('KSamplerTurbo') });
    expect(await run(tool, { ...sampleDoc(), steps: 'none' })).toMatchObject({ success: false, error: expect.stringContaining('format') });
    expect(await run(tool, undefined)).toMatchObject({ success: false });
    const secret = sampleDoc();
    secret.texts.en!.steps.intro.body = 'Use the key sk-proj-abcdefghijklmnopqrstuvwxyz0123456789ABCD.';
    expect(await run(tool, secret)).toMatchObject({ success: false, error: expect.stringContaining('secret') });
    const impossible = sampleDoc();
    impossible.steps[2].fields!.push({ role: 'sampler', field: 'steps', test: { kind: 'equals', value: 5 } });
    expect(await run(tool, impossible)).toMatchObject({ success: false, error: expect.stringContaining('"sampler" cannot be done') });
    const noPort = sampleDoc();
    noPort.steps[2].links![0].input = 'not_an_input';
    expect(await run(tool, noPort)).toMatchObject({ success: false, error: expect.stringContaining('cannot be done') });
    expect(drafts.get('anything')).toBeNull();
  });

  it('tries a draft against its own promises before ComfyUI is read, and says so', async () => {
    const db = openDb(false);
    const tool = createLessonDraftTool({ db, nodeClassDetail, drafts: new LessonDrafts() });
    expect(await run(tool, sampleDoc())).toMatchObject({ success: true, triedWith: 'lesson' });
  });

  it('shows nothing once the turn is cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const tool = createLessonDraftTool({ db: openDb(true), nodeClassDetail, signal: controller.signal, drafts: new LessonDrafts() });
    expect(await run(tool, sampleDoc())).toMatchObject({ success: false });
  });
});

describe('a turn with the fake model server', () => {
  let llm: FakeLlm;
  beforeAll(async () => {
    // A large window: a small one gets the reduced tool set, which leaves drafting lessons out.
    llm = await startFakeLlm(131072);
  });
  afterAll(async () => {
    await llm.close();
  });
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mainLLMService.setConfig({ provider: 'local', baseURL: `${llm.origin}/v1`, model: FAKE_MODEL });
  });
  afterEach(() => {
    mainLLMService.setConfig({ provider: '' });
    vi.restoreAllMocks();
  });

  it('drafts, is refused with the reason, drafts again, and the draft waits for the person', async () => {
    const db = openDb(true);
    const started = startRun(db, DESKTOP_PROJECT_ID);
    const chunks: Array<{ type: string; content?: any }> = [];
    await runAgentTurn({
      db,
      messages: [{ role: 'system', content: 'renderer system text' }, { role: 'user', content: 'Please draft a lesson from my graph.' }],
      toolSpecs: [],
      run: { projectId: DESKTOP_PROJECT_ID, runId: started.runId, expectedRevisionId: started.expectedRevisionId },
      language: 'en',
      send: (chunk) => chunks.push(chunk),
      notify: () => undefined,
      // The person's own server with a large window: the full tool set, drafting lessons included.
      llm: {
        nativeSearchTool: () => mainLLMService.nativeSearchTool(),
        streamChatWithTools: (messages: any[], tools: Record<string, any>, options?: any) => mainLLMService.streamChatWithTools(messages, tools, options),
        localContextTokens: () => 131072,
      } as never,
      knowledge: { ...fakeKnowledge(), nodeClassDetail },
      proposals: fakeProposals(),
      fetchImpl: async () => { throw new Error('no network in unit tests'); },
    });

    const results = chunks.filter((chunk) => chunk.type === 'tool-result').map((chunk) => chunk.content);
    const outputs = results.map((item) => item?.output ?? item?.result ?? item);
    expect(outputs).toHaveLength(2);
    expect(JSON.stringify(outputs[0])).toContain('Step \\"sampler\\" has no title and body');
    expect(outputs[1]).toMatchObject({ success: true, title: 'A loader and a sampler', triedWith: 'catalog' });
    const draft = lessonDrafts.get(String(outputs[1].lessonDraftId));
    expect(draft?.doc.id).toBe('loader-and-sampler');
    // The model was told the format: the tool and its description went to the server.
    expect(llm.state.bodies.some((body) => body.includes('"draftLesson"') && body.includes('Content rules'))).toBe(true);
    expect(chunks.map((chunk) => chunk.type)).toContain('done');
  }, 30_000);
});
