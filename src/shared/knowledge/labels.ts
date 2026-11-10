import type { BaseModelFamily, Evidence, ExplanationAspect, ModelKind, Provenance } from '../contracts/knowledge';

/**
 * i18n keys for knowledge values. Family ids contain dots and dashes ("wan2.1", "qwen-image"), which i18next
 * would read as nesting, so the catalog keys use underscores and callers go through these helpers.
 */
export function familyLabelKey(family: BaseModelFamily): string {
  return `knowledge.family.${family.replace(/[.-]/g, '_')}`;
}

export function kindLabelKey(kind: ModelKind): string {
  return `knowledge.kind.${kind}`;
}

/** A one- or two-word name for a row of a list, where the full one would push the family and the size out. */
export function kindShortLabelKey(kind: ModelKind): string {
  return `knowledge.kindShort.${kind}`;
}

export function evidenceLabelKey(evidence: Evidence): string {
  return `knowledge.evidence.${evidence}`;
}

export function provenanceLabelKey(provenance: Provenance): string {
  return `knowledge.provenance.${provenance}`;
}

export function aspectLabelKey(aspect: ExplanationAspect): string {
  return `knowledge.aspect.${aspect}`;
}
