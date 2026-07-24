import React, { createContext, useState, useEffect } from 'react';

export const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(localStorage.getItem('pulsechat_theme') || 'dark');
  const [wallpaper, setWallpaper] = useState(localStorage.getItem('pulsechat_wallpaper') || 'default');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pulsechat_theme', theme);
  }, [theme]);

  const changeTheme = (newTheme) => {
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, changeTheme, wallpaper, setWallpaper }}>
      {children}
    </ThemeContext.Provider>
  );
}
