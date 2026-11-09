import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { saveSettings } from '../../src/main/settings/repository';
import { nonSecretDefaults } from '../../src/shared/config/schema';
import { listExplanations, saveExplanation } from '../../src/main/knowledge/repository';
import { reseedCoreKnowledge, seedCoreKnowledge } from '../../src/main/knowledge/seedCore';
import {
  CORE_FAMILIES,
  CORE_FAMILY_DOCS,
  CORE_KNOWLEDGE,
  CORE_LINK_TYPE_DOCS,
  CORE_LINK_TYPES,
  CORE_NODE_CLASSES,
  CORE_NODE_DOCS,
  coreSeeds,
  familyNote,
  KNOWLEDGE_LANGUAGES,
} from '../../src/shared/knowledge/coreKnowledge';
import { BASE_MODEL_FAMILIES, explanationInputSchema } from '../../src/shared/knowledge/schemas';
import { buildTour, firstExplanation, type TourNode } from '../../src/renderer/components/graph/tour/buildTour';
import { selectDescription } from '../../src/renderer/components/graph/lib/description';
import { edgeKnowledge, edgeKnowledgeRefs, linkTypeRef, resolveEdgeKnowledge } from '../../src/renderer/components/graph/lib/linkTypeKnowledge';
import { recentExplanations, shownSourceUrl } from '../../src/renderer/components/explain/explainModel';
import type { Explanation } from '../../src/shared/contracts/knowledge';
import type { ObjectRef } from '../../src/shared/contracts/objects';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

const KSAMPLER: ObjectRef = { kind: 'nodeClass', id: 'KSampler', classType: 'KSampler' };

