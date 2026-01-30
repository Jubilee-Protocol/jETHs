'use client';

import Image from 'next/image';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useChainId, useWaitForTransactionReceipt, useConnect } from 'wagmi';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatUnits, parseUnits } from 'viem';
import { CONTRACTS } from '../config';
import { useIsMiniApp, useMiniAppReady } from './hooks/useMiniApp';
import { TreasuryMode } from './components/TreasuryMode';
import { TutorialModal, useTutorial } from './components/TutorialModal';
import { FASBDashboard } from './components/FASBDashboard';
import { OnrampModal } from './components/OnrampModal';

// Min deposit constant
const MIN_DEPOSIT_ETH = 0.01;

// Strategy ABI
const STRATEGY_ABI = [
    {
        name: 'getStrategyStatus',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{
            type: 'tuple',
            components: [
                { name: 'isPaused', type: 'bool' },
                { name: 'isCBTriggered', type: 'bool' },
                { name: 'isInOracleFailureMode', type: 'bool' },
                { name: 'totalHoldings', type: 'uint256' },
                { name: 'dailySwapUsed', type: 'uint256' },
                { name: 'dailySwapLimit', type: 'uint256' },
                { name: 'lastGasCost', type: 'uint256' },
                {
                    name: 'stats',
                    type: 'tuple',
                    components: [
                        { name: 'rebalancesExecuted', type: 'uint256' },
                        { name: 'rebalancesFailed', type: 'uint256' },
                        { name: 'swapsExecuted', type: 'uint256' },
                        { name: 'swapsFailed', type: 'uint256' },
                        { name: 'failCount', type: 'uint256' },
                        { name: 'timeUntilReset', type: 'uint256' }
                    ]
                },
                {
                    name: 'allocs',
                    type: 'tuple',
                    components: [
                        { name: 'wsteth', type: 'uint256' },
                        { name: 'cbeth', type: 'uint256' },
                        { name: 'reth', type: 'uint256' }
                    ]
                },
                { name: 'nextWithdrawalId', type: 'uint256' },
                { name: 'withdrawalDelay', type: 'uint256' },
            ]
        }]
    },
    {
        name: 'deposit',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }],
        outputs: [{ name: 'shares', type: 'uint256' }]
    },
    {
        name: 'redeem',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'shares', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'owner', type: 'address' }],
        outputs: [{ name: 'assets', type: 'uint256' }]
    },
    {
        name: 'convertToAssets',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'shares', type: 'uint256' }],
        outputs: [{ name: 'assets', type: 'uint256' }]
    },
] as const;

const ERC20_ABI = [
    { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
    { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
    { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const;

// Theme types
type Theme = 'light' | 'dark';

// Get gradient style based on theme
const getGradientStyle = (theme: Theme) => ({
    background: theme === 'light'
        ? `
            radial-gradient(ellipse at top left, rgba(98, 126, 234, 0.12) 0%, transparent 50%),
            radial-gradient(ellipse at bottom right, rgba(98, 126, 234, 0.08) 0%, transparent 50%),
            linear-gradient(135deg, #fefefe 0%, #f5f7ff 100%)
        `
        : `
            radial-gradient(ellipse at top left, rgba(98, 126, 234, 0.15) 0%, transparent 60%),
            radial-gradient(ellipse at bottom right, rgba(98, 126, 234, 0.15) 0%, transparent 60%),
            #0a0a0f
        `,
    minHeight: '100vh'
});

// Theme colors
const colors = {
    light: {
        bg: '#FFFFFF',
        card: '#FFFFFF',
        cardBorder: 'rgba(98, 126, 234, 0.1)',
        text: '#3B3B3B',
        textMuted: '#6B7280',
        textLight: '#9CA3AF',
        inputBg: '#F9FAFB',
    },
    dark: {
        bg: '#0a0a0f',
        card: '#1a1a2e',
        cardBorder: 'rgba(98, 126, 234, 0.2)',
        text: '#E5E7EB',
        textMuted: '#9CA3AF',
        textLight: '#6B7280',
        inputBg: '#16162a',
    }
};

// Toast component
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'pending'; onClose: () => void }) {
    useEffect(() => {
        if (type !== 'pending') {
            const timer = setTimeout(onClose, 5000);
            return () => clearTimeout(timer);
        }
    }, [type, onClose]);

    const bgColor = type === 'success' ? '#22C55E' : type === 'error' ? '#EF4444' : '#627EEA';

    return (
        <div style={{
            position: 'fixed',
            bottom: '16px',
            left: '16px',
            right: '16px',
            background: bgColor,
            color: 'white',
            padding: '14px 20px',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 9999,
            animation: 'slideIn 0.3s ease'
        }}>
            {type === 'pending' && (
                <div style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid white',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    flexShrink: 0
                }} />
            )}
            {type === 'success' && <span>✓</span>}
            {type === 'error' && <span>✕</span>}
            <span style={{ flex: 1, fontSize: '14px' }}>{message}</span>
            {type !== 'pending' && (
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px', padding: '4px' }}>×</button>
            )}
        </div>
    );
}

