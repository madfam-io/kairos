import { createContext, useContext, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings } from '~/hooks/useSettings';

export interface Theme {
  colors: {
    background: string;
    surface: string;
    surfaceVariant: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    primary: string;
    primaryVariant: string;
    success: string;
    warning: string;
    error: string;
    border: string;
  };
  isDark: boolean;
}

const darkTheme: Theme = {
  colors: {
    background: '#0a0a0a',
    surface: '#1f2937',
    surfaceVariant: '#374151',
    text: '#ffffff',
    textSecondary: '#9ca3af',
    textMuted: '#6b7280',
    primary: '#6366f1',
    primaryVariant: '#4f46e5',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    border: '#374151',
  },
  isDark: true,
};

const lightTheme: Theme = {
  colors: {
    background: '#ffffff',
    surface: '#f3f4f6',
    surfaceVariant: '#e5e7eb',
    text: '#111827',
    textSecondary: '#6b7280',
    textMuted: '#9ca3af',
    primary: '#6366f1',
    primaryVariant: '#4f46e5',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    border: '#e5e7eb',
  },
  isDark: false,
};

const ThemeContext = createContext<Theme>(darkTheme);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { settings } = useSettings();
  const systemColorScheme = useColorScheme();

  const theme = (() => {
    if (settings.theme === 'system') {
      return systemColorScheme === 'light' ? lightTheme : darkTheme;
    }
    return settings.theme === 'light' ? lightTheme : darkTheme;
  })();

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
