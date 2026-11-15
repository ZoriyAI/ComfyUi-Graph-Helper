/**
 * Writes the app's built-in teaching knowledge into the explanations table, in the interface language.
 * Called by database.ts when the database opens and by ipc.ts after a settings save (the language may have
 * changed), both through reseedCoreKnowledge. The rules of seeding are on SEED_CREATED_AT below.
 */
import type Database from 'better-sqlite3';
import { languageOf as interfaceLanguageOf } from '../../shared/i18n';
import { systemLanguage } from '../systemLanguage';
import { coreSeeds, type KnowledgeLanguage } from '../../shared/knowledge/coreKnowledge';
import { explanationInputSchema } from '../../shared/knowledge/schemas';
import { readSettings } from '../settings/repository';
import { ownerColumns } from './repository';

/**
 * Seeds the built-in teaching knowledge (src/shared/knowledge/coreKnowledge*.ts) as global explanations.
 *
 * - Only the current interface language is kept: seeding writes every seed of that language and removes seeds of
 *   the other one, so a description card never shows two built-in "what" lines in two languages.
 * - Each seed has a stable id per (owner, aspect, language), so running again updates rows in place.
 * - Seeds are written with created_at = SEED_CREATED_AT (the epoch), so any explanation an AI or a person writes
 *   is newer and wins wherever the newest line is picked (description cards, Inspector, Explain panel order).
 * - Only rows with created_by = 'seed' are ever updated or deleted: AI, user and sync explanations are untouched.
 */
export const SEED_CREATED_AT = 0;

/** The language to seed: the one asked for, else the saved interface language, else the system's. */
function languageOf(db: Database.Database, language?: string): KnowledgeLanguage {
  if (language === 'en' || language === 'ru') return language;
  try {
    return interfaceLanguageOf(readSettings(db));
  } catch {
    // A database without the settings table reads as the system's language.
  }
  return systemLanguage();
}

/** Writes the seeds of `language` (default: the saved interface language) and removes the other language's. */
export function seedCoreKnowledge(db: Database.Database, language?: string): { language: KnowledgeLanguage; written: number; removed: number } {
  const lang = languageOf(db, language);
  const seeds = coreSeeds(lang);
  const upsert = db.prepare(`
    INSERT INTO explanations (id, project_id, owner_kind, owner_id, owner_json, aspect, text, provenance, source_url,
      revision_id, created_by, created_at)
    VALUES (@id, NULL, @owner_kind, @owner_id, @owner_json, @aspect, @text, @provenance, @source_url, NULL, 'seed', @created_at)
    ON CONFLICT(id) DO UPDATE SET
      owner_kind = excluded.owner_kind, owner_id = excluded.owner_id, owner_json = excluded.owner_json,
      aspect = excluded.aspect, text = excluded.text, provenance = excluded.provenance, source_url = excluded.source_url
    WHERE explanations.created_by = 'seed'
  `);
  const run = db.transaction(() => {
    db.exec('CREATE TEMP TABLE IF NOT EXISTS seed_keep (id TEXT PRIMARY KEY)');
    db.exec('DELETE FROM temp.seed_keep');
    const keep = db.prepare('INSERT OR IGNORE INTO temp.seed_keep (id) VALUES (?)');
    for (const seed of seeds) {
      // The same validation every stored explanation passes.
      explanationInputSchema.parse({
        projectId: null, owner: seed.owner, aspect: seed.aspect, text: seed.text, provenance: seed.provenance,
        sourceUrl: seed.sourceUrl, revisionId: null, createdBy: 'seed',
      });
      const columns = ownerColumns(seed.owner);
      upsert.run({
        id: seed.id,
        owner_kind: columns.kind,
        owner_id: columns.id,
        owner_json: JSON.stringify(seed.owner),
        aspect: seed.aspect,
        text: seed.text,
        provenance: seed.provenance,
        source_url: seed.sourceUrl,
        created_at: SEED_CREATED_AT,
      });
      keep.run(seed.id);
    }
    const removed = db.prepare("DELETE FROM explanations WHERE created_by = 'seed' AND id NOT IN (SELECT id FROM temp.seed_keep)").run().changes;
    db.exec('DELETE FROM temp.seed_keep');
    return removed;
  });
  const removed = run.immediate();
  return { language: lang, written: seeds.length, removed };
}

/** After the interface language changed: the same seeding, never fatal to the caller. */
export function reseedCoreKnowledge(db: Database.Database, language?: string): void {
  try {
    seedCoreKnowledge(db, language);
  } catch (error) {
    console.warn('[Knowledge] Core knowledge could not be seeded:', error instanceof Error ? error.message : String(error));
  }
}
