import { useCallback, useEffect, useState } from 'react';
import { PALETTE } from '../contract';

export type Mode = 'light' | 'dark';

/** Widened palette shape so light and dark are interchangeable. */
export interface Palette {
  surface: string;
  page: string;
  ink1: string;
  ink2: string;
  ink3: string;
  grid: string;
  axis: string;
  series: readonly string[];
  seq: readonly string[];
  good: string;
  warn: string;
  crit: string;
}

const STORAGE_KEY = 'suffolk-explorer-theme';

function initialMode(): Mode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* private mode etc. */
  }
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function useTheme(): { mode: Mode; palette: Palette; toggle: () => void } {
  const [mode, setMode] = useState<Mode>(initialMode);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  const toggle = useCallback(() => setMode((m) => (m === 'light' ? 'dark' : 'light')), []);

  const palette: Palette = PALETTE[mode];
  return { mode, palette, toggle };
}
