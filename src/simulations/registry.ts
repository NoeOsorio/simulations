import type { ComponentType } from 'react';
import MicroEcosystem from './micro-ecosystem/MicroEcosystem';
import SkillEcosystem from './skill-ecosystem/SkillEcosystem';
import TribalSociety from './tribal-society/TribalSociety';
import FamilyBonds from './family-bonds/FamilyBonds';

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
  {
    id: 'tribal-society',
    phase: 3,
    title: 'Phase 3 — Tribal Society',
    shortTitle: 'Tribal Society',
    tagline: 'Nobody is self-sufficient. Five roles, ages, and teachers.',
    description:
      'Producers can\'t eat their own crop, healers can\'t heal themselves, builders can\'t use their own nests. Creatures are born as children, learn from teachers, grow into a role the tribe needs most, age into elders, and die of old age.',
    icon: '🏘️',
    path: '/tribal-society',
    status: 'available',
    Component: TribalSociety,
  },
  {
    id: 'family-bonds',
    phase: 4,
    title: 'Phase 4 — Family Bonds',
    shortTitle: 'Family Bonds',
    tagline: 'Couples form, families grow, only your partner can be the parent of your children.',
    description:
      'Each creature carries three inheritable personality traits and picks a single partner for life. Children stay near their family\'s house, eat from the family pantry, and grow up either at home or at a school. Cocineros turn raw food into cooked at home; other families barter raw for cooked. The first phase where individuals are not interchangeable.',
    icon: '🏠',
    path: '/family-bonds',
    status: 'available',
    Component: FamilyBonds,
  },
];
