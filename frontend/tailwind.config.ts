import type { Config } from 'tailwindcss';

const config: Config = {
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                'jubilee-pink': '#F377BB',
                'bitcoin-orange': '#F7931A',
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
            },
            animation: {
                'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
            },
            keyframes: {
                'pulse-glow': {
                    '0%, 100%': { boxShadow: '0 0 30px rgba(249, 115, 22, 0.3)' },
                    '50%': { boxShadow: '0 0 50px rgba(249, 115, 22, 0.5)' },
                },
            },
        },
    },
    plugins: [],
};

export default config;
