'use client';

import Image from 'next/image';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useChainId, useWaitForTransactionReceipt, useConnect } from 'wagmi';
import { useState, useEffect } from 'react';
import { formatUnits, parseUnits } from 'viem';
import { CONTRACTS } from '../config';
import { useIsMiniApp, useMiniAppReady } from './hooks/useMiniApp';

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
        <div style={{ position: 'fixed', bottom: '24px', left: '24px', right: '24px', background: bgColor, color: 'white', padding: '16px 24px', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: '12px', zIndex: 9999 }}>
            {type === 'pending' && <div style={{ width: '18px', height: '18px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />}
            <span style={{ flex: 1, fontSize: '14px', fontWeight: '600' }}>{message}</span>
            {type !== 'pending' && <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '20px' }}>×</button>}
        </div>
    );
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
        if (isDepositSuccess) { setToast({ message: 'Deposit successful!', type: 'success' }); setDepositAmount(''); }
    }, [isDepositSuccess]);

    useEffect(() => {
        if (isRedeemSuccess) { setToast({ message: 'Withdrawal successful!', type: 'success' }); setDepositAmount(''); }
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
        setToast({ message: 'Withdrawing...', type: 'pending' });
        redeemShares({ address: vaultAddress, abi: STRATEGY_ABI, functionName: 'redeem', args: [parseUnits(depositAmount, 18), address, address] } as any);
    };

    const toggleMode = () => {
        setActiveTab(activeTab === 'deposit' ? 'withdraw' : 'deposit');
    };

    const isLoading = isApproveConfirming || isDepositConfirming || isRedeemConfirming;

    useEffect(() => {
        const remembered = localStorage.getItem('jeths-terms-remembered');
        if (remembered === 'true') { setHasAcceptedTerms(true); setShowTermsModal(false); }
    }, []);

    // Terms Modal
    if (showTermsModal && !hasAcceptedTerms) {
        return (
            <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] p-5">
                <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl max-w-[420px] w-full p-8 text-center">
                    <Image src="/jubilee-logo-pink.png" alt="Jubilee" width={48} height={48} className="mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-white mb-2">jETHs Terms of Use</h2>
                    <div className="bg-black/40 rounded-xl p-4 text-left text-sm text-gray-400 max-h-[250px] overflow-y-auto mb-6 border border-white/5">
                        <p className="mb-3">By using jETHs, a product of Jubilee Protocol governed by Hundredfold Foundation, you acknowledge:</p>
                        <p className="mb-2"><span className="text-[#627EEA] font-medium">(a)</span> jETHs is provided "AS-IS" without warranties.</p>
                        <p className="mb-2"><span className="text-[#627EEA] font-medium">(b)</span> DeFi protocols carry significant risks including smart contract vulnerabilities and market volatility.</p>
                        <p><span className="text-[#627EEA] font-medium">(c)</span> You are solely responsible for your investment decisions.</p>
                    </div>
                    <label className="flex items-center gap-2 justify-center mb-6 text-sm text-gray-500 cursor-pointer">
                        <input type="checkbox" checked={rememberDevice} onChange={e => setRememberDevice(e.target.checked)} className="w-4 h-4 accent-[#627EEA]" />
                        Remember this device
                    </label>
                    <button
                        onClick={() => { if (rememberDevice) localStorage.setItem('jeths-terms-remembered', 'true'); setHasAcceptedTerms(true); setShowTermsModal(false); }}
                        className="w-full py-4 bg-[#627EEA] text-white font-semibold rounded-xl hover:bg-[#5570d8] transition-colors"
                    >
                        I Understand & Accept
                    </button>
                </div>
            </div>
        );
    }

    const inputToken = activeTab === 'deposit' ? 'WETH' : 'jETHs';
    const outputToken = activeTab === 'deposit' ? 'jETHs' : 'WETH';
    const inputBalance = activeTab === 'deposit' ? wethBalance : jETHsBalance;

    return (
        <>
            <style jsx global>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
            `}</style>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <main className="min-h-screen bg-[#000000] text-white">
                {/* Testnet Banner */}
                <div className="bg-[#F59E0B]/20 border-b border-[#F59E0B]/30 py-2 px-4 text-center text-sm">
                    <span className="text-[#F59E0B] font-medium">⚠️ SEPOLIA TESTNET</span>
                    <span className="text-[#F59E0B]/80 ml-2">— This is a test environment. Tokens have no real value.</span>
                    <a href="https://sepoliafaucet.com" target="_blank" className="ml-3 text-[#627EEA] hover:underline">💧 Get Sepolia ETH</a>
                </div>

                {/* Header */}
                <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2">
                            <Image src="/jubilee-logo-pink.png" alt="jETHs" width={28} height={28} />
                            <span className="text-lg font-bold">jETHs</span>
                        </div>
                        <nav className="hidden sm:flex items-center gap-6 text-sm text-gray-400">
                            <span className="text-white font-medium border-b-2 border-[#627EEA] pb-1">Vault</span>
                            <a href={`https://sepolia.etherscan.io/address/0x27143095013184e718f92330C32A3D2eE9974053`} target="_blank" className="hover:text-white transition-colors">Contract</a>
                            <a href="https://github.com/Jubilee-Protocol/jETHs#readme" target="_blank" className="hover:text-white transition-colors">Docs</a>
                        </nav>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 bg-white/5 rounded-full px-3 py-1.5 text-sm">
                            <div className="w-2 h-2 bg-[#F59E0B] rounded-full"></div>
                            <span className="text-gray-400">Sepolia</span>
                        </div>
                        <ConnectButton showBalance={false} chainStatus="none" />
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex flex-col items-center justify-center px-4 py-12">
                    {/* Main Card - 480px max width, 32px padding */}
                    <div className="w-full max-w-[480px] bg-[#0a0a0a] border border-[#627EEA]/20 rounded-2xl p-8">
                        {/* Tabs */}
                        <div className="flex items-center gap-6 mb-8">
                            <button
                                onClick={() => setActiveTab('deposit')}
                                className={`text-base font-semibold pb-2 border-b-2 transition-all ${activeTab === 'deposit' ? 'text-[#627EEA] border-[#627EEA]' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
                            >
                                Deposit
                            </button>
                            <button
                                onClick={() => setActiveTab('withdraw')}
                                className={`text-base font-semibold pb-2 border-b-2 transition-all ${activeTab === 'withdraw' ? 'text-[#627EEA] border-[#627EEA]' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
                            >
                                Withdraw
                            </button>
                        </div>

                        {/* Deposit Input Box - 20px padding */}
                        <div className="bg-[#111] border border-white/5 rounded-2xl p-5 mb-2">
                            <div className="flex justify-between text-sm text-gray-500 mb-3">
                                <span>You {activeTab}</span>
                                <span>Balance: {inputBalance ? parseFloat(formatUnits(inputBalance, 18)).toFixed(4) : '0.00'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <input
                                    type="text"
                                    placeholder="0"
                                    value={depositAmount}
                                    onChange={e => setDepositAmount(e.target.value)}
                                    className="text-3xl font-semibold bg-transparent outline-none w-full text-white placeholder-gray-600"
                                />
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => setDepositAmount(inputBalance ? formatUnits(inputBalance, 18) : '0')}
                                        className="text-xs font-semibold text-[#627EEA] hover:text-[#8CA1F7] transition-colors px-2 py-1"
                                    >
                                        Max
                                    </button>
                                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-2">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${activeTab === 'deposit' ? 'bg-[#627EEA]' : 'bg-[#F377BB]'}`}>
                                            {activeTab === 'deposit' ? 'Ξ' : 'j'}
                                        </div>
                                        <span className="text-sm font-medium">{inputToken}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-sm text-gray-500 mt-2">≈ ${depositUsdValue.toLocaleString()}</div>
                        </div>

                        {/* Toggle Arrow Button */}
                        <div className="flex justify-center -my-4 relative z-10">
                            <button
                                onClick={toggleMode}
                                className="w-10 h-10 rounded-full bg-[#0a0a0a] border border-white/10 flex items-center justify-center text-[#627EEA] hover:border-[#627EEA] hover:bg-[#627EEA]/10 transition-all cursor-pointer"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M7 10l5 5 5-5" />
                                </svg>
                            </button>
                        </div>

                        {/* Receive Output Box */}
                        <div className="bg-[#111] border border-white/5 rounded-2xl p-5 mt-2">
                            <div className="text-sm text-gray-500 mb-3">You receive</div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-3xl font-semibold text-white">{depositAmount || '0'}</span>
                                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-2">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${activeTab === 'deposit' ? 'bg-[#F377BB]' : 'bg-[#627EEA]'}`}>
                                        {activeTab === 'deposit' ? 'j' : 'Ξ'}
                                    </div>
                                    <span className="text-sm font-medium">{outputToken}</span>
                                </div>
                            </div>
                            <div className="text-sm text-gray-500 mt-2">1 jETHs = 1 WETH share</div>
                        </div>

                        {/* Info Row */}
                        <div className="flex items-center justify-between text-xs text-gray-500 mt-4 px-1">
                            <span>Min. deposit: 0.01 ETH</span>
                            <div className="flex items-center gap-4">
                                <span>✓ Yearn V3</span>
                                <span>✓ No Lock-ups</span>
                            </div>
                        </div>

                        {/* Action Button */}
                        <div className="mt-6">
                            {isConnected ? (
                                <button
                                    disabled={isLoading || !depositAmount}
                                    onClick={activeTab === 'deposit' ? handleDeposit : handleWithdraw}
                                    className="w-full py-4 bg-[#627EEA] text-white font-semibold rounded-xl hover:bg-[#5570d8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#627EEA]"
                                >
                                    {isLoading ? 'Processing...' : depositAmount ? (activeTab === 'deposit' ? 'Deposit' : 'Withdraw') : 'Enter an amount'}
                                </button>
                            ) : (
                                <div className="flex justify-center">
                                    <ConnectButton />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats Bar - Below Main Card */}
                    <div className="w-full max-w-[480px] grid grid-cols-5 gap-3 mt-4">
                        <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-3 text-center">
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">TVL</div>
                            <div className="text-sm font-bold">{totalHoldings.toFixed(2)}</div>
                        </div>
                        <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-3 text-center">
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">APY</div>
                            <div className="text-sm font-bold text-[#10B981]">7-11%</div>
                        </div>
                        <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-3 text-center">
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">wstETH</div>
                            <div className="text-sm font-bold">{wstPercent.toFixed(0)}%</div>
                        </div>
                        <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-3 text-center">
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">cbETH</div>
                            <div className="text-sm font-bold">{cbethPercent.toFixed(0)}%</div>
                        </div>
                        <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-3 text-center">
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">rETH</div>
                            <div className="text-sm font-bold">{rethPercent.toFixed(0)}%</div>
                        </div>
                    </div>

                    {/* Status & Rebalances */}
                    <div className="mt-3 text-center text-sm">
                        <span className="inline-flex items-center gap-1.5 text-[#10B981]">
                            <span className="w-2 h-2 bg-[#10B981] rounded-full" style={{ animation: 'pulse 2s infinite' }}></span>
                            Active
                        </span>
                        <span className="text-gray-500 ml-4">{strategyStatus?.stats?.rebalancesExecuted?.toString() || '0'} rebalances</span>
                    </div>

                    {/* Footer Links */}
                    <div className="mt-10 flex flex-wrap justify-center gap-6 text-sm">
                        <a href={`https://sepolia.etherscan.io/address/0x27143095013184e718f92330C32A3D2eE9974053`} target="_blank" className="text-gray-500 hover:text-white transition-colors">Contract ↗</a>
                        <a href="https://github.com/Jubilee-Protocol/jETHs/blob/main/docs/AUDIT_REPORT.md" target="_blank" className="text-gray-500 hover:text-white transition-colors">Audit ↗</a>
                        <a href="https://github.com/Jubilee-Protocol/jETHs#readme" target="_blank" className="text-gray-500 hover:text-white transition-colors">Docs ↗</a>
                        <a href="https://jubileeprotocol.xyz" target="_blank" className="text-gray-500 hover:text-white transition-colors">Jubilee ↗</a>
                    </div>

                    {/* Copyright */}
                    <div className="mt-8 text-center text-xs text-gray-600 pb-8">
                        2026 © Jubilee Labs · Governed by Hundredfold Foundation
                    </div>
                </div>
            </main>
        </>
    );
}
