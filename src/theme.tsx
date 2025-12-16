import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Keep the storage key scoped to this project to avoid clashes with other demos on the same host.
const storageKey = 'vas-theme';

const getPreferredTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem(storageKey) as Theme | null;
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getPreferredTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem(storageKey, theme);
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === 'light' || saved === 'dark') return;
      setThemeState(event.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme: setThemeState,
    toggleTheme: () => setThemeState((prev) => (prev === 'light' ? 'dark' : 'light')),
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
};
