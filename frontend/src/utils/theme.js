// How the app looks, picked in Settings → Appearance and kept on this device:
// light (white), soft (off-white grey, easier on the eyes) or dark
const THEME_KEY = 'transport-theme';
const THEMES = ['light', 'soft', 'dark'];

export const getStoredTheme = () => {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return THEMES.includes(stored) ? stored : 'light';
  } catch {
    return 'light';
  }
};

// Puts the theme's class ("soft" or "dark") on <html>; index.css does the rest
export const applyTheme = (theme = getStoredTheme()) => {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('soft', theme === 'soft');
};

export const setStoredTheme = (theme) => {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage can be blocked (private window); the theme still applies for this visit
  }
  applyTheme(theme);
};
