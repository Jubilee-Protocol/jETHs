# jETHs - Liquid Staking Index on Ethereum

[![Built on Ethereum](https://img.shields.io/badge/Built%20on-Ethereum-3C3C3D)](https://ethereum.org)
[![Powered by Yearn](https://img.shields.io/badge/Powered%20by-Yearn%20V3-blue)](https://yearn.fi)
[![Status](https://img.shields.io/badge/Status-Beta%20on%20Sepolia-orange)](https://github.com/Jubilee-Protocol/jETHs)

> A passive, diversified liquid staking strategy that automatically rebalances across Ethereum's top LST protocols via Yearn V3 while optimizing for yield.

**Website**: https://jeths.jubilee.xyz
**App**: Coming Soon

**Vault**: `0xC862590209A34927bF61266E7C81878E4909187a`
**Status**: 🚀 **Beta on Sepolia** — Jan 2026

---

## Overview

jETHs aggregates user deposits across multiple Liquid Staking Token (LST) protocols on Ethereum, automatically rebalancing to optimize yield using Yearn V3 strategies. Users deposit WETH/ETH and receive jETHs shares representing their proportional ownership.

### Key Features

- **Passive Strategy** - Deposit ETH/WETH, earn optimized staking rewards.
- **Diversified** - Spread across wstETH, cbETH, and rETH.
- **Auto-Rebalancing** - Adjusts allocations based on Yearn V3 performance.
- **Secure** - Circuit breakers, multi-sig governance, and Yearn's battle-tested infrastructure.

---

## Target Allocations

| Protocol | Allocation | Token | Est. APY |
|----------|------------|-------|----------|
| Lido | 33.3% | wstETH | ~3.8% |
| Coinbase | 33.3% | cbETH | ~3.5% |
| RocketPool | 33.4% | rETH | ~3.6% |

**Target Blended APY**: 3.5-5.0% (Before Yearn boosting)

---

## Fee Structure

| Fee Type | Rate | Max Allowed |
|----------|------|-------------|
| Management Fee | 0.0% | 1.0% |
| Performance Fee | 10% of gains | 20% |

---

## Security

- **Features**:
  - ✅ Solidity 0.8.20+ with SafeMath standards.
  - ✅ Role-based access control (AccessControl).
  - ✅ Emergency pause mechanism.
  - ✅ Slippage protection via Yearn V3 Router.
  - ✅ Diversified exposure to mitigate individual LST de-pegging.

---

## Repository Structure
```
jETHs/
├── contracts/
│   ├── vaults/jETHs/
│   │   └── JETHsVault.sol      # Main Index Vault (ERC4626)
│   ├── strategies/
│   │   └── YearnJETHsStrategy.sol # Yearn V3 Strategy integration
│   └── interfaces/             # LST & Yearn interfaces
├── frontend/                   # Next.js / RainbowKit application
├── tests/                      # Foundry/Hardhat test suite
└── scripts/                    # Deployment & management scripts
```

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/Jubilee-Protocol/jETHs
cd jETHs

# Install dependencies
npm install

# Build contracts
npx hardhat compile

# Run tests
npx hardhat test
```

---

## How It Works

### Deposit Flow
1. User deposits ETH/WETH into the `JETHsVault`.
2. Vault calculates shares based on current TVL.
3. jETHs tokens are minted to the user.
4. Assets are deployed to Yearn V3 LST strategies.

### Withdrawal Flow
1. User requests withdrawal/redeem with jETHs shares.
2. Vault pulls assets from Yearn strategies.
3. jETHs is burned, original assets returned to user.

### Rebalancing
- Leverages Yearn V3's dynamic allocation.
- Triggered periodically by Jubilee keepers to maintain target index weightings.

---

## Built By

**[Jubilee Labs](https://jubilee.xyz)** • Powered by **[Yearn Finance](https://yearn.fi)** • Deployed on **[Ethereum](https://ethereum.org)**

## License

This project is licensed under the [MIT License](LICENSE).

---

*"Seek first the Kingdom of God!"* — Matthew 6:33
