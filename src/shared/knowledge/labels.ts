/**
 * i18n keys for knowledge values. Family ids contain dots and dashes ("wan2.1", "qwen-image"), which i18next
 * would read as nesting, so the catalog keys use underscores and callers go through these helpers. Used wherever a
 * family, kind, evidence, provenance or aspect is shown: the model library and cards, the explain panel and its
 * provenance badge, the description layer of the canvas, the field model list and lackText.ts.
 */
import type { BaseModelFamily, Evidence, ExplanationAspect, ModelKind, Provenance } from '../contracts/knowledge';

/** The catalog key of a base-model family's name. */
export function familyLabelKey(family: BaseModelFamily): string {
  return `knowledge.family.${family.replace(/[.-]/g, '_')}`;
}

/** The catalog key of a model kind's full name. */
export function kindLabelKey(kind: ModelKind): string {
  return `knowledge.kind.${kind}`;
}

/** A one- or two-word name for a row of a list, where the full one would push the family and the size out. */
export function kindShortLabelKey(kind: ModelKind): string {
  return `knowledge.kindShort.${kind}`;
}

/** The catalog key that says where a family guess came from (metadata, sidecar, file name). */
export function evidenceLabelKey(evidence: Evidence): string {
  return `knowledge.evidence.${evidence}`;
}

/** The catalog key of a provenance badge (fact, inference, web, user, file). */
export function provenanceLabelKey(provenance: Provenance): string {
  return `knowledge.provenance.${provenance}`;
}

/** The catalog key of an explanation aspect's heading (what, why, connect, next, risk). */
export function aspectLabelKey(aspect: ExplanationAspect): string {
  return `knowledge.aspect.${aspect}`;
}
