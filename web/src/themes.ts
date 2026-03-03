/** Color themes for events */

export interface Theme {
  id: string;
  name: string;
  /** Full-page gradient background */
  gradient: string;
  /** Primary button (bg + hover) */
  buttonPrimary: string;
  /** Light tinted badge/chip background */
  badgeLight: string;
  /** Accent text color (light bg) */
  accentText: string;
  /** + button on voter cards */
  votePlus: string;
  /** Focus ring for inputs */
  focusBorder: string;
  /** Translucent bar (locked voter name) */
  nameBar: string;
  /** Preview swatch gradient for theme picker */
  swatch: string;
  /** Accent text on dark backgrounds */
  accentTextDark: string;
  /** Solid accent fill on dark backgrounds (progress bars) */
  accentBgDark: string;
  /** Reveal button on projector view */
  revealButton: string;
  /** Progress bar glow shadow */
  revealShadow: string;
}

export const THEMES: Record<string, Theme> = {
  indigo: {
    id: 'indigo',
    name: 'Indigo',
    gradient: 'bg-gradient-to-br from-indigo-500 to-purple-600',
    buttonPrimary: 'bg-indigo-600 hover:bg-indigo-700',
    badgeLight: 'bg-indigo-100 text-indigo-700',
    accentText: 'text-indigo-600 hover:text-indigo-800',
    votePlus: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200',
    focusBorder: 'focus:border-indigo-500',
    nameBar: 'bg-white/20',
    swatch: 'bg-gradient-to-br from-indigo-500 to-purple-600',
    accentTextDark: 'text-indigo-400',
    accentBgDark: 'bg-indigo-500',
    revealButton: 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/30',
    revealShadow: 'shadow-indigo-600/30',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald',
    gradient: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    buttonPrimary: 'bg-emerald-600 hover:bg-emerald-700',
    badgeLight: 'bg-emerald-100 text-emerald-700',
    accentText: 'text-emerald-600 hover:text-emerald-800',
    votePlus: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
    focusBorder: 'focus:border-emerald-500',
    nameBar: 'bg-white/20',
    swatch: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    accentTextDark: 'text-emerald-400',
    accentBgDark: 'bg-emerald-500',
    revealButton: 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/30',
    revealShadow: 'shadow-emerald-600/30',
  },
  rose: {
    id: 'rose',
    name: 'Rose',
    gradient: 'bg-gradient-to-br from-rose-500 to-pink-600',
    buttonPrimary: 'bg-rose-600 hover:bg-rose-700',
    badgeLight: 'bg-rose-100 text-rose-700',
    accentText: 'text-rose-600 hover:text-rose-800',
    votePlus: 'bg-rose-100 text-rose-700 hover:bg-rose-200',
    focusBorder: 'focus:border-rose-500',
    nameBar: 'bg-white/20',
    swatch: 'bg-gradient-to-br from-rose-500 to-pink-600',
    accentTextDark: 'text-rose-400',
    accentBgDark: 'bg-rose-500',
    revealButton: 'bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-600/30',
    revealShadow: 'shadow-rose-600/30',
  },
  amber: {
    id: 'amber',
    name: 'Amber',
    gradient: 'bg-gradient-to-br from-amber-500 to-orange-600',
    buttonPrimary: 'bg-amber-600 hover:bg-amber-700',
    badgeLight: 'bg-amber-100 text-amber-700',
    accentText: 'text-amber-600 hover:text-amber-800',
    votePlus: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
    focusBorder: 'focus:border-amber-500',
    nameBar: 'bg-white/20',
    swatch: 'bg-gradient-to-br from-amber-500 to-orange-600',
    accentTextDark: 'text-amber-400',
    accentBgDark: 'bg-amber-500',
    revealButton: 'bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-600/30',
    revealShadow: 'shadow-amber-600/30',
  },
};

export const DEFAULT_THEME = 'indigo';
export const THEME_IDS = Object.keys(THEMES) as string[];

export function getTheme(themeId?: string): Theme {
  return THEMES[themeId ?? DEFAULT_THEME] ?? THEMES[DEFAULT_THEME];
}
