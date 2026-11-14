import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { ensureWorkspace, startRun } from '../../src/main/commands/commit';
import { deleteAssistantExplanations, deletePersonExplanation, listExplanations, saveExplanation } from '../../src/main/knowledge/repository';
import { migrate } from '../../src/main/settings/migrate';
import { createAgentTools, type AgentToolDefinition } from '../../src/main/agent/tools';
import { groupByAspect, trustRank } from '../../src/renderer/components/explain/explainModel';
import { DESKTOP_PROJECT_ID as P } from '../../src/shared/project';
import type { Explanation } from '../../src/shared/contracts';

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

const CLASS = { kind: 'nodeClass' as const, id: 'KSampler', classType: 'KSampler' };

describe('the assistant\'s words about a node class (P0)', () => {
  it('are never stored as a fact, stay in the project, and go in one action; the person\'s notes stay', async () => {
    const db = openDb();
    const run = startRun(db, P);
    const tools = createAgentTools({ db, projectId: P, runId: run.runId, revision: run.expectedRevisionId });
    const explain = tools.explain as AgentToolDefinition;
    const saved = await explain.execute({ owner: CLASS, aspect: 'what', text: 'KSampler brews coffee.', provenance: 'fact' }) as Record<string, unknown>;
    expect(saved).toMatchObject({ success: true, provenance: 'inference' });
    // Another project does not see it: nothing global was written.
    expect(listExplanations(db, { projectId: null, owner: CLASS })).toHaveLength(0);
    expect(listExplanations(db, { projectId: P, owner: CLASS }).map((item) => item.createdBy)).toEqual(['ai']);

    const note = saveExplanation(db, { projectId: null, owner: CLASS, aspect: 'what', text: 'My note.', provenance: 'user', sourceUrl: null, revisionId: null, createdBy: 'user' });
    expect(deleteAssistantExplanations(db, CLASS)).toBe(1);
    expect(listExplanations(db, { projectId: P, owner: CLASS }).map((item) => item.createdBy)).toEqual(['user']);
    // A person's note goes by its id; the same call never removes built-in knowledge.
    const seed = saveExplanation(db, { projectId: null, owner: CLASS, aspect: 'why', text: 'Built in.', provenance: 'fact', sourceUrl: null, revisionId: null, createdBy: 'seed' });
    expect(deletePersonExplanation(db, seed.id)).toBe(0);
    expect(deletePersonExplanation(db, note.id)).toBe(1);
    expect(listExplanations(db, { projectId: P, owner: CLASS }).map((item) => item.createdBy)).toEqual(['seed']);
  });

  it('come after built-in knowledge, the person\'s notes and what the app read', () => {
    const base = { owner: CLASS, aspect: 'what' as const, projectId: null, sourceUrl: null, revisionId: null };
    const list = [
      { ...base, id: 'ai', text: 'a', provenance: 'fact', createdBy: 'ai', createdAt: 9 },
      { ...base, id: 'seed', text: 's', provenance: 'fact', createdBy: 'seed', createdAt: 1 },
      { ...base, id: 'user', text: 'u', provenance: 'user', createdBy: 'user', createdAt: 5 },
    ] as Explanation[];
    expect(groupByAspect(list)[0].items.map((item) => item.id)).toEqual(['seed', 'user', 'ai']);
    expect(trustRank({ createdBy: 'ai', provenance: 'fact' })).toBeGreaterThan(trustRank({ createdBy: 'seed', provenance: 'inference' }));
  });
});
