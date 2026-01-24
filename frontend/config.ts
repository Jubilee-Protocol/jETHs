import { http, createConfig } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import {
    rainbowWallet,
    walletConnectWallet,
    coinbaseWallet,
    metaMaskWallet
} from '@rainbow-me/rainbowkit/wallets'

const connectors = connectorsForWallets(
    [
        {
            groupName: 'Recommended',
            wallets: [coinbaseWallet, metaMaskWallet, rainbowWallet, walletConnectWallet],
        },
    ],
    {
        appName: 'jETHs - Jubilee Ethereum Index',
        projectId: '6f385306b6aa92e6c664d8e5759748c2',
    }
)

export const config = createConfig({
    chains: [mainnet, sepolia],
    connectors: connectors,
    transports: {
        [mainnet.id]: http(process.env.NEXT_PUBLIC_MAINNET_RPC_URL || 'https://eth.llamarpc.com'),
        [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://rpc.sepolia.org'),
    },
})

export const CONTRACTS = {
    mainnet: {
        strategy: '0x', // To be deployed
        vault: '0x',    // To be deployed
        weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    },
    sepolia: {
        strategy: '0xBA984EBfE0458a0bcaEF9186BECD1004476248b5',
        vault: '0xB3f462F54Ea57a54744712DE527494e9A6bF2219',
        weth: '0x595211c89774c7976818BF6927e6782Df0dadB09',
    }
}