// Skeleton loader component
function Skeleton({ width = '60px', height = '18px' }: { width?: string; height?: string }) {
    return (
        <div style={{
            width,
            height,
            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            borderRadius: '4px',
            display: 'inline-block',
        }} />
    );
}

// Transaction history type
interface TxHistoryItem {
    type: 'deposit' | 'withdraw';
    amount: string;
    timestamp: number;
    hash: string;
}

export default function Home() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const { connectors, connect } = useConnect();
    const [depositAmount, setDepositAmount] = useState('');
    const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
    const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(true);
    const [rememberDevice, setRememberDevice] = useState(false);
    const [ethPrice, setEthPrice] = useState(2500);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'pending' } | null>(null);
    const [theme, setTheme] = useState<Theme>('light');
    const [showHistory, setShowHistory] = useState(false);
    const [txHistory, setTxHistory] = useState<TxHistoryItem[]>([]);
    const [showTreasuryMode, setShowTreasuryMode] = useState(false);
    const [showFASBDashboard, setShowFASBDashboard] = useState(false);
    const [showOnramp, setShowOnramp] = useState(false);

    // Tutorial hook
    const { showTutorial, completeTutorial, reopenTutorial } = useTutorial();

    const isMiniApp = useIsMiniApp();
    useMiniAppReady();

    // Get theme colors
    const c = colors[theme];

    // Contract write hooks
    const { writeContract: approveToken, data: approveHash, isPending: isApproving, error: approveError, reset: resetApprove } = useWriteContract();
    const { writeContract: depositAssets, data: depositHash, isPending: isDepositing, error: depositError, reset: resetDeposit } = useWriteContract();
    const { writeContract: redeemShares, data: redeemHash, isPending: isRedeeming, error: redeemError, reset: resetRedeem } = useWriteContract();

    const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess, isError: isApproveFailed } = useWaitForTransactionReceipt({ hash: approveHash });
    const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess, isError: isDepositFailed } = useWaitForTransactionReceipt({ hash: depositHash });
    const { isLoading: isRedeemConfirming, isSuccess: isRedeemSuccess, isError: isRedeemFailed } = useWaitForTransactionReceipt({ hash: redeemHash });

    // Auto-connect for Farcaster mini app
    useEffect(() => {
        if (isMiniApp && !isConnected && connectors.length > 0) {
            const coinbaseConnector = connectors.find(c => c.name.toLowerCase().includes('coinbase'));
            const injectedConnector = connectors.find(c => c.name.toLowerCase().includes('injected'));
            const targetConnector = coinbaseConnector || injectedConnector;
            if (targetConnector) {
                const timer = setTimeout(() => connect({ connector: targetConnector }), 500);
                return () => clearTimeout(timer);
            }
        }
    }, [isMiniApp, isConnected, connectors, connect]);

    // Load theme from localStorage
    useEffect(() => {
        const savedTheme = localStorage.getItem('jeths-theme') as Theme | null;
        if (savedTheme) {
            setTheme(savedTheme);
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setTheme('dark');
        }
    }, []);

    // Toggle theme
    const toggleTheme = useCallback(() => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('jeths-theme', newTheme);
    }, [theme]);

    // Load transaction history
    useEffect(() => {
        if (address) {
            const saved = localStorage.getItem(`jeths-history-${address}`);
            if (saved) setTxHistory(JSON.parse(saved));
        }
    }, [address]);

    // Save transaction to history
    const saveTxToHistory = useCallback((type: 'deposit' | 'withdraw', amount: string, hash: string) => {
        if (!address) return;
        const newTx: TxHistoryItem = { type, amount, timestamp: Date.now(), hash };
        const updated = [newTx, ...txHistory].slice(0, 20);
        setTxHistory(updated);
        localStorage.setItem(`jeths-history-${address}`, JSON.stringify(updated));
    }, [address, txHistory]);

    // Fetch live ETH price from CoinGecko
    useEffect(() => {
        const fetchPrice = async () => {
            try {
                const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
                const data = await res.json();
                if (data?.ethereum?.usd) setEthPrice(data.ethereum.usd);
            } catch (err) {
                console.log('Price fetch failed, using fallback');
            }
        };
        fetchPrice();
        const interval = setInterval(fetchPrice, 60000);
        return () => clearInterval(interval);
    }, []);

    // Check localStorage for remembered terms
    useEffect(() => {
        const remembered = localStorage.getItem('jeths-terms-remembered');
        if (remembered === 'true') {
            setHasAcceptedTerms(true);
            setShowTermsModal(false);
        }
    }, []);

    // Handle transaction success
    useEffect(() => {
        if (isDepositSuccess && depositHash) {
            setToast({ message: 'Deposit successful! You received jETHs tokens.', type: 'success' });
            saveTxToHistory('deposit', depositAmount, depositHash);
            setDepositAmount('');
        }
    }, [isDepositSuccess]);

    useEffect(() => {
        if (isRedeemSuccess && redeemHash) {
            setToast({ message: 'Withdrawal successful! WETH sent to your wallet.', type: 'success' });
            saveTxToHistory('withdraw', depositAmount, redeemHash);
            setDepositAmount('');
        }
    }, [isRedeemSuccess]);

    useEffect(() => {
        if (isApproveSuccess && depositAmount && address) {
            setToast({ message: 'Approval confirmed! Now depositing...', type: 'pending' });
            resetApprove();
            refetchAllowance().then(() => {
                const amountWei = parseUnits(depositAmount, 18);
                depositAssets({
                    address: vaultAddress,
                    abi: STRATEGY_ABI,
                    functionName: 'deposit',
                    args: [amountWei, address],
                } as any);
            });
        }
    }, [isApproveSuccess]);

    // Handle errors
    useEffect(() => {
        if (approveError) {
            const msg = approveError.message.includes('User rejected') ? 'Approval cancelled by user' : 'Approval failed';
            setToast({ message: msg, type: 'error' });
            resetApprove();
        }
    }, [approveError]);

    useEffect(() => {
        if (depositError) {
            const msg = depositError.message.includes('User rejected') ? 'Deposit cancelled by user' : 'Deposit failed';
            setToast({ message: msg, type: 'error' });
            resetDeposit();
        }
    }, [depositError]);

    useEffect(() => {
        if (redeemError) {
            const msg = redeemError.message.includes('User rejected') ? 'Withdrawal cancelled by user' : 'Withdrawal failed';
            setToast({ message: msg, type: 'error' });
            resetRedeem();
        }
    }, [redeemError]);

    const handleAcceptTerms = () => {
        if (rememberDevice) localStorage.setItem('jeths-terms-remembered', 'true');
        setHasAcceptedTerms(true);
        setShowTermsModal(false);
    };

    const isMainnet = chainId === 1;
    const contracts = isMainnet ? CONTRACTS.mainnet : CONTRACTS.sepolia;
    const strategyAddress = contracts.strategy as `0x${string}`;
    const vaultAddress = contracts.vault as `0x${string}`;
    const wethAddress = contracts.weth as `0x${string}`;

    // Read contract data
    const { data: strategyStatus, refetch: refetchStatus, isLoading: isLoadingStatus } = useReadContract({
        address: strategyAddress,
        abi: STRATEGY_ABI,
        functionName: 'getStrategyStatus',
    });

    const { data: wethBalance, refetch: refetchWeth } = useReadContract({
        address: wethAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
    });

    const { data: jETHsBalance, refetch: refetchJETHs } = useReadContract({
        address: vaultAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
    });

    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: wethAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address ? [address, vaultAddress] : undefined,
    });

    // Share ratio
    const { data: shareRatio } = useReadContract({
        address: strategyAddress,
        abi: STRATEGY_ABI,
        functionName: 'convertToAssets',
        args: [BigInt(1e18)],
    });

    const shareRatioDisplay = shareRatio ? (Number(formatUnits(shareRatio, 18))).toFixed(6) : '1.000000';

    // Allocation percentages
    const wstPercent = strategyStatus ? Number(strategyStatus.allocs.wsteth) / 100 : 40;
    const cbethPercent = strategyStatus ? Number(strategyStatus.allocs.cbeth) / 100 : 35;
    const rethPercent = strategyStatus ? Number(strategyStatus.allocs.reth) / 100 : 25;
    const totalHoldings = strategyStatus ? Number(formatUnits(strategyStatus.totalHoldings, 18)) : 0;
    const depositUsdValue = parseFloat(depositAmount || '0') * ethPrice;

    // Handle deposit
    const handleDeposit = async () => {
        if (!address || !depositAmount) return;
        try {
            const amountWei = parseUnits(depositAmount, 18);
            if (!allowance || allowance < amountWei) {
                setToast({ message: 'Approving WETH (one-time)...', type: 'pending' });
                const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
                approveToken({
                    address: wethAddress,
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [vaultAddress, MAX_UINT256],
                } as any);
                return;
            }
            setToast({ message: 'Depositing WETH...', type: 'pending' });
            depositAssets({
                address: vaultAddress,
                abi: STRATEGY_ABI,
                functionName: 'deposit',
                args: [amountWei, address],
            } as any);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
            setToast({ message: errorMessage, type: 'error' });
        }
    };

    // Handle withdraw
    const handleWithdraw = async () => {
        if (!address || !depositAmount) return;
        try {
            const sharesWei = parseUnits(depositAmount, 18);
            setToast({ message: 'Withdrawing WETH...', type: 'pending' });
            redeemShares({
                address: vaultAddress,
                abi: STRATEGY_ABI,
                functionName: 'redeem',
                args: [sharesWei, address, address],
            } as any);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
            setToast({ message: errorMessage, type: 'error' });
        }
    };

    // Refetch all balances
    const refetchAll = useCallback(() => {
        refetchWeth();
        refetchJETHs();
        refetchStatus();
        refetchAllowance();
    }, [refetchWeth, refetchJETHs, refetchStatus, refetchAllowance]);

    useEffect(() => {
        if (isDepositSuccess || isRedeemSuccess) {
            refetchAll();
            const t1 = setTimeout(refetchAll, 2000);
            const t2 = setTimeout(refetchAll, 5000);
            return () => { clearTimeout(t1); clearTimeout(t2); };
        }
    }, [isDepositSuccess, isRedeemSuccess, refetchAll]);

    const isLoading = isApproving || isDepositing || isRedeeming || isApproveConfirming || isDepositConfirming || isRedeemConfirming;

    // Terms Modal
    if (showTermsModal && !hasAcceptedTerms) {
        return (
            <div style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '20px'
            }}>
                <div style={{
                    background: 'white',
                    borderRadius: '24px',
                    maxWidth: '560px',
                    width: '100%',
                    padding: '40px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(98, 126, 234, 0.1)'
                }}>
                    <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '8px' }}>
                            <Image src="/jubilee-logo-pink.png" alt="Jubilee" width={40} height={40} />
                            <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#3B3B3B' }}>jETHs</span>
                        </div>
                        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#627EEA' }}>
                            Terms of Use
                        </h2>
                    </div>

                    <div style={{
                        background: 'linear-gradient(135deg, rgba(98, 126, 234, 0.08) 0%, rgba(98, 126, 234, 0.08) 100%)',
                        borderRadius: '16px',
                        padding: '24px',
                        marginBottom: '28px',
                        maxHeight: '320px',
                        overflowY: 'auto',
                        fontSize: '13px',
                        lineHeight: '1.7',
                        color: '#4B5563',
                        border: '1px solid rgba(98, 126, 234, 0.1)'
                    }}>
                        <p style={{ marginBottom: '16px', fontWeight: '600', color: '#3B3B3B' }}>
                            By using jETHs, a product of Jubilee Protocol governed by Hundredfold Foundation, you acknowledge and agree:
                        </p>
                        <p style={{ marginBottom: '14px' }}>
                            <strong style={{ color: '#627EEA' }}>(a)</strong> jETHs is provided on an &quot;AS-IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties.
                        </p>
                        <p style={{ marginBottom: '14px' }}>
                            <strong style={{ color: '#627EEA' }}>(b)</strong> DeFi protocols carry significant risks including smart contract vulnerabilities, market volatility, and potential loss of funds.
                        </p>
                        <p style={{ marginBottom: '14px' }}>
                            <strong style={{ color: '#FFA500' }}>(c)</strong> This is not financial, legal, or tax advice. You are solely responsible for your investment decisions.
                        </p>
                    </div>

                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        marginBottom: '16px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#6B7280'
                    }}>
                        <input
                            type="checkbox"
                            checked={rememberDevice}
                            onChange={(e) => setRememberDevice(e.target.checked)}
                            style={{ width: '18px', height: '18px', accentColor: '#627EEA', cursor: 'pointer' }}
                        />
                        Remember this device
                    </label>

                    <button
                        onClick={handleAcceptTerms}
                        style={{
                            width: '100%',
                            padding: '20px 40px',
                            background: 'linear-gradient(135deg, #627EEA 0%, #4B5EC6 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '16px',
                            fontSize: '20px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(98, 126, 234, 0.4)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        I Understand &amp; Accept
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <style jsx global>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
            `}</style>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Treasury Mode Modal */}
            <TreasuryMode
                isOpen={showTreasuryMode}
                onClose={() => setShowTreasuryMode(false)}
                theme={theme}
            />

            {/* Tutorial Modal */}
            <TutorialModal
                isOpen={showTutorial}
                onClose={completeTutorial}
                theme={theme}
                ethPrice={ethPrice}
            />

            {/* FASB Dashboard Modal */}
            <FASBDashboard
                isOpen={showFASBDashboard}
                onClose={() => setShowFASBDashboard(false)}
                theme={theme}
                ethPrice={ethPrice}
            />

            {/* Onramp Modal */}
            <OnrampModal
                isOpen={showOnramp}
                onClose={() => setShowOnramp(false)}
                theme={theme}
                ethPrice={ethPrice}
            />

            <main style={getGradientStyle(theme)} className="flex flex-col">
                {/* Header */}
                <header style={{
                    padding: '20px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Image src="/jubilee-logo-pink.png" alt="Jubilee" width={32} height={32} />
                        <span style={{ fontSize: '22px', fontWeight: 'bold', color: c.text }}>jETHs</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                        {/* Dark mode toggle */}
                        <button
                            onClick={toggleTheme}
                            style={{
                                background: theme === 'dark' ? '#1a1a2e' : '#F3F4F6',
                                border: 'none',
                                borderRadius: '50%',
                                width: '36px',
                                height: '36px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '16px'
                            }}
                            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                        >
                            {theme === 'light' ? '🌙' : '☀️'}
                        </button>
                        {/* Treasury Mode */}
                        <button
                            onClick={() => setShowTreasuryMode(true)}
                            style={{
                                background: theme === 'dark' ? '#1a1a2e' : '#F3F4F6',
                                border: 'none',
                                borderRadius: '50%',
                                width: '36px',
                                height: '36px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '16px',
                            }}
                            title="Treasury Mode"
                        >
                            🏛️
                        </button>
                        <ConnectButton />
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex-1 flex items-center justify-center px-6 py-8">
                    <div className="w-full max-w-[480px]">
                        {/* Card */}
                        <div style={{
                            background: c.card,
                            borderRadius: '16px',
                            padding: '32px',
                            boxShadow: '0 4px 24px rgba(98, 126, 234, 0.08)',
                            border: `1px solid ${c.cardBorder}`
                        }}>
                            {/* Testnet Banner */}
                            {!isMainnet && (
                                <div style={{
                                    background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
                                    border: '1px solid #F59E0B',
                                    borderRadius: '12px',
                                    padding: '12px 16px',
                                    marginBottom: '24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '12px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '16px' }}>⚠️</span>
                                        <span style={{ fontSize: '13px', color: '#92400E', fontWeight: '500' }}>Sepolia Testnet</span>
                                    </div>
                                    <a
                                        href="https://sepoliafaucet.com"
                                        target="_blank"
                                        style={{
                                            background: '#F59E0B',
                                            color: 'white',
                                            padding: '6px 12px',
                                            borderRadius: '20px',
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            textDecoration: 'none'
                                        }}
                                    >
                                        Get Sepolia ETH →
                                    </a>
                                </div>
                            )}

                            {/* Tabs */}
                            <div style={{ display: 'flex', gap: '32px', marginBottom: '32px', borderBottom: `1px solid ${c.cardBorder}`, paddingBottom: '16px' }}>
                                <button
                                    onClick={() => setActiveTab('deposit')}
                                    style={{
                                        fontSize: '18px',
                                        fontWeight: '600',
                                        color: activeTab === 'deposit' ? '#627EEA' : c.textLight,
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Deposit
                                </button>
                                <button
                                    onClick={() => setActiveTab('withdraw')}
                                    style={{
                                        fontSize: '18px',
                                        fontWeight: '600',
                                        color: activeTab === 'withdraw' ? '#627EEA' : c.textLight,
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Withdraw
                                </button>
                                {isConnected && (
                                    <button
                                        onClick={() => setShowHistory(!showHistory)}
                                        style={{
                                            marginLeft: 'auto',
                                            fontSize: '14px',
                                            color: showHistory ? '#627EEA' : c.textLight,
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        History
                                    </button>
                                )}
                            </div>

                            {/* Transaction History Panel */}
                            {showHistory && isConnected && (
                                <div style={{
                                    marginBottom: '24px',
                                    padding: '16px',
                                    background: c.inputBg,
                                    borderRadius: '12px',
                                    maxHeight: '200px',
                                    overflowY: 'auto'
                                }}>
                                    <div style={{ fontSize: '14px', fontWeight: '600', color: c.text, marginBottom: '12px' }}>
                                        Recent Transactions
                                    </div>
                                    {txHistory.length === 0 ? (
                                        <div style={{ fontSize: '13px', color: c.textMuted }}>No transactions yet</div>
                                    ) : (
                                        txHistory.map((tx, i) => (
                                            <div key={i} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '10px 0',
                                                borderBottom: i < txHistory.length - 1 ? `1px solid ${c.cardBorder}` : 'none'
                                            }}>
                                                <div>
                                                    <span style={{
                                                        color: tx.type === 'deposit' ? '#22C55E' : '#F59E0B',
                                                        fontWeight: '500',
                                                        fontSize: '13px'
                                                    }}>
                                                        {tx.type === 'deposit' ? '↓ Deposit' : '↑ Withdraw'}
                                                    </span>
                                                    <span style={{ marginLeft: '8px', color: c.text, fontSize: '13px' }}>
                                                        {tx.amount} ETH
                                                    </span>
                                                </div>
                                                <a
                                                    href={`https://sepolia.etherscan.io/tx/${tx.hash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ color: '#627EEA', fontSize: '12px' }}
                                                >
                                                    View ↗
                                                </a>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* Input Section */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {/* Input Token */}
                                <div style={{ background: c.inputBg, borderRadius: '16px', padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: c.textMuted, marginBottom: '16px' }}>
                                        <span>{activeTab === 'deposit' ? 'You deposit' : 'You withdraw'}</span>
                                        <span>
                                            Balance: <span style={{ color: c.text, fontWeight: '500' }}>
                                                {activeTab === 'deposit'
                                                    ? (wethBalance ? parseFloat(formatUnits(wethBalance, 18)).toFixed(4) : '0.00')
                                                    : (jETHsBalance ? parseFloat(formatUnits(jETHsBalance, 18)).toFixed(4) : '0.00')
                                                }
                                            </span>
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="0"
                                            value={depositAmount}
                                            onChange={(e) => setDepositAmount(e.target.value)}
                                            style={{
                                                fontSize: '28px',
                                                fontWeight: '600',
                                                background: 'transparent',
                                                border: 'none',
                                                outline: 'none',
                                                width: '100%',
                                                color: c.text
                                            }}
                                        />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                            <button
                                                onClick={() => {
                                                    const balance = activeTab === 'deposit' ? wethBalance : jETHsBalance;
                                                    setDepositAmount(balance ? formatUnits(balance, 18) : '0');
                                                }}
                                                style={{ color: '#627EEA', fontSize: '14px', fontWeight: '500', background: 'none', border: 'none', cursor: 'pointer' }}
                                            >
                                                Max
                                            </button>
                                            {activeTab === 'deposit' ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#DBEAFE', borderRadius: '20px', padding: '6px 12px' }}>
                                                    <div style={{ width: '20px', height: '20px', background: '#627EEA', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <span style={{ color: 'white', fontSize: '9px', fontWeight: 'bold' }}>Ξ</span>
                                                    </div>
                                                    <span style={{ color: '#3B3B3B', fontSize: '14px', fontWeight: '500' }}>WETH</span>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FEF3C7', borderRadius: '20px', padding: '6px 12px' }}>
                                                    <div style={{ width: '20px', height: '20px', background: '#F377BB', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <span style={{ color: 'white', fontSize: '9px', fontWeight: 'bold' }}>j</span>
                                                    </div>
                                                    <span style={{ color: '#3B3B3B', fontSize: '14px', fontWeight: '500' }}>jETHs</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '14px', color: c.textLight, marginTop: '12px' }}>≈ ${depositUsdValue.toLocaleString()}</div>
                                </div>

                                {/* Arrow */}
                                <div style={{ display: 'flex', justifyContent: 'center', margin: '-4px 0' }}>
                                    <button
                                        onClick={() => setActiveTab(activeTab === 'deposit' ? 'withdraw' : 'deposit')}
                                        style={{
                                            background: c.card,
                                            border: `1px solid ${c.cardBorder}`,
                                            borderRadius: '50%',
                                            padding: '12px',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c.text} strokeWidth="2">
                                            <line x1="12" y1="5" x2="12" y2="19" />
                                            <polyline points="19 12 12 19 5 12" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Output Token */}
                                <div style={{ background: c.inputBg, borderRadius: '16px', padding: '20px' }}>
                                    <div style={{ fontSize: '14px', color: c.textMuted, marginBottom: '16px' }}>You receive</div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '28px', fontWeight: '600', color: c.text }}>{depositAmount || '0'}</span>
                                        {activeTab === 'deposit' ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FEF3C7', borderRadius: '20px', padding: '8px 16px' }}>
                                                <div style={{ width: '24px', height: '24px', background: '#F377BB', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <span style={{ color: 'white', fontSize: '10px', fontWeight: 'bold' }}>j</span>
                                                </div>
                                                <span style={{ color: '#3B3B3B', fontSize: '14px', fontWeight: '500' }}>jETHs</span>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#DBEAFE', borderRadius: '20px', padding: '8px 16px' }}>
                                                <div style={{ width: '24px', height: '24px', background: '#627EEA', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <span style={{ color: 'white', fontSize: '10px', fontWeight: 'bold' }}>Ξ</span>
                                                </div>
                                                <span style={{ color: '#3B3B3B', fontSize: '14px', fontWeight: '500' }}>WETH</span>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '14px', color: c.textLight, marginTop: '12px' }}>
                                        1 jETHs = {shareRatioDisplay} ETH
                                    </div>
                                </div>

                                {/* Min deposit + Get WETH hint */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: c.textLight, padding: '0 8px' }}>
                                    <span>Min. deposit: {MIN_DEPOSIT_ETH} ETH ≈ ${(MIN_DEPOSIT_ETH * ethPrice).toLocaleString()}</span>
                                    <button
                                        onClick={() => setShowOnramp(true)}
                                        style={{ color: '#627EEA', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                                    >
                                        Get WETH →
                                    </button>
                                </div>
                                <div style={{ fontSize: '10px', color: c.textLight, opacity: 0.7, textAlign: 'center', marginTop: '4px' }}>
                                    Price by <a href="https://www.coingecko.com/" target="_blank" rel="noopener noreferrer" style={{ color: c.textLight, textDecoration: 'underline' }}>CoinGecko</a>
                                </div>

                                {/* Action Button */}
                                {!isConnected ? (
                                    <div style={{ width: '100%' }}>
                                        <ConnectButton.Custom>
                                            {({ openConnectModal }) => (
                                                <button
                                                    onClick={openConnectModal}
                                                    style={{
                                                        width: '100%',
                                                        padding: '18px',
                                                        marginTop: '8px',
                                                        borderRadius: '50px',
                                                        fontSize: '18px',
                                                        fontWeight: '600',
                                                        background: 'linear-gradient(135deg, #627EEA 0%, #4B5EC6 100%)',
                                                        color: 'white',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        boxShadow: '0 4px 14px rgba(98, 126, 234, 0.3)'
                                                    }}
                                                >
                                                    Connect Wallet
                                                </button>
                                            )}
                                        </ConnectButton.Custom>
                                    </div>
                                ) : (
                                    <button
                                        onClick={activeTab === 'deposit' ? handleDeposit : handleWithdraw}
                                        disabled={isLoading || !depositAmount || parseFloat(depositAmount) <= 0}
                                        style={{
                                            width: '100%',
                                            padding: '18px',
                                            marginTop: '8px',
                                            borderRadius: '50px',
                                            fontSize: '18px',
                                            fontWeight: '600',
                                            background: (depositAmount && parseFloat(depositAmount) > 0 && !isLoading)
                                                ? 'linear-gradient(135deg, #627EEA 0%, #4B5EC6 100%)'
                                                : theme === 'dark' ? '#2a2a3e' : '#E5E7EB',
                                            color: (depositAmount && parseFloat(depositAmount) > 0 && !isLoading) ? 'white' : c.textLight,
                                            border: 'none',
                                            cursor: (depositAmount && parseFloat(depositAmount) > 0 && !isLoading) ? 'pointer' : 'not-allowed',
                                            boxShadow: (depositAmount && parseFloat(depositAmount) > 0 && !isLoading) ? '0 4px 14px rgba(98, 126, 234, 0.3)' : 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        {isLoading && (
                                            <div style={{
                                                width: '18px',
                                                height: '18px',
                                                border: '2px solid currentColor',
                                                borderTopColor: 'transparent',
                                                borderRadius: '50%',
                                                animation: 'spin 1s linear infinite'
                                            }} />
                                        )}
                                        {isLoading
                                            ? 'Processing...'
                                            : (depositAmount && parseFloat(depositAmount) > 0
                                                ? (activeTab === 'deposit' ? 'Deposit WETH' : 'Withdraw WETH')
                                                : 'Enter an amount'
                                            )
                                        }
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Stats Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginTop: '24px' }}>
                            <div style={{ background: c.card, borderRadius: '12px', padding: '12px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: `1px solid ${c.cardBorder}` }}>
                                <div style={{ fontSize: '10px', color: c.textLight, textTransform: 'uppercase', marginBottom: '4px' }}>TVL</div>
                                <div style={{ fontSize: '14px', fontWeight: '600', color: c.text }}>
                                    {isLoadingStatus ? <Skeleton width="50px" /> : totalHoldings.toFixed(2)}
                                </div>
                            </div>
                            <div style={{ background: c.card, borderRadius: '12px', padding: '12px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: `1px solid ${c.cardBorder}` }}>
                                <div style={{ fontSize: '10px', color: c.textLight, textTransform: 'uppercase', marginBottom: '4px' }}>APY</div>
                                <div style={{ fontSize: '14px', fontWeight: '600', color: '#627EEA' }}>7-9%</div>
                            </div>
                            <div style={{ background: c.card, borderRadius: '12px', padding: '12px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: `1px solid ${c.cardBorder}` }}>
                                <div style={{ fontSize: '10px', color: c.textLight, textTransform: 'uppercase', marginBottom: '4px' }}>wstETH</div>
                                <div style={{ fontSize: '14px', fontWeight: '600', color: '#00A3FF' }}>
                                    {isLoadingStatus ? <Skeleton width="40px" /> : `${wstPercent.toFixed(0)}%`}
                                </div>
                            </div>
                            <div style={{ background: c.card, borderRadius: '12px', padding: '12px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: `1px solid ${c.cardBorder}` }}>
                                <div style={{ fontSize: '10px', color: c.textLight, textTransform: 'uppercase', marginBottom: '4px' }}>cbETH</div>
                                <div style={{ fontSize: '14px', fontWeight: '600', color: '#0052FF' }}>
                                    {isLoadingStatus ? <Skeleton width="40px" /> : `${cbethPercent.toFixed(0)}%`}
                                </div>
                            </div>
                            <div style={{ background: c.card, borderRadius: '12px', padding: '12px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: `1px solid ${c.cardBorder}` }}>
                                <div style={{ fontSize: '10px', color: c.textLight, textTransform: 'uppercase', marginBottom: '4px' }}>rETH</div>
                                <div style={{ fontSize: '14px', fontWeight: '600', color: '#FF6B35' }}>
                                    {isLoadingStatus ? <Skeleton width="40px" /> : `${rethPercent.toFixed(0)}%`}
                                </div>
                            </div>
                        </div>

                        {/* User Balances */}
                        {isConnected && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '16px', fontSize: '13px', color: c.textMuted }}>
                                <span>
                                    Your WETH: <strong style={{ color: '#627EEA' }}>{wethBalance ? parseFloat(formatUnits(wethBalance, 18)).toFixed(4) : '0'}</strong>
                                </span>
                                <span>
                                    Your jETHs: <strong style={{ color: '#F377BB' }}>{jETHsBalance ? parseFloat(formatUnits(jETHsBalance, 18)).toFixed(4) : '0'}</strong>
                                </span>
                            </div>
                        )}

                        {/* Status & Links */}
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginTop: '20px', fontSize: '14px', flexWrap: 'wrap' }}>
                            <span style={{ color: strategyStatus?.isPaused ? '#EF4444' : '#22C55E' }}>
                                ● {strategyStatus?.isPaused ? 'Paused' : 'Active'}
                            </span>
                            <a href={`https://sepolia.etherscan.io/address/${strategyAddress}`} target="_blank" rel="noopener noreferrer" style={{ color: c.textLight }}>
                                Contract ↗
                            </a>
                            <a href="https://github.com/Jubilee-Protocol/jETHs/blob/main/docs/AUDIT_REPORT.md" target="_blank" rel="noopener noreferrer" style={{ color: c.textLight }}>
                                Audit ↗
                            </a>
                            <a href="https://github.com/Jubilee-Protocol/jETHs#readme" target="_blank" rel="noopener noreferrer" style={{ color: c.textLight }}>
                                FAQ ↗
                            </a>
                            <a href="https://jubileeprotocol.xyz" target="_blank" rel="noopener noreferrer" style={{ color: c.textLight }}>
                                Learn More ↗
                            </a>
                            <a
                                href="mailto:contact@jubileeprotocol.xyz"
                                title="Contact us for support"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #F377BB 0%, #627EEA 100%)',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: '700',
                                    textDecoration: 'none',
                                    marginLeft: '4px'
                                }}
                            >
                                ✉
                            </a>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <footer style={{
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px',
                }}>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button
                            onClick={reopenTutorial}
                            style={{
                                background: 'transparent',
                                border: `1px solid ${c.cardBorder}`,
                                borderRadius: '8px',
                                padding: '8px 16px',
                                color: c.textMuted,
                                cursor: 'pointer',
                                fontSize: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                            }}
                        >
                            📖 Tutorial
                        </button>
                        <button
                            onClick={() => setShowFASBDashboard(true)}
                            style={{
                                background: 'transparent',
                                border: `1px solid ${c.cardBorder}`,
                                borderRadius: '8px',
                                padding: '8px 16px',
                                color: c.textMuted,
                                cursor: 'pointer',
                                fontSize: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                            }}
                        >
                            📊 FASB Report
                        </button>
                        <button
                            onClick={() => setShowTreasuryMode(true)}
                            style={{
                                background: 'transparent',
                                border: `1px solid ${c.cardBorder}`,
                                borderRadius: '8px',
                                padding: '8px 16px',
                                color: c.textMuted,
                                cursor: 'pointer',
                                fontSize: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                            }}
                        >
                            🏛️ Treasury Mode
                        </button>
                    </div>
                    <div style={{ fontSize: '13px', color: c.textLight, display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <a href={`https://sepolia.etherscan.io/address/${contracts.strategy}`} target="_blank" style={{ color: c.textMuted }}>Contract ↗</a>
                        <a href="https://github.com/Jubilee-Protocol/jETHs" target="_blank" style={{ color: c.textMuted }}>GitHub ↗</a>
                        <a href="https://jubileeprotocol.xyz" target="_blank" style={{ color: c.textMuted }}>Learn More ↗</a>
                    </div>
                    <div style={{ fontSize: '12px', color: c.textLight }}>
                        2026 © Jubilee Protocol · Governed by Hundredfold Foundation
                    </div>
                </footer>
            </main>
        </>
    );
}
