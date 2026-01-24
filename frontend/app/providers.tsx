"use client";

import * as React from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import {
    RainbowKitProvider,
    darkTheme as rainbowDarkTheme,
    lightTheme as rainbowLightTheme,
} from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { config } from '../config';

const queryClient = new QueryClient();

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
    const context = React.useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within a ThemeProvider');
    return context;
}

export function Providers({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = React.useState<Theme>('light');

    React.useEffect(() => {
        const saved = localStorage.getItem('jeths-theme') as Theme;
        if (saved) {
            setTheme(saved);
            document.documentElement.classList.toggle('dark', saved === 'dark');
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            // Default to light for now as per Jubilee standards, but check system
        }
    }, []);

    const toggleTheme = () => {
        const next = theme === 'light' ? 'dark' : 'light';
        setTheme(next);
        localStorage.setItem('jeths-theme', next);
        document.documentElement.classList.toggle('dark', next === 'dark');
    };

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <ThemeContext.Provider value={{ theme, toggleTheme }}>
                    <RainbowKitProvider
                        theme={theme === 'dark' ? rainbowDarkTheme({
                            accentColor: '#0052FF',
                            accentColorForeground: 'white',
                            borderRadius: 'large',
                        }) : rainbowLightTheme({
                            accentColor: '#0052FF',
                            accentColorForeground: 'white',
                            borderRadius: 'large',
                        })}
                    >
                        {children}
                    </RainbowKitProvider>
                </ThemeContext.Provider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
