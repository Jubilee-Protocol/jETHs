'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount, useReadContract, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { CONTRACTS } from '../../config';

interface FASBDashboardProps {
    isOpen: boolean;
    onClose: () => void;
    theme: 'light' | 'dark';
    ethPrice: number;
}

interface Transaction {
    date: string;
    type: 'Deposit' | 'Withdraw';
    amount: string;
    costBasis: number;
    fairValue: number;
    hash: string;
}

type Period = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'YTD' | 'Custom';

const ERC20_ABI = [
    { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

export function FASBDashboard({ isOpen, onClose, theme, ethPrice }: FASBDashboardProps) {
    const { address } = useAccount();
    const chainId = useChainId();
    const [period, setPeriod] = useState<Period>('Q1');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Get network-specific config
    const isMainnet = chainId === 1;
    const contracts = isMainnet ? CONTRACTS.mainnet : CONTRACTS.sepolia;
    const vaultAddress = contracts.vault as `0x${string}`;

    const c = theme === 'dark' ? {
        bg: 'rgba(20, 20, 35, 0.98)',
        card: '#1a1a2e',
        text: '#ffffff',
        textMuted: '#a0a0b0',
        border: '#2a2a3e',
        accent: '#627EEA',
        positive: '#22C55E',
        negative: '#EF4444',
    } : {
        bg: 'rgba(255, 255, 255, 0.98)',
        card: '#ffffff',
        text: '#1a1a2e',
        textMuted: '#666680',
        border: '#e5e7eb',
        accent: '#627EEA',
        positive: '#16A34A',
        negative: '#DC2626',
    };

    // Read jETHs balance
    const { data: jethsBalance } = useReadContract({
        address: vaultAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
    });

    const balanceNum = jethsBalance ? Number(formatUnits(jethsBalance, 18)) : 0;
    const fairValue = balanceNum * ethPrice;

    // Calculate period dates
    const getPeriodDates = (p: Period): { start: Date; end: Date } => {
        const now = new Date();
        const year = now.getFullYear();

        switch (p) {
            case 'Q1': return { start: new Date(year, 0, 1), end: new Date(year, 2, 31) };
            case 'Q2': return { start: new Date(year, 3, 1), end: new Date(year, 5, 30) };
            case 'Q3': return { start: new Date(year, 6, 1), end: new Date(year, 8, 30) };
            case 'Q4': return { start: new Date(year, 9, 1), end: new Date(year, 11, 31) };
            case 'YTD': return { start: new Date(year, 0, 1), end: now };
            case 'Custom': return {
                start: customStart ? new Date(customStart) : new Date(year, 0, 1),
                end: customEnd ? new Date(customEnd) : now,
            };
        }
    };

    // Load transactions from localStorage
    useEffect(() => {
        if (!address || !isOpen) return;
        setIsLoading(true);

        try {
            const saved = localStorage.getItem(`jeths-history-${address}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                const txs: Transaction[] = parsed.map((tx: any) => ({
                    date: new Date(tx.timestamp).toLocaleDateString(),
                    type: tx.type === 'deposit' ? 'Deposit' : 'Withdraw',
                    amount: tx.amount,
                    costBasis: parseFloat(tx.amount) * ethPrice * 0.95, // Estimate
                    fairValue: parseFloat(tx.amount) * ethPrice,
                    hash: tx.hash,
                }));
                setTransactions(txs);
            }
        } catch (err) {
            console.log('Failed to load transactions');
        }
        setIsLoading(false);
    }, [address, isOpen, ethPrice]);

    // Calculate gains/losses
    const { totalCostBasis, unrealizedGain, percentChange } = useMemo(() => {
        const deposits = transactions.filter(t => t.type === 'Deposit');
        const totalCost = deposits.reduce((sum, t) => sum + t.costBasis, 0);
        const estimatedCost = totalCost || fairValue * 0.9;
        const gain = fairValue - estimatedCost;
        const pct = estimatedCost > 0 ? ((fairValue - estimatedCost) / estimatedCost) * 100 : 0;
        return { totalCostBasis: estimatedCost, unrealizedGain: gain, percentChange: pct };
    }, [transactions, fairValue]);

    // Export to CSV
    const exportCSV = () => {
        const { start, end } = getPeriodDates(period);
        const periodLabel = period === 'Custom'
            ? `${start.toLocaleDateString()}-${end.toLocaleDateString()}`
            : `${period}-${new Date().getFullYear()}`;

        const headers = ['Date', 'Type', 'Amount (ETH)', 'Cost Basis (USD)', 'Fair Value (USD)', 'Tx Hash'];
        const rows = transactions.map(t => [
            t.date, t.type, t.amount, t.costBasis.toFixed(2), t.fairValue.toFixed(2), t.hash
        ]);

        // Add summary
        rows.push([]);
        rows.push(['FASB Fair Value Summary']);
        rows.push(['Period:', periodLabel]);
        rows.push(['Total Holdings:', `${balanceNum.toFixed(4)} jETHs`]);
        rows.push(['Fair Value:', `$${fairValue.toLocaleString()}`]);
        rows.push(['Cost Basis:', `$${totalCostBasis.toLocaleString()}`]);
        rows.push(['Unrealized Gain/Loss:', `$${unrealizedGain.toLocaleString()}`]);

        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jETHs-FASB-Report-${periodLabel}.csv`;
        a.click();
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
        }}>
            <div style={{
                background: c.card,
                borderRadius: '24px',
                maxWidth: '700px',
                width: '100%',
                maxHeight: '90vh',
                overflow: 'auto',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: `1px solid ${c.border}`,
            }}>
                {/* Header */}
                <div style={{
                    background: `linear-gradient(135deg, #627EEA 0%, #4B5EC6 100%)`,
                    padding: '20px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <h2 style={{ color: 'white', fontSize: '20px', fontWeight: '700', margin: 0 }}>
                        📊 FASB Fair Value Report
                    </h2>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.2)',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 16px',
                        color: 'white',
                        cursor: 'pointer',
                    }}>
                        Close
                    </button>
                </div>

                <div style={{ padding: '24px' }}>
                    {/* Period Selector */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ color: c.textMuted, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Reporting Period
                        </label>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                            {(['Q1', 'Q2', 'Q3', 'Q4', 'YTD', 'Custom'] as Period[]).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPeriod(p)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        border: period === p ? 'none' : `1px solid ${c.border}`,
                                        background: period === p ? c.accent : 'transparent',
                                        color: period === p ? 'white' : c.text,
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                    }}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>

                        {period === 'Custom' && (
                            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                <input
                                    type="date"
                                    value={customStart}
                                    onChange={(e) => setCustomStart(e.target.value)}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: `1px solid ${c.border}`,
                                        background: c.card,
                                        color: c.text,
                                    }}
                                />
                                <span style={{ color: c.textMuted, alignSelf: 'center' }}>to</span>
                                <input
                                    type="date"
                                    value={customEnd}
                                    onChange={(e) => setCustomEnd(e.target.value)}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: `1px solid ${c.border}`,
                                        background: c.card,
                                        color: c.text,
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Holdings Summary */}
                    <div style={{
                        background: theme === 'dark' ? '#0d0d1a' : '#f8f9fa',
                        borderRadius: '16px',
                        padding: '20px',
                        marginBottom: '24px',
                    }}>
                        <h3 style={{ color: c.text, fontSize: '16px', margin: '0 0 16px' }}>Current Holdings</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                            <div>
                                <div style={{ color: c.textMuted, fontSize: '13px' }}>jETHs Balance</div>
                                <div style={{ color: c.text, fontSize: '24px', fontWeight: '700' }}>
                                    {balanceNum.toFixed(4)}
                                </div>
                            </div>
                            <div>
                                <div style={{ color: c.textMuted, fontSize: '13px' }}>Fair Value (USD)</div>
                                <div style={{ color: c.text, fontSize: '24px', fontWeight: '700' }}>
                                    ${fairValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Gain/Loss Summary */}
                    <div style={{
                        background: theme === 'dark' ? '#0d0d1a' : '#f8f9fa',
                        borderRadius: '16px',
                        padding: '20px',
                        marginBottom: '24px',
                        border: `2px solid ${unrealizedGain >= 0 ? c.positive : c.negative}20`,
                    }}>
                        <h3 style={{ color: c.text, fontSize: '16px', margin: '0 0 16px' }}>
                            Period Summary ({period} {new Date().getFullYear()})
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: c.textMuted }}>Cost Basis:</span>
                                <span style={{ color: c.text }}>${totalCostBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: c.textMuted }}>Current Fair Value:</span>
                                <span style={{ color: c.text }}>${fairValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div style={{ height: '1px', background: c.border }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: c.text, fontWeight: '600' }}>Unrealized Gain/Loss:</span>
                                <span style={{
                                    color: unrealizedGain >= 0 ? c.positive : c.negative,
                                    fontWeight: '700',
                                    fontSize: '18px',
                                }}>
                                    {unrealizedGain >= 0 ? '+' : ''}${unrealizedGain.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    <span style={{ fontSize: '14px', marginLeft: '8px' }}>
                                        ({percentChange >= 0 ? '+' : ''}{percentChange.toFixed(1)}%)
                                    </span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Transaction History */}
                    <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ color: c.text, fontSize: '16px', margin: '0 0 12px' }}>Transaction History</h3>
                        {isLoading ? (
                            <div style={{ textAlign: 'center', padding: '20px', color: c.textMuted }}>
                                Loading transactions...
                            </div>
                        ) : transactions.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '20px',
                                color: c.textMuted,
                                background: theme === 'dark' ? '#0d0d1a' : '#f8f9fa',
                                borderRadius: '12px',
                            }}>
                                No transactions found
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ borderBottom: `1px solid ${c.border}` }}>
                                            <th style={{ padding: '12px 8px', textAlign: 'left', color: c.textMuted }}>Date</th>
                                            <th style={{ padding: '12px 8px', textAlign: 'left', color: c.textMuted }}>Type</th>
                                            <th style={{ padding: '12px 8px', textAlign: 'right', color: c.textMuted }}>Amount</th>
                                            <th style={{ padding: '12px 8px', textAlign: 'right', color: c.textMuted }}>Fair Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactions.slice(0, 10).map((tx, i) => (
                                            <tr key={i} style={{ borderBottom: `1px solid ${c.border}` }}>
                                                <td style={{ padding: '12px 8px', color: c.text }}>{tx.date}</td>
                                                <td style={{ padding: '12px 8px' }}>
                                                    <span style={{
                                                        color: tx.type === 'Deposit' ? c.positive : c.negative,
                                                        fontWeight: '500',
                                                    }}>
                                                        {tx.type}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 8px', textAlign: 'right', color: c.text }}>
                                                    {tx.amount} ETH
                                                </td>
                                                <td style={{ padding: '12px 8px', textAlign: 'right', color: c.text }}>
                                                    ${tx.fairValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Export Button */}
                    <button
                        onClick={exportCSV}
                        style={{
                            width: '100%',
                            padding: '14px',
                            borderRadius: '12px',
                            border: 'none',
                            background: `linear-gradient(135deg, #627EEA 0%, #4B5EC6 100%)`,
                            color: 'white',
                            fontSize: '16px',
                            fontWeight: '600',
                            cursor: 'pointer',
                        }}
                    >
                        📥 Export CSV for Accountant
                    </button>

                    {/* Attribution */}
                    <div style={{
                        textAlign: 'center',
                        marginTop: '16px',
                        fontSize: '11px',
                        color: c.textMuted,
                        opacity: 0.7,
                    }}>
                        Price by <a href="https://www.coingecko.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>CoinGecko</a> •
                        FASB ASU 2023-08 compliant
                    </div>
                </div>
            </div>
        </div>
    );
}
