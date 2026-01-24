# jETHs Strategy - Admin Functions Guide

This document describes all administrative functions available to the deployer/manager of the YearnJETHsStrategy contract.

---

## 🔐 Access Roles

| Role | Access | Who |
|------|--------|-----|
| **Management** | All admin functions | Deployer (or transferred owner) |
| **Emergency** | pauseRebalancing, enableOracleFailureMode | Management + designated emergency addresses |
| **Keepers** | report() | Automated bots or anyone |

---

## 📊 Current Default Values

| Parameter | Default | Min | Max |
|-----------|---------|-----|-----|
| **depositCap** | 100 ETH | 1 ETH | 10,000 ETH |
| **maxSlippage** | 1% (100 bps) | 0.1% (10 bps) | 10% (1000 bps) |
| **swapFee** | 0.25% (25 bps) | 0.05% (5 bps) | 1% (100 bps) |
| **dailySwapLimit** | 10 ETH | - | - |

---

## 🛠 Admin Functions

### 1. `setDepositCap(uint256 _newCap)`

**Purpose**: Set maximum total deposits allowed  
**Access**: `onlyManagement`  
**Values**: 1 ETH to 10,000 ETH

```javascript
// Example: Set cap to 200 ETH
await strategy.setDepositCap(ethers.parseUnits("200", 18));
```

---

### 2. `setMaxSlippage(uint256 _newSlippage)`

**Purpose**: Set maximum slippage tolerance for swaps  
**Access**: `onlyManagement`  
**Values**: 10 bps (0.1%) to 1000 bps (10%)

```javascript
// Example: Set slippage to 2%
await strategy.setMaxSlippage(200); // 200 bps = 2%
```

---

### 3. `setSwapFee(uint256 _newFee)`

**Purpose**: Set swap fee for profitability calculations  
**Access**: `onlyManagement`  
**Values**: 5 bps (0.05%) to 100 bps (1%)

```javascript
// Example: Set fee to 0.3%
await strategy.setSwapFee(30); // 30 bps = 0.3%
```

---

### 4. `pauseRebalancing()` / `unpauseRebalancing()`

**Purpose**: Emergency pause/resume of rebalancing  
**Access**: `onlyEmergencyAuthorized` (pause) / `onlyManagement` (unpause)

```javascript
// Pause (emergency)
await strategy.pauseRebalancing();

// Resume (management only)
await strategy.unpauseRebalancing();
```

---

### 5. `resetCircuitBreaker()`

**Purpose**: Manually reset circuit breaker after cooldown  
**Access**: `onlyManagement`  
**Requirements**: Must wait for cooldown period (1 day by default)

```javascript
await strategy.resetCircuitBreaker();
```

---

### 6. `enableOracleFailureMode()` / `disableOracleFailureMode()`

**Purpose**: Switch to fallback oracles during primary oracle failure  
**Access**: `onlyEmergencyAuthorized` (enable) / `onlyManagement` (disable)

```javascript
// Enable fallbacks
await strategy.enableOracleFailureMode();

// Return to normal
await strategy.disableOracleFailureMode();
```

---

### 7. `setFallbackOracles(address _btc, address _eth)`

**Purpose**: Update fallback oracle addresses  
**Access**: `onlyManagement`

```javascript
await strategy.setFallbackOracles(newBtcOracle, newEthOracle);
```

---

## 📋 Common Operations Cheatsheet

### Day 1: After Deployment
```javascript
// Check current status
const status = await strategy.getStrategyStatus();

// Increase cap as needed (start small)
await strategy.setDepositCap(ethers.parseUnits("50", 18)); // 50 ETH

// Verify
console.log(await strategy.depositCap()); // 50000000000000000000 (50 ETH)
```

### During Volatile Markets
```javascript
// Increase slippage tolerance
await strategy.setMaxSlippage(300); // 3%

// Or pause entirely
await strategy.pauseRebalancing();
```

### After Circuit Breaker Triggers
```javascript
// Wait for cooldown (1 day), then reset
// Note: gradualRecoveryActive will reduce limits by 50% for first hour
await strategy.resetCircuitBreaker();
```

---

## ⚠️ Important Notes

1. **Deposits vs Cap**: The `depositCap` is checked on each deposit via `availableDepositLimit()`
2. **Gradual Recovery**: After CB reset, daily limit is 50% for 1 hour, then restores
3. **Events**: All parameter changes emit `ParametersUpdated` event
4. **Timelock**: Consider adding a timelock contract for production use
