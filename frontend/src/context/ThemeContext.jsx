import React, { createContext, useState, useEffect } from 'react';

export const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const isManual = localStorage.getItem('pulsechat_theme_manual') === 'true';
    const saved = localStorage.getItem('pulsechat_theme');
    // If user previously defaulted to 'light', upgrade to 'midnight_amoled'
    if (isManual && saved && saved !== 'light') {
      return saved;
    }
    return 'midnight_amoled';
  });
  const [wallpaper, setWallpaper] = useState(localStorage.getItem('pulsechat_wallpaper') || 'default');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pulsechat_theme', theme);

    // Sync window / browser status bar color with active theme
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const themeColors = {
        midnight_amoled: '#000000',
        dark: '#0b0f19',
        light: '#f3f4f6',
        emerald: '#071e16',
        neon: '#05050d',
        sunset: '#1c0a14',
        ocean: '#061325',
        gold_nitro: '#0c0903',
        royal_gold: '#0c0903',
        nebula: '#0c071e',
        cyber_glow: '#030d12',
        aurora_borealis: '#02121c',
        blood_moon: '#0d0205',
        tokyo_synth: '#0d061f'
      };
      metaThemeColor.setAttribute('content', themeColors[theme] || '#000000');
    }
  }, [theme]);

  const changeTheme = (newTheme) => {
    localStorage.setItem('pulsechat_theme_manual', 'true');
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, changeTheme, wallpaper, setWallpaper }}>
      {children}
    </ThemeContext.Provider>
  );
}
