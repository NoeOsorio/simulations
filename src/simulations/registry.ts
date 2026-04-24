import type { ComponentType } from 'react';
import MicroEcosystem from './micro-ecosystem/MicroEcosystem';
import SkillEcosystem from './skill-ecosystem/SkillEcosystem';

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
  {
    id: 'skill-ecosystem',
    phase: 2,
    title: 'Phase 2 — Skill Ecosystem',
    shortTitle: 'Skill Ecosystem',
    tagline: 'Four specialist roles, limited food, inheritable skills.',
    description:
      'Food stops being free. Farmers plant herbs, harvesters grow apples, healers keep their kin alive, and builders raise nests that speed rest and mating. Children inherit their role from one parent, with small mutations.',
    icon: '🛠️',
    path: '/skill-ecosystem',
    status: 'available',
    Component: SkillEcosystem,
  },
];
