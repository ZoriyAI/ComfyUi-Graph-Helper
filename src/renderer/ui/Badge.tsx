import React, { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { familyNote } from '../../shared/knowledge/coreKnowledge';
import type { BaseModelFamily, ModelKind, Provenance } from '../../shared/contracts';
import { familyLabelKey, kindLabelKey, kindShortLabelKey, provenanceLabelKey } from '../../shared/knowledge/labels';
import styles from './Badge.module.css';
import { familyHue, kindHue, PROVENANCE_TONES, type BadgeHue } from './badgeHues';
import { cx } from './cx';

export type BadgeTone = 'neutral' | 'accent' | 'ai' | 'warn' | 'danger' | 'ok';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Shows a leading dot in this hue (port-type palette). */
  hue?: BadgeHue;
  /** Pill shape, a little taller: the Chip look. */
  pill?: boolean;
  mono?: boolean;
  icon?: React.ReactNode;
}

const HUE_CLASS: Record<BadgeHue, string> = {
  model: styles.hueModel,
  clip: styles.hueClip,
  vae: styles.hueVae,
  conditioning: styles.hueConditioning,
  latent: styles.hueLatent,
  image: styles.hueImage,
  mask: styles.hueMask,
  controlnet: styles.hueControlnet,
  accent: styles.hueAccent,
  ai: styles.hueAi,
  warn: styles.hueWarn,
  none: styles.hueNone,
};

/** Small non-interactive label. Text stays readable; colour meaning is carried by the dot and the tone. */
const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone = 'neutral', hue, pill, mono, icon, className, children, ...rest },
  ref,
) {
  return (
    <span ref={ref} className={cx(styles.badge, styles[tone], pill && styles.pill, mono && styles.mono, hue && HUE_CLASS[hue], className)} {...rest}>
      {hue ? <span className={styles.dot} aria-hidden="true" /> : null}
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <span className={styles.text}>{children}</span>
    </span>
  );
});

export default Badge;

/** Chip: the pill-shaped badge used for status in bars. */
export const Chip = forwardRef<HTMLSpanElement, BadgeProps>(function Chip(props, ref) {
  return <Badge ref={ref} pill {...props} />;
});

export function ProvenanceBadge({ provenance, className }: { provenance: Provenance; className?: string }) {
  const { t } = useTranslation();
  return (
    <Badge tone={PROVENANCE_TONES[provenance]} className={cx(styles[provenance], className)} title={String(t(`knowledge.provenanceHint.${provenance}`))}>
      {t(provenanceLabelKey(provenance))}
    </Badge>
  );
}

export function FamilyBadge({ family, className }: { family: BaseModelFamily; className?: string }) {
  const { t, i18n } = useTranslation();
  // The built-in note about the family (what it needs, which LoRAs fit) as the badge tooltip.
  const note = familyNote(family, (i18n.language || 'ru').toLowerCase().startsWith('en') ? 'en' : 'ru');
  return <Badge hue={familyHue(family)} className={className} title={note ? `${note.what}\n\n${note.risk}` : undefined}>{t(familyLabelKey(family))}</Badge>;
}

/** `short`: the brief name for a row of a list; the full one is the tooltip. */
export function KindBadge({ kind, className, short }: { kind: ModelKind; className?: string; short?: boolean }) {
  const { t } = useTranslation();
  const full = String(t(kindLabelKey(kind)));
  return <Badge hue={kindHue(kind)} className={className} title={short ? full : undefined}>{short ? t(kindShortLabelKey(kind)) : full}</Badge>;
}

export type StatusTone = 'idle' | 'running' | 'ok' | 'warn' | 'error';

export function StatusBadge({ status, children, className }: { status: StatusTone; children: React.ReactNode; className?: string }) {
  const tone: BadgeTone = status === 'ok' ? 'ok' : status === 'warn' ? 'warn' : status === 'error' ? 'danger' : status === 'running' ? 'accent' : 'neutral';
  return <Badge tone={tone} className={className}>{children}</Badge>;
}
