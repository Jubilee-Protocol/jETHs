'use client';

import Image from 'next/image';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useChainId, useWaitForTransactionReceipt, useConnect } from 'wagmi';
import { useState, useEffect } from 'react';
import { formatUnits, parseUnits } from 'viem';
import { CONTRACTS } from '../config';
import { useIsMiniApp, useMiniAppReady } from './hooks/useMiniApp';
import { useTheme } from './providers';

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

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'pending'; onClose: () => void }) {
    useEffect(() => {
        if (type !== 'pending') {
            const timer = setTimeout(onClose, 5000);
            return () => clearTimeout(timer);
        }
    }, [type, onClose]);
    const bgColor = type === 'success' ? '#22C55E' : type === 'error' ? '#EF4444' : '#627EEA';
    return (
        <div style={{ position: 'fixed', bottom: '24px', left: '24px', right: '24px', background: bgColor, color: 'white', padding: '16px 24px', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: '12px', zIndex: 9999, animation: 'slideIn 0.3s ease' }}>
            {type === 'pending' && <div style={{ width: '18px', height: '18px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />}
            <span style={{ flex: 1, fontSize: '14px', fontWeight: '600' }}>{message}</span>
            {type !== 'pending' && <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '20px' }}>×</button>}
        </div>
    );
}

interface TxHistoryItem { type: 'deposit' | 'withdraw'; amount: string; timestamp: number; hash: string; }

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
    const [txHistory, setTxHistory] = useState<TxHistoryItem[]>([]);

    const isMiniApp = useIsMiniApp();
    useMiniAppReady();

    useEffect(() => {
        if (isMiniApp && !isConnected && connectors.length > 0) {
            const connector = connectors.find(c => c.name.toLowerCase().includes('coinbase')) || connectors[0];
            if (connector) setTimeout(() => connect({ connector }), 500);
        }
    }, [isMiniApp, isConnected, connectors, connect]);

    const { writeContract: approveToken, data: approveHash } = useWriteContract();
    const { writeContract: depositAssets, data: depositHash } = useWriteContract();
    const { writeContract: redeemShares, data: redeemHash } = useWriteContract();

    const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });
    const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({ hash: depositHash });
    const { isLoading: isRedeemConfirming, isSuccess: isRedeemSuccess } = useWaitForTransactionReceipt({ hash: redeemHash });

    useEffect(() => {
        if (address) {
            const saved = localStorage.getItem(`jeths-history-${address}`);
            if (saved) setTxHistory(JSON.parse(saved));
        }
    }, [address]);

    const saveTx = (type: 'deposit' | 'withdraw', amount: string, hash: string) => {
        if (!address) return;
        const updated = [{ type, amount, timestamp: Date.now(), hash }, ...txHistory].slice(0, 10);
        setTxHistory(updated);
        localStorage.setItem(`jeths-history-${address}`, JSON.stringify(updated));
    }

    useEffect(() => {
        if (isDepositSuccess) { setToast({ message: 'Deposit successful!', type: 'success' }); saveTx('deposit', depositAmount, depositHash!); setDepositAmount(''); }
    }, [isDepositSuccess]);

    useEffect(() => {
        if (isRedeemSuccess) { setToast({ message: 'Withdrawal requested!', type: 'success' }); saveTx('withdraw', depositAmount, redeemHash!); setDepositAmount(''); }
    }, [isRedeemSuccess]);

    useEffect(() => {
        if (isApproveSuccess && depositAmount) handleDeposit();
    }, [isApproveSuccess]);

    const isMainnet = chainId === 1;
    const contracts = isMainnet ? CONTRACTS.mainnet : CONTRACTS.sepolia;
    const strategyAddress = contracts.strategy as `0x${string}`;
    const vaultAddress = contracts.vault as `0x${string}`;
    const wethAddress = contracts.weth as `0x${string}`;

    const { data: strategyStatus } = useReadContract({ address: strategyAddress, abi: STRATEGY_ABI, functionName: 'getStrategyStatus' });
    const { data: wethBalance } = useReadContract({ address: wethAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: address ? [address] : undefined });
    const { data: jETHsBalance } = useReadContract({ address: vaultAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: address ? [address] : undefined });
    const { data: allowance } = useReadContract({ address: wethAddress, abi: ERC20_ABI, functionName: 'allowance', args: address ? [address, vaultAddress] : undefined });
    const { data: shareRatio } = useReadContract({ address: strategyAddress, abi: STRATEGY_ABI, functionName: 'convertToAssets', args: [BigInt(1e18)] });

    const totalHoldings = strategyStatus ? Number(formatUnits(strategyStatus.totalHoldings, 18)) : 0;
    const wstPercent = strategyStatus ? Number(strategyStatus.allocs.wsteth) / 100 : 40;
    const cbethPercent = strategyStatus ? Number(strategyStatus.allocs.cbeth) / 100 : 35;
    const rethPercent = strategyStatus ? Number(strategyStatus.allocs.reth) / 100 : 25;
    const depositUsdValue = parseFloat(depositAmount || '0') * ethPrice;

    const handleDeposit = async () => {
        if (!address || !depositAmount) return;
        const amountWei = parseUnits(depositAmount, 18);
        if (!allowance || allowance < amountWei) {
            setToast({ message: 'Approving WETH...', type: 'pending' });
            approveToken({ address: wethAddress, abi: ERC20_ABI, functionName: 'approve', args: [vaultAddress, amountWei] } as any);
        } else {
            setToast({ message: 'Depositing WETH...', type: 'pending' });
            depositAssets({ address: vaultAddress, abi: STRATEGY_ABI, functionName: 'deposit', args: [amountWei, address] } as any);
        }
    };

    const handleWithdraw = async () => {
        if (!address || !depositAmount) return;
        setToast({ message: 'Queueing withdrawal...', type: 'pending' });
        redeemShares({ address: vaultAddress, abi: STRATEGY_ABI, functionName: 'redeem', args: [parseUnits(depositAmount, 18), address, address] } as any);
    };

    const isLoading = isApproveConfirming || isDepositConfirming || isRedeemConfirming;

    useEffect(() => {
        const remembered = localStorage.getItem('jeths-terms-remembered');
        if (remembered === 'true') { setHasAcceptedTerms(true); setShowTermsModal(false); }
    }, []);

    // Terms Modal
    if (showTermsModal && !hasAcceptedTerms) {
        return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-5">
                <div className="bg-[#111] border border-white/10 rounded-2xl max-w-[420px] w-full p-8 text-center">
                    <Image src="/jubilee-logo-pink.png" alt="Jubilee" width={48} height={48} className="mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-white mb-2">jETHs Terms of Use</h2>
                    <div className="bg-black/40 rounded-xl p-4 text-left text-sm text-gray-400 max-h-[250px] overflow-y-auto mb-6 border border-white/5">
                        <p className="mb-3">By using jETHs, a product of Jubilee Protocol governed by Hundredfold Foundation, you acknowledge:</p>
                        <p className="mb-2"><span className="text-[#627EEA] font-medium">(a)</span> jETHs is provided "AS-IS" without warranties.</p>
                        <p className="mb-2"><span className="text-[#627EEA] font-medium">(b)</span> DeFi protocols carry significant risks including smart contract vulnerabilities and market volatility.</p>
                        <p><span className="text-[#627EEA] font-medium">(c)</span> You are solely responsible for your investment decisions.</p>
                    </div>
                    <label className="flex items-center gap-2 justify-center mb-6 text-sm text-gray-500 cursor-pointer">
                        <input type="checkbox" checked={rememberDevice} onChange={e => setRememberDevice(e.target.checked)} className="w-4 h-4" />
                        Remember this device
                    </label>
                    <button
                        onClick={() => { if (rememberDevice) localStorage.setItem('jeths-terms-remembered', 'true'); setHasAcceptedTerms(true); setShowTermsModal(false); }}
                        className="w-full py-4 bg-gradient-to-r from-[#627EEA] to-[#0052FF] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
                    >
                        I Understand & Accept
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
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
            `}</style>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <main className="min-h-screen bg-[#050505] text-white flex flex-col">
                {/* Hero Header */}
                <div className="text-center pt-16 pb-8">
                    <Image src="/jubilee-logo-pink.png" alt="jETHs" width={64} height={64} className="mx-auto mb-4" />
                    <h1 className="text-4xl md:text-5xl font-bold mb-2">
                        <span className="text-[#627EEA]">The Ethereum</span><br />
                        <span className="text-white">Staking Index</span>
                    </h1>
                    <p className="text-gray-400 text-lg">Earn <span className="text-[#10B981] font-semibold">7-11% APY</span> on your ETH</p>
                </div>

                {/* Main Card */}
                <div className="flex-1 flex items-start justify-center px-4 pb-8">
                    <div className="w-full max-w-[420px]">
                        <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
                            {/* TVL & APY Row */}
                            <div className="flex justify-between items-center mb-6 text-sm">
                                <div>
                                    <span className="text-gray-500 uppercase text-xs tracking-wider">TVL</span>
                                    <div className="text-white font-bold">{totalHoldings.toFixed(4)} ETH</div>
                                </div>
                                <div className="text-right">
                                    <span className="text-gray-500 uppercase text-xs tracking-wider">Target APY</span>
                                    <div className="text-[#10B981] font-bold">7-11%</div>
                                </div>
                            </div>

                            {/* Asset Composition */}
                            <div className="flex items-center justify-center gap-3 mb-6">
                                <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-full px-4 py-2">
                                    <div className="w-6 h-6 rounded-full bg-[#627EEA] flex items-center justify-center text-xs font-bold">W</div>
                                    <span className="text-sm font-medium">wstETH</span>
                                    <span className="text-gray-500 text-sm">{wstPercent.toFixed(0)}%</span>
                                </div>
                                <span className="text-gray-600">+</span>
                                <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-full px-4 py-2">
                                    <div className="w-6 h-6 rounded-full bg-[#0052FF] flex items-center justify-center text-xs font-bold">cb</div>
                                    <span className="text-sm font-medium">cbETH</span>
                                    <span className="text-gray-500 text-sm">{cbethPercent.toFixed(0)}%</span>
                                </div>
                                <span className="text-gray-600">+</span>
                                <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-full px-4 py-2">
                                    <div className="w-6 h-6 rounded-full bg-[#FF6B6B] flex items-center justify-center text-xs font-bold">R</div>
                                    <span className="text-sm font-medium">rETH</span>
                                    <span className="text-gray-500 text-sm">{rethPercent.toFixed(0)}%</span>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex gap-6 mb-4 border-b border-white/10 pb-2">
                                <button onClick={() => setActiveTab('deposit')} className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${activeTab === 'deposit' ? 'text-[#627EEA] border-[#627EEA]' : 'text-gray-500 border-transparent hover:text-white'}`}>
                                    Deposit
                                </button>
                                <button onClick={() => setActiveTab('withdraw')} className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${activeTab === 'withdraw' ? 'text-[#627EEA] border-[#627EEA]' : 'text-gray-500 border-transparent hover:text-white'}`}>
                                    Withdraw
                                </button>
                            </div>

                            {/* Input Section */}
                            <div className="space-y-4">
                                <div className="bg-black/40 border border-white/10 rounded-xl p-4">
                                    <div className="flex justify-between text-xs text-gray-500 mb-2">
                                        <span>You {activeTab}</span>
                                        <span>Balance: {activeTab === 'deposit' ? (wethBalance ? parseFloat(formatUnits(wethBalance, 18)).toFixed(4) : '0.00') : (jETHsBalance ? parseFloat(formatUnits(jETHsBalance, 18)).toFixed(4) : '0.00')}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <input
                                            type="text"
                                            placeholder="0"
                                            value={depositAmount}
                                            onChange={e => setDepositAmount(e.target.value)}
                                            className="text-2xl font-semibold bg-transparent outline-none w-full text-white"
                                        />
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setDepositAmount(activeTab === 'deposit' ? (wethBalance ? formatUnits(wethBalance, 18) : '0') : (jETHsBalance ? formatUnits(jETHsBalance, 18) : '0'))} className="text-xs font-semibold text-[#627EEA] hover:opacity-70">Max</button>
                                            <div className="flex items-center gap-1.5 bg-white/5 rounded-full px-3 py-1.5">
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${activeTab === 'deposit' ? 'bg-[#627EEA]' : 'bg-[#F377BB]'}`}>
                                                    {activeTab === 'deposit' ? 'Ξ' : 'j'}
                                                </div>
                                                <span className="text-sm font-medium">{activeTab === 'deposit' ? 'WETH' : 'jETHs'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">≈ ${depositUsdValue.toLocaleString()}</div>
                                </div>

                                {/* Arrow */}
                                <div className="flex justify-center -my-2">
                                    <div className="w-8 h-8 rounded-full bg-[#111] border border-white/10 flex items-center justify-center text-[#627EEA]">
                                        ↓
                                    </div>
                                </div>

                                {/* Output */}
                                <div className="bg-black/40 border border-white/10 rounded-xl p-4">
                                    <div className="text-xs text-gray-500 mb-2">You receive</div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-2xl font-semibold">{depositAmount || '0'}</span>
                                        <div className="flex items-center gap-1.5 bg-white/5 rounded-full px-3 py-1.5">
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${activeTab === 'deposit' ? 'bg-[#F377BB]' : 'bg-[#627EEA]'}`}>
                                                {activeTab === 'deposit' ? 'j' : 'Ξ'}
                                            </div>
                                            <span className="text-sm font-medium">{activeTab === 'deposit' ? 'jETHs' : 'WETH'}</span>
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-2">1 jETHs = 1 WETH share</div>
                                </div>

                                {/* Action Button */}
                                {isConnected ? (
                                    <button
                                        disabled={isLoading || !depositAmount}
                                        onClick={activeTab === 'deposit' ? handleDeposit : handleWithdraw}
                                        className="w-full py-4 bg-gradient-to-r from-[#627EEA] to-[#0052FF] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? 'Processing...' : depositAmount ? (activeTab === 'deposit' ? 'Deposit' : 'Withdraw') : 'Enter an amount'}
                                    </button>
                                ) : (
                                    <div className="flex justify-center">
                                        <ConnectButton />
                                    </div>
                                )}

                                {/* Info Row */}
                                <div className="flex justify-between text-xs text-gray-500 px-1">
                                    <span>Min. deposit: 0.01 ETH</span>
                                    <span>✓ Yearn V3</span>
                                    <span>✓ No Lock-ups</span>
                                </div>
                            </div>
                        </div>

                        {/* Stats Bar */}
                        <div className="mt-4 bg-[#111] border border-white/10 rounded-xl p-4 flex justify-between items-center text-center">
                            <div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider">TVL</div>
                                <div className="text-white font-bold">{totalHoldings.toFixed(2)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider">APY</div>
                                <div className="text-[#10B981] font-bold">7-11%</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider">wstETH</div>
                                <div className="text-white font-bold">{wstPercent.toFixed(0)}%</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider">cbETH</div>
                                <div className="text-white font-bold">{cbethPercent.toFixed(0)}%</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider">rETH</div>
                                <div className="text-white font-bold">{rethPercent.toFixed(0)}%</div>
                            </div>
                        </div>

                        {/* Status Row */}
                        <div className="mt-2 text-center text-sm">
                            <span className="inline-flex items-center gap-1.5 text-[#10B981]">
                                <span className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse"></span>
                                Active
                            </span>
                            <span className="text-gray-500 ml-4">{strategyStatus?.stats?.rebalancesExecuted?.toString() || '0'} rebalances</span>
                        </div>

                        {/* Footer Links */}
                        <div className="mt-8 flex justify-center gap-8 text-sm">
                            <a href={`https://sepolia.etherscan.io/address/${strategyAddress}`} target="_blank" className="text-gray-500 hover:text-white transition-colors">Contract ↗</a>
                            <a href="https://docs.jubilee.fi" target="_blank" className="text-gray-500 hover:text-white transition-colors">Docs ↗</a>
                            <a href="https://jubilee.fi" target="_blank" className="text-gray-500 hover:text-white transition-colors">Jubilee ↗</a>
                        </div>

                        {/* Copyright */}
                        <div className="mt-8 text-center text-xs text-gray-600 pb-8">
                            2026 © Jubilee Labs
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
