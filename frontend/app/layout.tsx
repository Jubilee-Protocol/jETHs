import '@rainbow-me/rainbowkit/styles.css';
import { Providers } from './providers';
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    metadataBase: new URL('https://mint.jeths.xyz'),
    title: 'jETHs | Liquid Staking Index on Ethereum',
    description: 'The first diversified LST Index Fund on Ethereum. Earn yield on wstETH, cbETH, and rETH via Yearn V3.',
    keywords: ['jETHs', 'Ethereum', 'LST', 'Index Fund', 'wstETH', 'cbETH', 'rETH', 'DeFi', 'Yearn'],
    icons: {
        icon: '/jubilee-logo-pink.png',
        apple: '/jubilee-logo-pink.png',
    },
    openGraph: {
        title: 'jETHs | Liquid Staking Index on Ethereum',
        description: 'The first diversified LST Index Fund on Ethereum. Earn 3-5% APY on diversified ETH exposure.',
        url: 'https://mint.jeths.xyz',
        siteName: 'jETHs',
        images: [
            {
                url: '/og-image.png',
                width: 625,
                height: 625,
                alt: 'jETHs - Ethereum Index Fund',
            },
        ],
        locale: 'en_US',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'jETHs | Liquid Staking Index on Ethereum',
        description: 'The first diversified LST Index Fund on Ethereum. Earn 3-5% APY on diversified ETH exposure.',
        images: ['/og-image.png'],
    },
    other: {
        'fc:miniapp': JSON.stringify({
            version: 'next',
            imageUrl: 'https://mint.jeths.xyz/og-image.png',
            button: {
                title: 'Open jETHs',
                action: {
                    type: 'launch_frame',
                    url: 'https://mint.jeths.xyz',
                    name: 'jETHs - Ethereum Index',
                    splashImageUrl: 'https://mint.jeths.xyz/splash.png',
                    splashBackgroundColor: '#0a0a1a'
                }
            }
        }),
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
