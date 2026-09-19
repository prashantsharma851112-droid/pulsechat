import React, { createContext, useState, useEffect } from 'react';

export const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const isManual = localStorage.getItem('pulsechat_theme_manual') === 'true';
    if (isManual) {
      return localStorage.getItem('pulsechat_theme') || 'light';
    }
    return 'light';
  });
  const [wallpaper, setWallpaper] = useState(localStorage.getItem('pulsechat_wallpaper') || 'default');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pulsechat_theme', theme);
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
