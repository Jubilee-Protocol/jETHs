'use client';

import Image from 'next/image';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useChainId, useWaitForTransactionReceipt, useConnect } from 'wagmi';
import { useState, useEffect, useCallback } from 'react';
import { formatUnits, parseUnits } from 'viem';
import { CONTRACTS } from '../config';
import { useIsMiniApp, useMiniAppReady } from './hooks/useMiniApp';

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

const getGradientStyle = () => ({
    background: 'var(--eth-bg)',
    minHeight: '100vh',
    color: 'var(--text-primary)'
});

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
    const [showHistory, setShowHistory] = useState(false);
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

    const { data: strategyStatus, refetch: refetchStatus } = useReadContract({ address: strategyAddress, abi: STRATEGY_ABI, functionName: 'getStrategyStatus' });
    const { data: wethBalance, refetch: refetchWETH } = useReadContract({ address: wethAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: address ? [address] : undefined });
    const { data: jETHsBalance, refetch: refetchJETHs } = useReadContract({ address: vaultAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: address ? [address] : undefined });
    const { data: allowance, refetch: refetchAllowance } = useReadContract({ address: wethAddress, abi: ERC20_ABI, functionName: 'allowance', args: address ? [address, vaultAddress] : undefined });
    const { data: shareRatio } = useReadContract({ address: strategyAddress, abi: STRATEGY_ABI, functionName: 'convertToAssets', args: [BigInt(1e18)] });

    const shareRatioDisplay = shareRatio ? (Number(formatUnits(shareRatio, 18))).toFixed(6) : '1.000000';
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

    if (showTermsModal && !hasAcceptedTerms) {
        return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
                <div style={{ background: 'white', borderRadius: '32px', maxWidth: '500px', width: '100%', padding: '40px', boxShadow: '0 25px 70px rgba(0,0,0,0.1)', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                        <Image src="/jubilee-logo-pink.png" alt="Jubilee" width={40} height={40} />
                        <span style={{ fontSize: '16px', fontWeight: '400', color: '#1A1A1A' }}>jETHs</span>
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#0052FF', marginBottom: '24px' }}>Terms of Use</h2>
                    <div style={{ background: '#F8F9FA', borderRadius: '20px', padding: '24px', textAlign: 'left', fontSize: '13px', lineHeight: '1.6', color: '#666666', maxHeight: '300px', overflowY: 'auto', marginBottom: '24px', border: '1px solid rgba(0, 82, 255, 0.05)' }}>
                        <p style={{ marginBottom: '16px', fontWeight: '600', color: '#1A1A1A' }}>
                            By using jETHs, a product of Jubilee Protocol governed by Hundredfold Foundation and developed by Jubilee Labs, you acknowledge and agree:
                        </p>
                        <p style={{ marginBottom: '14px' }}>
                            <strong style={{ color: '#0052FF' }}>(a)</strong> jETHs is provided on an &quot;AS-IS&quot; and &quot;AS AVAILABLE&quot; basis. Hundredfold Foundation, Jubilee Labs, and their affiliates expressly disclaim all representations, warranties, and conditions of any kind, whether express, implied, or statutory.
                        </p>
                        <p style={{ marginBottom: '14px' }}>
                            <strong style={{ color: '#0052FF' }}>(b)</strong> Neither Hundredfold Foundation nor Jubilee Labs makes any warranty that jETHs will meet your requirements, be available on an uninterrupted, timely, secure, or error-free basis, or be accurate, reliable, or free of harmful code.
                        </p>
                        <p style={{ marginBottom: '14px' }}>
                            <strong style={{ color: '#0052FF' }}>(c)</strong> You shall have no claim against Hundredfold Foundation, Jubilee Labs, or their affiliates for any loss arising from your use of jETHs or Jubilee Protocol products.
                        </p>
                        <p style={{ marginBottom: '14px' }}>
                            <strong style={{ color: '#0052FF' }}>(d)</strong> DeFi protocols carry significant risks including: smart contract vulnerabilities, market volatility, oracle failures, and potential total loss of deposited funds.
                        </p>
                        <p>
                            <strong style={{ color: '#0052FF' }}>(e)</strong> This is not financial, legal, or tax advice. You are solely responsible for your own investment decisions and due diligence.
                        </p>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', marginBottom: '24px', cursor: 'pointer', fontSize: '14px', color: '#666666' }}>
                        <input type="checkbox" checked={rememberDevice} onChange={e => setRememberDevice(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} /> Remember this device
                    </label>
                    <button onClick={() => { if (rememberDevice) localStorage.setItem('jeths-terms-remembered', 'true'); setHasAcceptedTerms(true); setShowTermsModal(false); }} className="btn-blue w-full">I Understand & Accept</button>
                    <div style={{ marginTop: '16px', fontSize: '11px', color: '#9CA3AF' }}>
                        By clicking Accept, you agree to the Jubilee Protocol Terms of Service
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <style jsx global>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            `}</style>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <main style={getGradientStyle()} className="flex flex-col bg-vignette">
                <header style={{ padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <Image src="/jubilee-logo-pink.png" alt="logo" width={42} height={42} />
                        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#1A1A1A' }}>jETHs</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex gap-3 mr-4">
                            <a href="https://twitter.com/jubileeprotocol" target="_blank" rel="noopener noreferrer" className="social-icon"><svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg></a>
                            <a href="https://warpcast.com/jubilee" target="_blank" rel="noopener noreferrer" className="social-icon"><svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M23.2 12.8c0-5.4-4.5-9.8-10.1-9.8S3 7.4 3 12.8c0 3.7 2 6.9 5 8.7L5.5 24h15l-2.5-2.5c3-1.8 5.2-5 5.2-8.7z" /></svg></a>
                        </div>
                        <ConnectButton />
                    </div>
                </header>

                <div className="flex-1 flex flex-col items-center justify-center p-6">
                    <div className="w-full max-w-[480px]">
                        <div className="card p-8">
                            <div className="flex gap-8 mb-8 border-b border-black/5 pb-3">
                                <button onClick={() => setActiveTab('deposit')} className={`tab-btn ${activeTab === 'deposit' ? 'active' : ''}`} style={{ position: 'relative' }}>
                                    Deposit {activeTab === 'deposit' && <div className="absolute -bottom-[13px] left-0 right-0 h-0.5 bg-[#0052FF]" />}
                                </button>
                                <button onClick={() => setActiveTab('withdraw')} className={`tab-btn ${activeTab === 'withdraw' ? 'active' : ''}`} style={{ position: 'relative' }}>
                                    Withdraw {activeTab === 'withdraw' && <div className="absolute -bottom-[13px] left-0 right-0 h-0.5 bg-[#0052FF]" />}
                                </button>
                                {isConnected && <button onClick={() => setShowHistory(!showHistory)} className="ml-auto text-xs font-bold text-black/20 uppercase tracking-widest hover:text-black transition-colors">History</button>}
                            </div>

                            <div className="space-y-6">
                                <div className="input-container">
                                    <div className="flex justify-between text-[13px] font-medium text-[#666666] mb-3">
                                        <span>You {activeTab}</span>
                                        <span>Balance: {activeTab === 'deposit' ? (wethBalance ? parseFloat(formatUnits(wethBalance, 18)).toFixed(2) : '0.00') : (jETHsBalance ? parseFloat(formatUnits(jETHsBalance, 18)).toFixed(2) : '0.00')}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <input type="text" placeholder="0" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} className="text-[28px] font-semibold bg-transparent outline-none w-full text-[#1A1A1A]" />
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setDepositAmount(activeTab === 'deposit' ? (wethBalance ? formatUnits(wethBalance, 18) : '0') : (jETHsBalance ? formatUnits(jETHsBalance, 18) : '0'))} className="text-[12px] font-semibold text-[#0052FF] hover:opacity-70 transition-opacity">Max</button>
                                            <div className="flex items-center gap-2 bg-[#F0F2F5] rounded-full px-3 py-1.5">
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${activeTab === 'deposit' ? 'bg-[#0052FF]' : 'bg-[#F377BB]'}`}>{activeTab === 'deposit' ? 'W' : 'j'}</div>
                                                <span className="text-sm font-semibold text-[#1A1A1A]">{activeTab === 'deposit' ? 'cbWETH' : 'jETHs'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-[13px] text-[#666666]">
                                        ≈ ${depositUsdValue.toLocaleString()}
                                    </div>
                                </div>

                                <div className="flex justify-center -my-9 relative z-10">
                                    <div className="bg-white border border-black/5 rounded-full p-2.5 shadow-lg text-[#0052FF] cursor-pointer hover:scale-110 transition-transform">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5V19M19 12l-7 7-7-7" /></svg>
                                    </div>
                                </div>

                                <div className="input-container">
                                    <div className="text-[13px] font-medium text-[#666666] mb-3">You receive</div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[28px] font-semibold text-[#1A1A1A]">{depositAmount || '0'}</span>
                                        <div className="flex items-center gap-2 bg-[#F0F2F5] rounded-full px-3 py-1.5">
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${activeTab === 'deposit' ? 'bg-[#F377BB]' : 'bg-[#0052FF]'}`}>{activeTab === 'deposit' ? 'j' : 'W'}</div>
                                            <span className="text-sm font-semibold text-[#1A1A1A]">{activeTab === 'deposit' ? 'jETHs' : 'cbWETH'}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center mt-3 text-[13px] text-[#666666]">
                                        <span>1 jETHs = {shareRatioDisplay} ETH</span>
                                        {activeTab === 'deposit' && <a href="https://app.uniswap.org" target="_blank" className="text-[#0052FF] font-medium hover:underline">Get cbWETH →</a>}
                                    </div>
                                </div>

                                <button disabled={isLoading || !depositAmount} onClick={activeTab === 'deposit' ? handleDeposit : handleWithdraw} className="btn-blue w-full mt-2">
                                    {isLoading ? 'Processing...' : !address ? 'Connect Wallet' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                                </button>

                                <div className="flex justify-between px-1 attribution-text">
                                    <span>Price by CoinGecko</span>
                                    <span>Min. deposit: 0.01 ETH</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 grid grid-cols-2 gap-4">
                            <div className="card p-6 text-center">
                                <div className="text-[12px] font-medium text-[#666666] uppercase tracking-wider mb-1">Total Value Locked</div>
                                <div className="text-[20px] font-bold text-[#1A1A1A]">{totalHoldings.toFixed(2)} ETH</div>
                                <div className="text-[12px] font-semibold text-[#10B981] mt-1">Growth: +1.2%</div>
                            </div>
                            <div className="card p-6 text-center">
                                <div className="text-[12px] font-medium text-[#666666] uppercase tracking-wider mb-1">Estimated APY</div>
                                <div className="text-[20px] font-bold text-[#0052FF]">7.2% - 11.4%</div>
                                <div className="text-[12px] font-medium text-[#666666] mt-1">Daily Comp.</div>
                            </div>
                        </div>

                        <div className="card mt-4 p-5 flex justify-between px-10">
                            {[['wstETH', wstPercent], ['cbETH', cbethPercent], ['rETH', rethPercent]].map(([name, p], i) => (
                                <div key={i} className="flex flex-col items-center">
                                    <span className="text-[11px] font-medium text-[#666666] uppercase tracking-wider mb-1">{name as string}</span>
                                    <span className="text-[14px] font-bold text-[#1A1A1A]">{(p as number).toFixed(1)}%</span>
                                </div>
                            ))}
                        </div>

                        <footer className="mt-20 mb-12 flex flex-col items-center gap-10">
                            <div className="flex gap-8">
                                {[['Contract', isMainnet ? `https://etherscan.io/address/${strategyAddress}` : `https://sepolia.etherscan.io/address/${strategyAddress}`], ['Audit', 'https://github.com/Jubilee-Protocol/jETHs-on-Base/blob/main/docs/JETHS_AUDIT_REPORT.md'], ['FAQ', 'https://docs.jeths.xyz/faq'], ['Docs', 'https://docs.jeths.xyz']].map(([name, url], i) => (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-[12px] font-medium text-[#666666] hover:text-[#0052FF] uppercase tracking-wider flex items-center gap-1.5 transition-colors">
                                        {name} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
                                    </a>
                                ))}
                            </div>
                            <div className="text-[11px] font-medium text-[#9CA3AF] text-center uppercase tracking-[0.2em] leading-relaxed">
                                <div>2026 © Jubilee Protocol · Sepolia Testnet</div>
                                <div className="mt-2">Governed by Hundredfold Foundation</div>
                            </div>
                        </footer>
                    </div>
                </div>
            </main>
        </>
    );
}
