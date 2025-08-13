import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

type Theme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'dark' | 'light';
  systemTheme: 'dark' | 'light';
  toggleTheme: () => void;
  isDark: boolean;
  isLight: boolean;
  isSystem: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'system',
  storageKey = 'geovision-theme',
  enableSystem = true,
  disableTransitionOnChange = false,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Prevent hydration mismatch
    return <div style={{ visibility: 'hidden' }}>{children}</div>;
  }

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem={enableSystem}
      storageKey={storageKey}
      disableTransitionOnChange={disableTransitionOnChange}
      themes={['light', 'dark', 'system']}
    >
      <ThemeContextProvider>{children}</ThemeContextProvider>
    </NextThemesProvider>
  );
};

const ThemeContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = useState(false);
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('light');
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>('light');

  useEffect(() => {
    setMounted(true);
    
    // Get initial theme from localStorage or default
    const savedTheme = localStorage.getItem('geovision-theme') as Theme;
    if (savedTheme) {
      setThemeState(savedTheme);
    }

    // Detect system theme
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    // Listen for system theme changes
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Calculate resolved theme
    let newResolvedTheme: 'dark' | 'light';
    if (theme === 'system') {
      newResolvedTheme = systemTheme;
    } else {
      newResolvedTheme = theme;
    }

    setResolvedTheme(newResolvedTheme);

    // Apply theme to document
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(newResolvedTheme);

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        'content',
        newResolvedTheme === 'dark' ? '#0a0a0a' : '#ffffff'
      );
    }
  }, [theme, systemTheme, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('geovision-theme', newTheme);
  };

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const value: ThemeContextType = {
    theme,
    setTheme,
    resolvedTheme,
    systemTheme,
    toggleTheme,
    isDark: resolvedTheme === 'dark',
    isLight: resolvedTheme === 'light',
    isSystem: theme === 'system',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Theme toggle component
export const ThemeToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { theme, toggleTheme, isDark, isLight, isSystem } = useTheme();

  const getThemeIcon = () => {
    if (isLight) return '☀️';
    if (isDark) return '🌙';
    if (isSystem) return '💻';
    return '☀️';
  };

  const getThemeLabel = () => {
    if (isLight) return 'Light';
    if (isDark) return 'Dark';
    if (isSystem) return 'System';
    return 'Light';
  };

  return (
    <button
      onClick={toggleTheme}
      className={`
        inline-flex items-center justify-center rounded-md text-sm font-medium
        transition-colors focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50
        disabled:pointer-events-none ring-offset-background
        hover:bg-accent hover:text-accent-foreground
        h-10 py-2 px-4
        ${className}
      `}
      title={`Current theme: ${getThemeLabel()}. Click to cycle themes.`}
    >
      <span className="mr-2">{getThemeIcon()}</span>
      <span className="hidden sm:inline">{getThemeLabel()}</span>
    </button>
  );
};

// Geological theme variants (specialized for mining/geology)
export const useGeologicalTheme = () => {
  const { resolvedTheme } = useTheme();
  
  const geologicalColors = {
    light: {
      mineral: {
        gold: '#FFD700',
        silver: '#C0C0C0',
        copper: '#B87333',
        iron: '#8B4513',
        coal: '#36454F',
      },
      rock: {
        granite: '#8B7D6B',
        limestone: '#F5F5DC',
        sandstone: '#F4A460',
        shale: '#2F4F4F',
        basalt: '#36454F',
      },
      depth: {
        surface: '#90EE90',
        shallow: '#FFE4B5',
        medium: '#DEB887',
        deep: '#8B4513',
        veryDeep: '#2F4F4F',
      },
    },
    dark: {
      mineral: {
        gold: '#B8860B',
        silver: '#708090',
        copper: '#8B4513',
        iron: '#654321',
        coal: '#2F2F2F',
      },
      rock: {
        granite: '#696969',
        limestone: '#D3D3D3',
        sandstone: '#CD853F',
        shale: '#2F4F4F',
        basalt: '#1C1C1C',
      },
      depth: {
        surface: '#228B22',
        shallow: '#DAA520',
        medium: '#8B7355',
        deep: '#654321',
        veryDeep: '#1C1C1C',
      },
    },
  };

  return geologicalColors[resolvedTheme];
};

export default ThemeProvider;