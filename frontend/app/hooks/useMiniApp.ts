'use client';

import { useEffect, useState } from 'react';

// Dynamically import the Farcaster SDK to avoid SSR issues
let sdkPromise: Promise<any> | null = null;

const getSdk = async () => {
    if (typeof window === 'undefined') return null;
    if (!sdkPromise) {
        sdkPromise = import('@farcaster/miniapp-sdk').then(m => m.sdk);
    }
    return sdkPromise;
};

/**
 * Hook to detect if app is running inside a Farcaster mini app context (Base App, Warpcast, etc.)
 * Returns true if running in mini app, false otherwise
 */
export function useIsMiniApp(): boolean {
    const [isMiniApp, setIsMiniApp] = useState(false);

    useEffect(() => {
        const checkMiniAppContext = () => {
            try {
                // Check if we're in an iframe (mini apps run in iframes)
                const inIframe = window !== window.parent;

                // Check for Farcaster-specific context indicators
                const hasFarcasterContext =
                    typeof window !== 'undefined' &&
                    (
                        // Check for frame context in URL
                        window.location.search.includes('fc_frame') ||
                        // Check for parent frame context
                        inIframe ||
                        // Check user agent for Warpcast/Base App
                        /warpcast|base/i.test(navigator.userAgent)
                    );

                setIsMiniApp(hasFarcasterContext);
            } catch (e) {
                // If we can't access parent (cross-origin), we're likely in a mini app
                setIsMiniApp(true);
            }
        };

        checkMiniAppContext();
    }, []);

    return isMiniApp;
}

/**
 * Hook to signal that the mini app frame is ready using Farcaster SDK
 * This hides the splash screen and shows the app
 */
export function useMiniAppReady() {
    useEffect(() => {
        const signalReady = async () => {
            try {
                const sdk = await getSdk();
                if (sdk?.actions?.ready) {
                    // Use the official Farcaster SDK ready signal
                    await sdk.actions.ready();
                    console.log('[MiniApp] Ready signal sent via Farcaster SDK');
                } else {
                    // Fallback for non-mini-app context
                    console.log('[MiniApp] Not in mini app context, skipping ready signal');
                }
            } catch (e) {
                console.warn('[MiniApp] Error signaling ready:', e);
            }
        };

        signalReady();
    }, []);
}