describe('core knowledge content', () => {
  it('has what, why and connect for every core node in both languages, never blank', () => {
    for (const language of KNOWLEDGE_LANGUAGES) {
      const pack = CORE_KNOWLEDGE[language];
      expect(Object.keys(pack.nodes).sort()).toEqual([...CORE_NODE_CLASSES].sort());
      for (const classType of CORE_NODE_CLASSES) {
        const texts = pack.nodes[classType];
        for (const aspect of ['what', 'why', 'connect'] as const) expect(texts[aspect].trim(), `${language} ${classType} ${aspect}`).not.toBe('');
      }
    }
  });

  it('keeps the two languages in parity: the same items, the same optional risk notes', () => {
    const { en, ru } = CORE_KNOWLEDGE;
    for (const classType of CORE_NODE_CLASSES) expect(Boolean(ru.nodes[classType].risk), classType).toBe(Boolean(en.nodes[classType].risk));
    expect(Object.keys(ru.linkTypes).sort()).toEqual(Object.keys(en.linkTypes).sort());
    expect(Object.keys(en.linkTypes).sort()).toEqual([...CORE_LINK_TYPES].sort());
    for (const type of CORE_LINK_TYPES) {
      expect(Boolean(ru.linkTypes[type].risk), type).toBe(Boolean(en.linkTypes[type].risk));
      for (const aspect of ['what', 'why', 'connect'] as const) {
        expect(en.linkTypes[type][aspect].trim()).not.toBe('');
        expect(ru.linkTypes[type][aspect].trim()).not.toBe('');
      }
    }
    expect(Object.keys(ru.families).sort()).toEqual(Object.keys(en.families).sort());
    for (const family of CORE_FAMILIES) {
      expect((BASE_MODEL_FAMILIES as readonly string[]).includes(family)).toBe(true);
      for (const language of KNOWLEDGE_LANGUAGES) {
        expect(CORE_KNOWLEDGE[language].families[family].what.trim()).not.toBe('');
        expect(CORE_KNOWLEDGE[language].families[family].risk.trim()).not.toBe('');
      }
    }
    expect(coreSeeds('en').map((seed) => seed.id.replace(/^seed:en:/, ''))).toEqual(coreSeeds('ru').map((seed) => seed.id.replace(/^seed:ru:/, '')));
  });

  it('writes the Russian pack in Russian and the English pack without Cyrillic', () => {
    for (const seed of coreSeeds('en')) expect(/[а-яё]/i.test(seed.text), seed.id).toBe(false);
    for (const seed of coreSeeds('ru')) expect(/[а-яё]/i.test(seed.text), seed.id).toBe(true);
  });

  it('links only to well-formed https pages on docs.comfy.org', () => {
    const urls = [...Object.values(CORE_NODE_DOCS), ...Object.values(CORE_LINK_TYPE_DOCS), ...Object.values(CORE_FAMILY_DOCS)]
      .filter((url): url is string => url !== null);
    expect(urls.length).toBeGreaterThan(40);
    for (const url of urls) {
      const parsed = new URL(url);
      expect(parsed.protocol).toBe('https:');
      expect(parsed.hostname).toBe('docs.comfy.org');
      expect(parsed.search + parsed.hash).toBe('');
    }
  });

  it('marks what and connect as fact and advice as inference; every seed passes the explanation schema', () => {
    for (const language of KNOWLEDGE_LANGUAGES) {
      for (const seed of coreSeeds(language)) {
        explanationInputSchema.parse({ projectId: null, owner: seed.owner, aspect: seed.aspect, text: seed.text, provenance: seed.provenance, sourceUrl: seed.sourceUrl, revisionId: null, createdBy: 'seed' });
        if (seed.aspect === 'why' || seed.aspect === 'risk') expect(seed.provenance, seed.id).toBe('inference');
        if (seed.provenance === 'inference') expect(seed.sourceUrl).toBeNull();
        if (seed.owner.kind === 'nodeClass' && (seed.aspect === 'what' || seed.aspect === 'connect')) {
          expect(seed.provenance).toBe('fact');
          expect(seed.sourceUrl).toMatch(/^https:\/\/docs\.comfy\.org\//);
        }
        if (seed.owner.kind === 'family' && seed.aspect === 'what') expect(seed.provenance).toBe(seed.sourceUrl ? 'fact' : 'inference');
      }
    }
  });

  it('gives a family note for the badge and the model question, null for an unknown family', () => {
    expect(familyNote('flux1', 'en')?.what).toContain('DualCLIPLoader');
    expect(familyNote('sdxl', 'ru')?.risk).toMatch(/LoRA/);
    expect(familyNote('unknown', 'en')).toBeNull();
  });
});

describe('seeding', () => {
  it('stores global seed explanations in the current language and is idempotent', () => {
    const db = freshDb();
    const first = seedCoreKnowledge(db, 'en');
    expect(first.language).toBe('en');
    const count = (db.prepare("SELECT COUNT(*) AS n FROM explanations WHERE created_by = 'seed'").get() as { n: number }).n;
    expect(count).toBe(coreSeeds('en').length);
    const before = listExplanations(db, { projectId: null, owner: KSAMPLER });
    expect(before.map((item) => item.aspect).sort()).toEqual(['connect', 'risk', 'what', 'why']);
    expect(before.every((item) => item.projectId === null && item.revisionId === null && item.createdBy === 'seed' && item.createdAt === 0)).toBe(true);
    const what = before.find((item) => item.aspect === 'what')!;
    expect(what.provenance).toBe('fact');
    expect(what.sourceUrl).toBe('https://docs.comfy.org/built-in-nodes/KSampler');

    seedCoreKnowledge(db, 'en');
    seedCoreKnowledge(db, 'en');
    const again = (db.prepare("SELECT COUNT(*) AS n FROM explanations WHERE created_by = 'seed'").get() as { n: number }).n;
    expect(again).toBe(count);
    expect(listExplanations(db, { projectId: null, owner: KSAMPLER }).map((item) => item.id).sort()).toEqual(before.map((item) => item.id).sort());
  });

  it('reseeding switches language and keeps only the current one', () => {
    const db = freshDb();
    seedCoreKnowledge(db, 'ru');
    const ruWhat = listExplanations(db, { projectId: null, owner: KSAMPLER }).find((item) => item.aspect === 'what')!;
    expect(ruWhat.text).toMatch(/сэмплер/i);
    reseedCoreKnowledge(db, 'en');
    const list = listExplanations(db, { projectId: null, owner: KSAMPLER });
    expect(list.filter((item) => item.aspect === 'what')).toHaveLength(1);
    expect(list.find((item) => item.aspect === 'what')!.text).toMatch(/^The main sampler/);
    expect((db.prepare("SELECT COUNT(*) AS n FROM explanations WHERE id LIKE 'seed:ru:%'").get() as { n: number }).n).toBe(0);
  });

  it('without a language argument follows the saved interface language (default ru)', () => {
    const db = freshDb();
    expect(seedCoreKnowledge(db).language).toBe('ru');
    const saved = saveSettings(db, { ...nonSecretDefaults, language: 'en' });
    expect(saved.ok).toBe(true);
    expect(seedCoreKnowledge(db).language).toBe('en');
  });

  it('never touches AI or user explanations', () => {
    const db = freshDb();
    const user = saveExplanation(db, { projectId: null, owner: KSAMPLER, aspect: 'what', text: 'My own note.', provenance: 'user', sourceUrl: null, revisionId: null, createdBy: 'user' });
    const ai = saveExplanation(db, { projectId: DESKTOP_PROJECT_ID, owner: KSAMPLER, aspect: 'why', text: 'An AI reason.', provenance: 'inference', sourceUrl: null, revisionId: null, createdBy: 'ai' });
    seedCoreKnowledge(db, 'ru');
    reseedCoreKnowledge(db, 'en');
    const list = listExplanations(db, { projectId: DESKTOP_PROJECT_ID, owner: KSAMPLER });
    expect(list.find((item) => item.id === user.id)).toMatchObject({ text: 'My own note.', createdBy: 'user' });
    expect(list.find((item) => item.id === ai.id)).toMatchObject({ text: 'An AI reason.', createdBy: 'ai' });
    // The description card prefers the newer user line over the seed.
    const content = selectDescription({ shared: list });
    expect(content?.primary.text).toBe('My own note.');
  });
});

describe('seeded knowledge on the canvas', () => {
  const node: TourNode = { id: '3', position: { x: 0, y: 0 }, data: { comfyType: 'KSampler', inputs: [], outputs: [] } } as unknown as TourNode;

  it('the tour picks the seeded "what" for KSampler when no AI explanation exists, and the AI one when it does', () => {
    const db = freshDb();
    seedCoreKnowledge(db, 'en');
    const seeded = listExplanations(db, { projectId: DESKTOP_PROJECT_ID, owner: KSAMPLER });
    const texts = { byNode: {}, byClass: { KSampler: firstExplanation(seeded) }, catalog: {} };
    const [step] = buildTour([node], [], texts, () => 'neutral');
    expect(step.text).toBe(CORE_KNOWLEDGE.en.nodes.KSampler.what);

    saveExplanation(db, { projectId: null, owner: KSAMPLER, aspect: 'what', text: 'KSampler denoises a latent step by step.', provenance: 'inference', sourceUrl: null, revisionId: null, createdBy: 'ai' });
    const withAi = listExplanations(db, { projectId: DESKTOP_PROJECT_ID, owner: KSAMPLER });
    expect(firstExplanation(withAi)).toBe('KSampler denoises a latent step by step.');
  });

  it('the edge inspector resolves knowledge about the link type when the edge has none', async () => {
    const db = freshDb();
    seedCoreKnowledge(db, 'en');
    const list = async (owner: ObjectRef) => listExplanations(db, { projectId: DESKTOP_PROJECT_ID, owner });
    expect(linkTypeRef('model')).toEqual({ kind: 'linkType', id: 'MODEL' });
    expect(linkTypeRef('*')).toBeNull();
    expect(linkTypeRef('')).toBeNull();
    expect(edgeKnowledgeRefs('e1', 'LATENT')).toEqual({ edge: { kind: 'edge', id: 'e1' }, type: { kind: 'linkType', id: 'LATENT' } });

    const byType = await resolveEdgeKnowledge(list, 'e1', 'LATENT');
    expect(byType.find((item) => item.aspect === 'what')?.text).toMatch(/^LATENT:/);
    expect(await resolveEdgeKnowledge(list, 'e1', '*')).toEqual([]);

    const own = saveExplanation(db, { projectId: DESKTOP_PROJECT_ID, owner: { kind: 'edge', id: 'e1' }, aspect: 'what', text: 'The prompt for the first pass.', provenance: 'inference', sourceUrl: null, revisionId: null, createdBy: 'ai' });
    const resolved = await resolveEdgeKnowledge(list, 'e1', 'LATENT');
    expect(resolved.map((item) => item.id)).toEqual([own.id]);
    expect(edgeKnowledge([], byType)).toHaveLength(byType.length);
    expect(edgeKnowledge([own], byType)).toEqual([own]);
  });

  it('keeps seeds out of the Explain history and shows the docs link only for seeded facts and web findings', () => {
    const seed = { provenance: 'fact', createdBy: 'seed', sourceUrl: 'https://docs.comfy.org/built-in-nodes/KSampler' } as const;
    expect(shownSourceUrl(seed)).toBe('https://docs.comfy.org/built-in-nodes/KSampler');
    expect(shownSourceUrl({ ...seed, createdBy: 'ai' })).toBeNull();
    expect(shownSourceUrl({ ...seed, provenance: 'web', createdBy: 'ai' })).toBe('https://docs.comfy.org/built-in-nodes/KSampler');
    const items = [
      { id: 's', createdBy: 'seed', createdAt: 0 },
      { id: 'a', createdBy: 'ai', createdAt: 5 },
    ] as unknown as Explanation[];
    expect(recentExplanations(items).map((item) => item.id)).toEqual(['a']);
  });
});
