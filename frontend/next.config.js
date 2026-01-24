/** @type {import('next').NextConfig} */
const nextConfig = {
    // Fix for @metamask/sdk requiring @react-native-async-storage/async-storage
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
            };
        }
        // Provide an empty mock for react-native async-storage in browser builds
        config.resolve.alias = {
            ...config.resolve.alias,
            '@react-native-async-storage/async-storage': false,
        };
        return config;
    },
    // Skip TS errors from third-party packages (ox has type issues)
    typescript: {
        ignoreBuildErrors: true,
    },
    // Ignore ESLint errors during builds
    eslint: {
        ignoreDuringBuilds: true,
    },
};

module.exports = nextConfig;


