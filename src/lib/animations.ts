/**
 * animations.ts — Variants Framer Motion centralisés
 * Toutes les pages importent depuis ce fichier pour une cohérence d'animation totale.
 *
 * Durées standards :
 *  - Entrée page    : 0.30s easeOut
 *  - Stagger items  : 0.06s entre chaque enfant
 *  - Cards hover    : 0.15s
 *  - Modals         : 0.20s scale + opacity
 */

import type { Variants } from "framer-motion";

// CONTENEUR PRINCIPAL DE PAGE (stagger enfants)
export const pageContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

// SECTION / BLOC fade-up
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.30, ease: "easeOut" },
  },
};

// FADE SIMPLE (modals, overlays)
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.20, ease: "easeOut" },
  },
};

// CARD ITEM (grille de cartes, liste)
export const cardItemVariants: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.25, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15, ease: "easeIn" },
  },
};

// GRILLE STAGGER
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

// MODAL (scale + fade)
export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: -8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.20, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: -4,
    transition: { duration: 0.15, ease: "easeIn" },
  },
};

// SLIDE FROM RIGHT
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    x: 40,
    transition: { duration: 0.18, ease: "easeIn" },
  },
};

// ROW TABLE
export const tableRowVariants: Variants = {
  hidden: { opacity: 0, x: -6 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.22, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    x: 6,
    transition: { duration: 0.12 },
  },
};

// HOVER CARD
export const cardHoverProps = {
  whileHover: { scale: 1.015, transition: { duration: 0.15 } },
  whileTap: { scale: 0.985 },
};

// BADGE PULSE
export const pulseBadge: Variants = {
  animate: {
    opacity: [1, 0.5, 1],
    transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
  },
};
