import type { ComponentType } from 'react';
import MicroEcosystem from './micro-ecosystem/MicroEcosystem';

export interface SimulationMeta {
  id: string;
  /** Phase number — order in the "history of life" arc. */
  phase: number;
  title: string;
  shortTitle: string;
  /** Plain-english one-liner shown on the main menu card. */
  tagline: string;
  /** Two or three sentences for the menu card body. */
  description: string;
  /** Emoji used as the card icon. */
  icon: string;
  /** Route path under the hash router (e.g. "/micro-ecosystem"). */
  path: string;
  /** Status pill on the menu. */
  status: 'available' | 'planned';
  Component: ComponentType;
}

export const simulations: SimulationMeta[] = [
  {
    id: 'micro-ecosystem',
    phase: 1,
    title: 'Phase 1 — Micro Ecosystem',
    shortTitle: 'Micro Ecosystem',
    tagline: 'Tiny creatures wander, eat, and reproduce.',
    description:
      'A primordial soup of single-cell-ish creatures. They search for food, mate when they have enough energy, and die when they run out. The first spark of organic life.',
    icon: '🧬',
    path: '/micro-ecosystem',
    status: 'available',
    Component: MicroEcosystem,
  },
];
