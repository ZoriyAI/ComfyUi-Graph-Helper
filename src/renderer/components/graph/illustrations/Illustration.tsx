/**
 * Small SVG pictures of what a node does (a sampler clearing noise, a VAE turning a latent grid into an image).
 * The Properties header (Inspector.tsx), the tour callouts (TourLayer) and the live build's bubble (BuildLayer)
 * show them, so a newcomer sees the idea of a node before reading about it. Colours come from the port type colours.
 */
import React, { useState } from 'react';
import { typeColor } from '../lib/typeColors';
import { illustrationKind, noisePoints, type IllustrationKind } from './kinds';
import styles from './Illustration.module.css';

/**
 * Props of a micro-illustration: what a node does, in 120×48. Each has a static first frame (animate=false) that
 * carries the whole idea; the animated variant plays once for 1–2 s, on hover or when a tour opens it.
 */
export interface IllustrationProps {
  classType?: string;
  kind?: IllustrationKind;
  /** Play the animation once. The motion policy can still stop it (see Illustration.module.css). */
  animate?: boolean;
  /** Replay on hover. */
  hoverPlay?: boolean;
  label?: string;
}

/** The picture's size in CSS pixels; Illustration.module.css gives the same box. */
const W = 120;
const H = 48;

/** A small "turns into" arrow between two halves of a picture. */
function Arrow({ x }: { x: number }) {
  return <path className={styles.ink} d={`M${x} 24 h10 m-4 -4 l4 4 l-4 4`} />;
}

function Sampler() {
  const cells = 6;
  return (
    <g>
      {Array.from({ length: cells }, (_, index) => {
        const x = 4 + index * 19;
        const noise = noisePoints(14 - index * 2, 15, 30, 11 + index);
        return (
          <g key={index} transform={`translate(${x} 9)`}>
            <rect className={styles.frame} width="16" height="30" rx="2" />
            {/* Noise thins out and a smooth image fills in, step by step. */}
            <rect width="16" height="30" rx="2" fill={typeColor('IMAGE')} opacity={index / (cells - 1) * 0.8} />
            {noise.map((point, dot) => <circle key={dot} cx={point.x} cy={point.y} r={point.r * 0.7} className={styles.dim} />)}
          </g>
        );
      })}
      <rect className={styles.sweep} x="114" y="6" width="4" height="36" rx="2" fill={typeColor('LATENT')} />
    </g>
  );
}

/** A square of cells: few large ones for a latent, many small ones for an image. */
function Grid({ x, size, step, color, className }: { x: number; size: number; step: number; color: string; className?: string }) {
  const cells: React.ReactNode[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      cells.push(<rect key={`${row}-${col}`} x={x + col * step} y={8 + row * step} width={step - 1} height={step - 1} fill={color} opacity={0.35 + ((row + col) % 3) * 0.2} />);
    }
  }
  return <g className={className}>{cells}</g>;
}

function VaeDecode() {
  return (
    <g>
      <Grid x={6} size={4} step={8} color={typeColor('LATENT')} />
      <Arrow x={44} />
      <Grid x={66} size={8} step={4} color={typeColor('IMAGE')} className={styles.fadeIn} />
    </g>
  );
}

function VaeEncode() {
  return (
    <g>
      <Grid x={6} size={8} step={4} color={typeColor('IMAGE')} />
      <Arrow x={44} />
      <Grid x={72} size={4} step={8} color={typeColor('LATENT')} className={styles.fadeIn} />
    </g>
  );
}

function TextEncode() {
  const heights = [18, 28, 12, 24, 30, 16, 22];
  return (
    <g>
      {[0, 1, 2].map((line) => <rect key={line} x="6" y={12 + line * 9} width={36 - line * 8} height="4" rx="2" className={styles.dim} />)}
      <Arrow x={48} />
      {heights.map((height, index) => (
        <rect key={index} className={styles.grow} x={68 + index * 7} y={40 - height} width="5" height={height} rx="1" fill={typeColor('CONDITIONING')} />
      ))}
    </g>
  );
}

function Weights({ withLayer }: { withLayer?: boolean }) {
  return (
    <g>
      <rect className={styles.frame} x="20" y="8" width="80" height="32" rx="4" />
      {[0, 1, 2, 3, 4].map((row) => (
        <rect key={row} x="26" y={12 + row * 5.6} width={68 - (row % 2) * 12} height="3" rx="1.5" fill={typeColor('MODEL')} opacity={0.5 + (row % 3) * 0.15} />
      ))}
      {withLayer ? (
        <rect className={`${styles.slide} ${styles.blend}`} x="24" y="14" width="72" height="20" rx="3" fill={typeColor("CLIP")} opacity="0.8" />
      ) : <rect className={styles.sweep} x="92" y="10" width="3" height="28" rx="1.5" fill="currentColor" opacity="0.5" />}
    </g>
  );
}

function ControlNet() {
  return (
    <g>
      <rect className={styles.frame} x="20" y="4" width="80" height="40" rx="3" />
      <path d="M24 40 L44 22 L58 32 L74 14 L96 40 Z" fill={typeColor('IMAGE')} opacity="0.35" />
      <path className={styles.draw} pathLength={1} d="M24 40 L44 22 L58 32 L74 14 L96 40" fill="none" stroke={typeColor('CONTROL_NET')} strokeWidth="1.6" strokeLinejoin="round" />
    </g>
  );
}

