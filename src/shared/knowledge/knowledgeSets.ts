import type { CoreTexts, FamilyTexts, KnowledgeLanguage } from './coreKnowledge';
import { SOUND_3D_FACES_KNOWLEDGE } from './sets/sound-3d-faces';

/**
 * Knowledge sets: built-in teaching knowledge beyond the core pack, one set per domain of the lessons (sound and
 * 3D, video, pictures...). Each set says the same things in both languages. Node classes and families are seeded
 * as explanations with the core ones (coreKnowledge.ts coreSeeds); packs, model folders and fields are read
 * through the functions below.
 *
 * A set is registered with one import and one entry in KNOWLEDGE_SETS.
 */

/** What a node pack is for, its key nodes, and what it cannot do or costs. */
export interface PackTexts {
  what: string;
  nodes: string;
  limits: string;
}

export interface KnowledgeSetTexts {
  /** By class type. A class of the core pack is not repeated here. */
  nodes: Record<string, CoreTexts>;
  /** By family id (lowercase, as a family badge would carry it). */
  families: Record<string, FamilyTexts>;
  /** By the pack's folder name in custom_nodes. */
  packs: Record<string, PackTexts>;
  /** By the name of a folder under ComfyUI/models. */
  folders: Record<string, string>;
  /** By "ClassType.field": what the field does and what to put in it. */
  fields: Record<string, string>;
  /** Questions that span several nodes and families ("which way keeps a face"), by topic id. */
  topics: Record<string, { title: string; body: string }>;
}

export interface KnowledgeSet {
  id: string;
  /** Official docs.comfy.org pages: the node's page, the family's tutorial. Null where there is none. */
  docs: { nodes: Record<string, string | null>; families: Record<string, string | null> };
  en: KnowledgeSetTexts;
  ru: KnowledgeSetTexts;
}

export const KNOWLEDGE_SETS: readonly KnowledgeSet[] = [SOUND_3D_FACES_KNOWLEDGE];

function first<T>(language: KnowledgeLanguage, pick: (texts: KnowledgeSetTexts) => Record<string, T>, key: string): T | null {
  for (const set of KNOWLEDGE_SETS) {
    const found = pick(set[language])[key];
    if (found !== undefined) return found;
  }
  return null;
}

/** What a node pack is for, by its folder name; null for a pack no set describes. */
export function packNote(pack: string, language: KnowledgeLanguage): PackTexts | null {
  return first(language, (texts) => texts.packs, pack);
}

/** What a folder under ComfyUI/models holds; null for a folder no set describes. */
export function modelFolderNote(folder: string, language: KnowledgeLanguage): string | null {
  return first(language, (texts) => texts.folders, folder);
}

/** What a field of a node does and what to put in it; null when no set describes it. */
export function fieldNote(classType: string, field: string, language: KnowledgeLanguage): string | null {
  return first(language, (texts) => texts.fields, `${classType}.${field}`);
}

/** A built-in note on a question that spans several nodes and families; null for a topic no set describes. */
export function topicNote(topic: string, language: KnowledgeLanguage): { title: string; body: string } | null {
  return first(language, (texts) => texts.topics, topic);
}
