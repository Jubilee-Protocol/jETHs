# jETHs - The Ethereum Staking Index

[![Built on Ethereum](https://img.shields.io/badge/Built%20on-Ethereum-3C3C3D)](https://ethereum.org)
[![Powered by Yearn](https://img.shields.io/badge/Powered%20by-Yearn%20V3-blue)](https://yearn.fi)
[![App](https://img.shields.io/badge/App-mint.jeths.xyz-green)](https://mint.jeths.xyz)

> A passive, diversified liquid staking strategy that automatically rebalances across Ethereum's top LST protocols while capturing arbitrage opportunities.

**Website**: https://jeths.xyz  
**App**: https://mint.jeths.xyz (Pending)
**Contract**: [`0x08Bc3F12Dd327739B3BC613A6640aCa3B67D5Be6`](https://sepolia.etherscan.io/address/0x08Bc3F12Dd327739B3BC613A6640aCa3B67D5Be6) *(Testnet)*  
**Status**: 🚀 **Live on Sepolia Testnet** — Preparing for Mainnet

---

## Overview

jETHs maintains a diversified allocation across wstETH (40%), cbETH (35%), and rETH (25%), automatically rebalancing when allocations drift beyond 2%. The strategy captures arbitrage profits during rebalancing, generating 3.5-5.0% target APY for depositors.

### Key Features

- **Passive Strategy** - Deposit ETH/WETH, earn optimized staking rewards
- **Diversified** - 40/35/25 wstETH/cbETH/rETH allocation  
- **Secure** - Multi-layered circuit breakers, dual oracles
- **Efficient** - Yearn V3 infrastructure with MEV protection

---

## Target Allocations

| Protocol | Allocation | Token | Est. APY |
|----------|------------|-------|----------|
| Lido | 40% | wstETH | ~3.8% |
| Coinbase | 35% | cbETH | ~3.5% |
| Rocket Pool | 25% | rETH | ~3.6% |

**Target Blended APY**: 3.5-5.0%

---

## Fee Structure

| Fee Type | Rate | Max Allowed |
|----------|------|-------------|
| Management Fee | 0.0% | 1.0% |
| Performance Fee | 10% of gains | 20% |

---

## Security

- **Audit Score**: 92/100 ⭐⭐⭐⭐⭐
- See [docs/AUDIT_REPORT.md](docs/AUDIT_REPORT.md) for details

---

## Contract Addresses

### Ethereum Mainnet
| Contract | Address |
|----------|---------|
| jETHs Strategy | *Pending Mainnet Deployment* |
| wstETH | `0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0` |
| cbETH | `0xBe9895146f7AF43049ca1c1AE358B0541Ea49704` |
| rETH | `0xae78736Cd615f374D3085123A210448E74Fc6393` |

### Sepolia (Testnet)
| Contract | Address |
|----------|---------|
| jETHs Vault | `0x08Bc3F12Dd327739B3BC613A6640aCa3B67D5Be6` |
| jETHs Strategy | `0x27143095013184e718f92330C32A3D2eE9974053` |
| wstETH (Mock) | `0x0000000000000000000000000000000000000001` |
| cbETH (Mock) | `0x0000000000000000000000000000000000000002` |
| rETH (Mock) | `0x0000000000000000000000000000000000000003` |

---

## Repository Structure

```
jETHs/
├── contracts/
│   ├── YearnJETHsStrategy.sol   # Main strategy
│   ├── JubileeTimelock.sol      # 24hr governance
│   ├── lib/                     # Yearn V3 base strategy
│   ├── libraries/               # Helper libraries
│   └── mocks/                   # Test mocks
├── deploy/
│   ├── DeployJETHs_Mainnet.js   # Production deployment
│   └── DeployJETHs_Testnet.js   # Testnet with mocks
├── docs/
│   ├── ADMIN_GUIDE.md           # Admin functions
│   ├── AUDIT_REPORT.md          # Security audit
│   └── FAQ.md                   # Frequently asked questions
├── frontend/                    # Next.js web app
├── scripts/                     # Utility scripts
├── test/
│   ├── YearnJETHs.test.js              # Basic tests
│   ├── YearnJETHs.stress.test.js       # Stress tests
│   └── YearnJETHs.comprehensive.test.js # Full coverage
└── README.md
```

---

## Quick Start

```bash
# Install
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Run frontend locally
cd frontend && npm run dev
```

---

## Test Suite (100% Pass Rate)

- ✅ `test/YearnJETHs.test.js` - 1/1 deployment test
- ✅ `test/YearnJETHs.stress.test.js` - 3/3 stress tests
- ✅ `test/YearnJETHs.comprehensive.test.js` - 37/37 comprehensive tests

**Total: 41/41 tests passing**

---

## Changelog (Jan 24, 2026)

### Contract Fixes
- ✅ Added missing `pauseRebalancing()` function
- ✅ Added missing `unpauseRebalancing()` function
- ✅ Added missing `resetCircuitBreaker()` function
- ✅ All 41 tests passing

### Security
- ✅ Comprehensive audit: 92/100 score
- ✅ Full test coverage for all critical functions
- ✅ Oracle validation with staleness checks
- ✅ Circuit breaker with cooldown periods

---

## Built By

**[Jubilee Labs](https://jubileelabs.xyz)** • Powered by **[Yearn V3](https://yearn.fi)** • Deployed on **[Ethereum](https://ethereum.org)**

## License

This project is licensed under the [MIT License](LICENSE).

---

*"Seek first the Kingdom of God!"* — Matthew 6:33