function ImageFrame() {
  return (
    <g>
      <rect className={styles.frame} x="30" y="4" width="60" height="40" rx="3" />
      <circle cx="76" cy="15" r="4" fill={typeColor('CLIP')} opacity="0.8" />
      <path d="M34 40 L50 24 L60 32 L68 26 L86 40 Z" fill={typeColor('IMAGE')} opacity="0.7" className={styles.fadeIn} />
    </g>
  );
}

function EmptyLatent() {
  return (
    <g>
      <rect className={styles.frame} x="20" y="4" width="80" height="40" rx="3" />
      {noisePoints(60, 76, 36, 3).map((point, index) => (
        <circle key={index} className={index % 4 === 0 ? styles.twinkle : undefined} cx={22 + point.x} cy={6 + point.y} r={point.r * 0.8} fill={typeColor('LATENT')} opacity="0.8" />
      ))}
    </g>
  );
}

/** Any node the app has no picture for: a small node card, values flowing in on the left and out on the right. */
function Generic() {
  return (
    <g>
      <path className={styles.ink} d="M6 18 h30 M6 30 h30 M84 24 h30" />
      <rect className={styles.frame} x="36" y="8" width="48" height="32" rx="5" />
      <rect x="36" y="8" width="48" height="8" rx="4" fill="var(--accent, #65d9ed)" opacity="0.35" />
      <circle cx="36" cy="18" r="2.5" fill={typeColor('MODEL')} />
      <circle cx="36" cy="30" r="2.5" fill={typeColor('CONDITIONING')} />
      <circle cx="84" cy="24" r="2.5" fill={typeColor('LATENT')} />
      <circle className={styles.travel} cx="60" cy="28" r="2.5" fill="var(--accent, #65d9ed)" />
    </g>
  );
}

/** Video: a strip of frames with sprocket holes, a frame lighting up after another. */
function Video() {
  return (
    <g>
      <rect className={styles.frame} x="4" y="8" width="112" height="32" rx="3" />
      {Array.from({ length: 5 }, (_, index) => (
        <g key={index}>
          <rect x={10 + index * 21} y="14" width="17" height="20" rx="2" fill={typeColor('IMAGE')} opacity={0.25 + index * 0.15} />
          <rect x={14 + index * 21} y="10" width="3" height="2" className={styles.dim} />
          <rect x={14 + index * 21} y="36" width="3" height="2" className={styles.dim} />
        </g>
      ))}
      <rect className={styles.sweep} x="108" y="12" width="4" height="24" rx="2" fill={typeColor('IMAGE')} />
    </g>
  );
}

/** Sound: a waveform, loud in the middle. */
function Audio() {
  const bars = [6, 10, 16, 24, 30, 22, 28, 18, 12, 20, 14, 8, 5];
  return (
    <g>
      {bars.map((height, index) => (
        <rect key={index} x={10 + index * 8} y={24 - height / 2} width="4" height={height} rx="2" fill={typeColor('AUDIO')} opacity={0.55 + (index % 3) * 0.15} />
      ))}
    </g>
  );
}

/** Set and Get: a value sent away under a name and picked up elsewhere, with no link drawn between. */
function SetGet() {
  return (
    <g>
      <rect className={styles.frame} x="8" y="14" width="34" height="20" rx="4" />
      <rect className={styles.frame} x="78" y="14" width="34" height="20" rx="4" />
      <path className={styles.ink} d="M42 24 h36" strokeDasharray="4 4" />
      <circle className={styles.travel} cx="60" cy="24" r="3" fill="var(--ai, #b7a5ff)" />
    </g>
  );
}

/** A subgraph: several nodes folded into one block. */
function Subgraph() {
  return (
    <g>
      <rect className={styles.frame} x="20" y="4" width="80" height="40" rx="6" />
      <rect x="28" y="12" width="18" height="12" rx="2" fill="var(--ai, #b7a5ff)" opacity="0.45" />
      <rect x="51" y="24" width="18" height="12" rx="2" fill="var(--ai, #b7a5ff)" opacity="0.6" />
      <rect x="74" y="12" width="18" height="12" rx="2" fill="var(--ai, #b7a5ff)" opacity="0.45" />
      <path className={styles.ink} d="M4 24 h16 M100 24 h16" />
    </g>
  );
}

/** The picture for one kind; anything unknown gets the generic box. */
function Body({ kind }: { kind: IllustrationKind }) {
  switch (kind) {
    case 'sampler': return <Sampler />;
    case 'vae-decode': return <VaeDecode />;
    case 'vae-encode': return <VaeEncode />;
    case 'text-encode': return <TextEncode />;
    case 'lora': return <Weights withLayer />;
    case 'weights': return <Weights />;
    case 'controlnet': return <ControlNet />;
    case 'image': return <ImageFrame />;
    case 'empty-latent': return <EmptyLatent />;
    case 'video': return <Video />;
    case 'audio': return <Audio />;
    case 'set-get': return <SetGet />;
    case 'subgraph': return <Subgraph />;
    default: return <Generic />;
  }
}

/** The picture for a class (or an explicit kind), static unless asked to play. */
export default function Illustration({ classType, kind, animate = false, hoverPlay = false, label }: IllustrationProps) {
  const resolved = kind ?? illustrationKind(classType);
  // Remounting the body restarts the CSS animation: hover plays it again from the first frame.
  const [play, setPlay] = useState(0);
  const animated = animate || play > 0;
  return (
    <svg
      className={`${styles.root}${animated ? ` ${styles.animated}` : ''}`}
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-illustration={resolved}
      data-frame={animated ? 'animated' : 'static'}
      onMouseEnter={hoverPlay ? () => setPlay((count) => count + 1) : undefined}
    >
      <g key={play}>
        <Body kind={resolved} />
      </g>
    </svg>
  );
}
