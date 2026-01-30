'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface TreasuryModeProps {
    isOpen: boolean;
    onClose: () => void;
    theme: 'light' | 'dark';
}

type Step = 'intro' | 'create' | 'connect' | 'next-steps' | 'connected';

export function TreasuryMode({ isOpen, onClose, theme }: TreasuryModeProps) {
    const { address, connector } = useAccount();
    const [isSafeWallet, setIsSafeWallet] = useState(false);
    const [step, setStep] = useState<Step>('intro');

    const c = theme === 'dark' ? {
        bg: 'rgba(20, 20, 35, 0.98)',
        card: '#1a1a2e',
        text: '#ffffff',
        textMuted: '#a0a0b0',
        border: '#2a2a3e',
        accent: '#627EEA',
    } : {
        bg: 'rgba(255, 255, 255, 0.98)',
        card: '#ffffff',
        text: '#1a1a2e',
        textMuted: '#666680',
        border: '#e5e7eb',
        accent: '#627EEA',
    };

    // Detect if running in Safe iframe
    useEffect(() => {
        const checkSafe = () => {
            const isInIframe = typeof window !== 'undefined' && window.parent !== window;
            const isSafeConnector = connector?.name?.toLowerCase().includes('safe');
            setIsSafeWallet(isInIframe || isSafeConnector || false);

            if (isInIframe || isSafeConnector) {
                setStep('connected');
            }
        };
        checkSafe();
    }, [connector]);

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
            padding: '16px',
        }}>
            <div style={{
                background: c.card,
                borderRadius: '20px',
                maxWidth: '480px',
                width: '100%',
                maxHeight: '90vh',
                overflow: 'auto',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: `1px solid ${c.border}`,
            }}>
                {/* Header */}
                <div style={{
                    background: `linear-gradient(135deg, #627EEA 0%, #4B5EC6 100%)`,
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '700', margin: 0 }}>
                        🏛️ Treasury Mode
                    </h2>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.2)',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '14px',
                    }}>
                        Close
                    </button>
                </div>

                <div style={{ padding: '20px' }}>
                    {/* INTRO SCREEN */}
                    {step === 'intro' && (
                        <>
                            <h3 style={{ color: c.text, fontSize: '17px', marginBottom: '12px' }}>
                                Multi-Signature Accountability
                            </h3>
                            <p style={{ color: c.textMuted, lineHeight: 1.5, marginBottom: '16px', fontSize: '14px' }}>
                                Just like requiring <strong>two signatures on a church check</strong>,
                                Safe wallets require multiple approvals before funds can move.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                                <Benefit icon="✅" title="Non-Custodial Sovereignty" description="Your organization controls the keys" theme={theme} />
                                <Benefit icon="✅" title="Accountability Trail" description="Every approval recorded on-chain" theme={theme} />
                                <Benefit icon="✅" title="Prevent Unauthorized Transfers" description="No single person can move funds alone" theme={theme} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <button
                                    onClick={() => setStep('create')}
                                    style={{
                                        padding: '14px',
                                        borderRadius: '12px',
                                        border: 'none',
                                        background: `linear-gradient(135deg, #627EEA 0%, #4B5EC6 100%)`,
                                        color: 'white',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Create New Safe Wallet
                                </button>
                                <button
                                    onClick={() => setStep('connect')}
                                    style={{
                                        padding: '14px',
                                        borderRadius: '12px',
                                        border: `1px solid ${c.border}`,
                                        background: 'transparent',
                                        color: c.text,
                                        fontSize: '15px',
                                        fontWeight: '500',
                                        cursor: 'pointer',
                                    }}
                                >
                                    I Already Have a Safe
                                </button>
                            </div>
                        </>
                    )}

                    {/* CREATE SCREEN */}
                    {step === 'create' && (
                        <>
                            <h3 style={{ color: c.text, fontSize: '17px', marginBottom: '16px' }}>
                                Set Up Your Treasury
                            </h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                                <StepItem num={1} text="Go to Safe and click 'Create new Safe'" theme={theme} />
                                <StepItem num={2} text="Select Ethereum Mainnet (or Sepolia for testing)" theme={theme} />
                                <StepItem num={3} text="Add signers (Pastor, Treasurer, Deacon)" theme={theme} />
                                <StepItem num={4} text="Set threshold (e.g., 2 of 3 required)" theme={theme} />
                                <StepItem num={5} text="Fund with ETH for gas" theme={theme} />
                            </div>

                            <a
                                href="https://app.safe.global/new-safe/create?chain=eth"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setTimeout(() => setStep('next-steps'), 500)}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '14px',
                                    borderRadius: '12px',
                                    background: `linear-gradient(135deg, #627EEA 0%, #4B5EC6 100%)`,
                                    color: 'white',
                                    fontSize: '15px',
                                    fontWeight: '600',
                                    textDecoration: 'none',
                                    textAlign: 'center',
                                    marginBottom: '10px',
                                }}
                            >
                                Open Safe App →
                            </a>

                            <button onClick={() => setStep('intro')} style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: c.textMuted, cursor: 'pointer', fontSize: '14px' }}>
                                ← Back
                            </button>
                        </>
                    )}

                    {/* CONNECT EXISTING SAFE SCREEN */}
                    {step === 'connect' && (
                        <>
                            <h3 style={{ color: c.text, fontSize: '17px', marginBottom: '16px' }}>
                                Connect Your Safe Wallet
                            </h3>

                            <p style={{ color: c.textMuted, fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>
                                Use Safe&apos;s built-in browser to access jETHs directly:
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                                <StepItem num={1} text="Open app.safe.global" theme={theme} />
                                <StepItem num={2} text="Select your Safe on Ethereum" theme={theme} />
                                <StepItem num={3} text="Click 'Apps' in left sidebar" theme={theme} />
                                <StepItem num={4} text="Click 'My custom apps' tab" theme={theme} />
                                <StepItem num={5} text="Add: https://mint.jeths.xyz" theme={theme} />
                            </div>

                            <div style={{
                                background: theme === 'dark' ? '#0d0d1a' : '#E8F5E9',
                                border: `1px solid ${theme === 'dark' ? '#2a2a3e' : '#4CAF50'}`,
                                borderRadius: '12px',
                                padding: '14px',
                                marginBottom: '16px',
                            }}>
                                <p style={{ margin: 0, color: theme === 'dark' ? '#81C784' : '#2E7D32', fontSize: '13px' }}>
                                    ✅ <strong>Safe will connect automatically</strong> when you open jETHs from within the Safe app!
                                </p>
                            </div>

                            <a
                                href="https://app.safe.global"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setTimeout(() => setStep('next-steps'), 500)}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '14px',
                                    borderRadius: '12px',
                                    background: `linear-gradient(135deg, #627EEA 0%, #4B5EC6 100%)`,
                                    color: 'white',
                                    fontSize: '15px',
                                    fontWeight: '600',
                                    textDecoration: 'none',
                                    textAlign: 'center',
                                    marginBottom: '10px',
                                }}
                            >
                                Open Safe App →
                            </a>

                            <button onClick={() => setStep('intro')} style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: c.textMuted, cursor: 'pointer', fontSize: '14px' }}>
                                ← Back
                            </button>
                        </>
                    )}

                    {/* NEXT STEPS AFTER CREATION/CONNECTION */}
                    {step === 'next-steps' && (
                        <>
                            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                <div style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '28px',
                                    margin: '0 auto 12px',
                                }}>
                                    ✓
                                </div>
                                <h3 style={{ color: c.text, fontSize: '18px', marginBottom: '4px' }}>
                                    Almost Done!
                                </h3>
                                <p style={{ color: c.textMuted, fontSize: '14px' }}>
                                    Once your Safe is ready, here&apos;s how to use jETHs:
                                </p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                                <StepItem num={1} text="Connect your Safe to jETHs via WalletConnect" theme={theme} />
                                <StepItem num={2} text="Any deposit/withdrawal creates a proposal" theme={theme} />
                                <StepItem num={3} text="Signers review and approve in Safe app" theme={theme} />
                                <StepItem num={4} text="Transaction executes after required signatures" theme={theme} />
                            </div>

                            <div style={{
                                background: `${c.accent}15`,
                                borderRadius: '12px',
                                padding: '14px',
                                border: `1px solid ${c.accent}30`,
                                marginBottom: '16px',
                            }}>
                                <p style={{ color: c.text, fontSize: '13px', margin: 0 }}>
                                    📋 <strong>Example:</strong> Pastor initiates 1 ETH deposit → Treasurer approves → Deposit executes
                                </p>
                            </div>

                            <button
                                onClick={onClose}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: `linear-gradient(135deg, #627EEA 0%, #4B5EC6 100%)`,
                                    color: 'white',
                                    fontSize: '15px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                }}
                            >
                                Got It! 🚀
                            </button>
                        </>
                    )}

                    {/* CONNECTED (auto-detected Safe) */}
                    {step === 'connected' && (
                        <>
                            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                <div style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '28px',
                                    margin: '0 auto 12px',
                                }}>
                                    ✓
                                </div>
                                <h3 style={{ color: c.text, fontSize: '18px', marginBottom: '4px' }}>
                                    Safe Wallet Connected
                                </h3>
                                <p style={{ color: c.textMuted, fontSize: '14px' }}>
                                    Multi-Signature Accountability is active
                                </p>
                            </div>

                            <div style={{
                                background: theme === 'dark' ? '#0d0d1a' : '#f8f9fa',
                                borderRadius: '12px',
                                padding: '14px',
                                marginBottom: '16px',
                            }}>
                                <div style={{ fontSize: '12px', color: c.textMuted, marginBottom: '4px' }}>Treasury Address</div>
                                <div style={{ fontSize: '13px', color: c.text, fontFamily: 'monospace', wordBreak: 'break-all' }}>{address}</div>
                            </div>

                            <div style={{
                                background: `${c.accent}15`,
                                borderRadius: '12px',
                                padding: '14px',
                                border: `1px solid ${c.accent}30`,
                            }}>
                                <p style={{ color: c.text, fontSize: '13px', margin: 0 }}>
                                    💡 Transactions require approval from your designated signers before executing.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// Helper Components
function Benefit({ icon, title, description, theme }: { icon: string; title: string; description: string; theme: 'light' | 'dark' }) {
    return (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '18px' }}>{icon}</span>
            <div>
                <div style={{ color: theme === 'dark' ? '#fff' : '#1a1a2e', fontWeight: '600', fontSize: '13px', marginBottom: '2px' }}>{title}</div>
                <div style={{ color: theme === 'dark' ? '#a0a0b0' : '#666680', fontSize: '12px' }}>{description}</div>
            </div>
        </div>
    );
}

function StepItem({ num, text, theme }: { num: number; text: string; theme: 'light' | 'dark' }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#627EEA',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '600',
                fontSize: '12px',
                flexShrink: 0,
            }}>
                {num}
            </div>
            <span style={{ color: theme === 'dark' ? '#e0e0e0' : '#374151', fontSize: '13px' }}>{text}</span>
        </div>
    );
}
