# jETHs - The Ethereum Staking Index

A passive, diversified liquid staking strategy that automatically rebalances across Ethereum's top LST protocols (wstETH, cbETH, rETH) while optimizing for yield and liquidity.

**Website:** [https://mint.jeths.xyz](https://mint.jeths.xyz)  
**Status:** 🚀 Live on Sepolia Testnet — Jan 2026

```text
0x627EEA... (Vault Address)
```

## Overview

jETHs (Jubilee Ethereum Staking Index) provides one-click exposure to a curated basket of Liquid Staking Tokens. By holding jETHs, users earn diversified staking rewards while benefiting from automated risk management and rebalancing.

### Key Features

- **Automated Rebalancing**: Maintaining target allocations across wstETH, cbETH, and rETH.
- **Optimized Yield**: Sophisticated strategy to capture peak APY across integrated protocols.
- **Liquidity Focused**: Built on top of high-liquidity LSTs to ensure smooth entry and exit.
- **One-Click Minting**: Deposit WETH and receive jETHs index tokens instantly.

## Target Allocations

| Protocol | Target | Asset |
| :--- | :--- | :--- |
| **Lido** | 40% | wstETH |
| **Coinbase** | 35% | cbETH |
| **Rocket Pool** | 25% | rETH |

## Security

- **Non-Custodial**: Users always retain control of their funds through Jubilee's smart contract architecture.
- **Audited**: Contract audited by [Audit Report](https://github.com/Jubilee-Protocol/jETHs-on-Base/blob/main/docs/JETHS_AUDIT_REPORT.md).
- **Battle-Tested**: Built using the same core infrastructure as [jBTCi](https://jbtci.xyz) and [jSOLi](https://jsoli.xyz).

## Repository Structure

```text
jETHs/
├── contracts/        # Solidity smart contracts (ERC-4626)
├── frontend/         # Next.js web application
├── scripts/          # Deployment and maintenance scripts
└── docs/             # Technical documentation & audits
```

## Quick Start

### Prerequisites

- Node.js (v18+)
- Foundry (for contract testing)

### Installation

```bash
# Clone the repository
git clone https://github.com/Jubilee-Protocol/jETHs
cd jETHs

# Install frontend dependencies
cd frontend
npm install

# Start development server
npm run dev
```

## Built By

Developed by **Jubilee Labs** and governed by the **Hundredfold Foundation**.

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
