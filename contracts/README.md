# jETHs Contracts

This directory contains the smart contracts for jETHs - The Diversified Ethereum LST Index.

## Main Contracts

| Contract | Description |
|----------|-------------|
| `YearnJETHsStrategy.sol` | Main strategy - wstETH/cbETH/rETH rebalancing |
| `JubileeTimelock.sol` | 24-hour governance timelock |
| `vaults/jETHs/JETHsVault.sol` | ERC4626 Vault Entry Point |

## Libraries

| Library | Purpose |
|---------|---------|
| `lib/` | Yearn V3 base strategy implementation |
| `libraries/FullMath.sol` | Overflow-safe math operations |

## Mocks (Testing Only)

| Mock | Purpose |
|------|---------|
| `MockChainlinkOracle.sol` | Simulates Chainlink price feeds |
| `MockUniswapV3Pool.sol` | Simulates Uniswap V3 TWAP |
| `MockRouter.sol` | Simulates DEX routing |

---

**Chain**: Ethereum Mainnet / Sepolia
**Status**: Refactored & Audited
