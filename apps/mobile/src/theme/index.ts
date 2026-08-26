/**
 * FitCheck design tokens. Editorial fashion look: ivory paper, ink text,
 * one acid-lime accent, Instrument Serif display type over the system sans.
 */

import { useColorScheme } from 'react-native';

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  muted: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentInk: string;
  danger: string;
  overlay: string;
  shimmer: string;
}

export const palette: Record<'light' | 'dark', ThemeColors> = {
  light: {
    bg: '#F6F4EF',
    surface: '#FFFFFF',
    surfaceAlt: '#EFECE4',
    ink: '#131313',
    muted: '#6E6A63',
    border: 'rgba(19, 19, 19, 0.12)',
    borderStrong: 'rgba(19, 19, 19, 0.28)',
    accent: '#D4F53C',
    accentInk: '#131313',
    danger: '#C2452D',
    overlay: 'rgba(19, 19, 19, 0.55)',
    shimmer: 'rgba(19, 19, 19, 0.06)',
  },
  dark: {
    bg: '#111110',
    surface: '#1A1A19',
    surfaceAlt: '#232321',
    ink: '#F3F1EC',
    muted: '#A29D93',
    border: 'rgba(243, 241, 236, 0.14)',
    borderStrong: 'rgba(243, 241, 236, 0.32)',
    accent: '#D4F53C',
    accentInk: '#131313',
    danger: '#E06A50',
    overlay: 'rgba(0, 0, 0, 0.6)',
    shimmer: 'rgba(243, 241, 236, 0.08)',
  },
};

export const spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  s: 10,
  m: 16,
  l: 24,
  xl: 32,
  pill: 999,
} as const;

export const fonts = {
  /** Loaded in the root layout from @expo-google-fonts/instrument-serif. */
  display: 'InstrumentSerif_400Regular',
  displayItalic: 'InstrumentSerif_400Regular_Italic',
} as const;

export const type = {
  display: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44 },
  displayItalic: { fontFamily: fonts.displayItalic, fontSize: 40, lineHeight: 44 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 23 },
  caption: { fontSize: 13, lineHeight: 18 },
  micro: { fontSize: 11, lineHeight: 14, letterSpacing: 1.4, textTransform: 'uppercase' },
} as const;

export interface Theme {
  colors: ThemeColors;
  scheme: 'light' | 'dark';
}

export function useTheme(): Theme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { colors: palette[scheme], scheme };
}
