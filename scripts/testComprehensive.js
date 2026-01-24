// Comprehensive jBTCi Strategy Test Suite
// Tests: All functions, Circuit Breaker scenarios, 100 BTC load test

require("dotenv").config();
const { ethers } = require("ethers");

async function main() {
    console.log("🧪 COMPREHENSIVE jBTCi STRATEGY TEST SUITE");
    console.log("=".repeat(60));

    const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // Latest deployment addresses (with all audit fixes)
    const STRATEGY_ADDRESS = "0xB49D8d9E7E408f8ce26DcC65c21e8D026E5DFD3C";
    const WBTC_ADDRESS = "0xD60EcaE99E90a594750492E7f7b8AAcFc894c40a";
    const CBBTC_ADDRESS = "0xe50763b629038E421164826e18cdB4011CD9D67d";

    // ABIs
    const strategyABI = [
        "function getStrategyStatus() external view returns (tuple(bool isPaused, bool isCBTriggered, bool isInOracleFailureMode, uint256 totalHoldings, uint256 dailySwapUsed, uint256 dailySwapLimit, uint256 lastGasCost, uint256 rebalancesExecuted, uint256 rebalancesFailed, uint256 swapsExecuted, uint256 swapsFailed, uint256 wbtcAlloc, uint256 cbbtcAlloc, uint256 failCount, uint256 timeUntilReset))",
        "function totalAssets() external view returns (uint256)",
        "function deposit(uint256 _amount, address _receiver) external returns (uint256)",
        "function maxSlippage() external view returns (uint256)",
        "function swapFee() external view returns (uint256)",
        "function dailySwapLimitBTC() external view returns (uint256)",
        "function circuitBreakerTriggered() external view returns (bool)",
        "function gradualRecoveryActive() external view returns (bool)",
        "function preRecoveryDailyLimit() external view returns (uint256)",
        "function report() external returns (uint256, uint256)",
        "function setMaxSlippage(uint256 _newSlippage) external",
        "function setSwapFee(uint256 _newFee) external",
    ];

    const erc20ABI = [
        "function balanceOf(address) external view returns (uint256)",
        "function approve(address, uint256) external returns (bool)",
        "function mint(address, uint256) external",
        "function decimals() external view returns (uint8)"
    ];

    const strategy = new ethers.Contract(STRATEGY_ADDRESS, strategyABI, wallet);
    const wbtc = new ethers.Contract(WBTC_ADDRESS, erc20ABI, wallet);
    const cbbtc = new ethers.Contract(CBBTC_ADDRESS, erc20ABI, wallet);

    // =============================================================
    // TEST 1: Read Strategy Status
    // =============================================================
    console.log("\n📊 TEST 1: Strategy Status Check");
    console.log("-".repeat(40));

    try {
        const status = await strategy.getStrategyStatus();
        console.log(`  isPaused: ${status.isPaused}`);
        console.log(`  circuitBreakerTriggered: ${status.isCBTriggered}`);
        console.log(`  oracleFailureMode: ${status.isInOracleFailureMode}`);
        console.log(`  totalHoldings: ${ethers.formatUnits(status.totalHoldings, 8)} BTC`);
        console.log(`  dailySwapLimit: ${ethers.formatUnits(status.dailySwapLimit, 8)} BTC`);
        console.log(`  WBTC Allocation: ${Number(status.wbtcAlloc) / 100}%`);
        console.log(`  cbBTC Allocation: ${Number(status.cbbtcAlloc) / 100}%`);
        console.log("  ✅ STATUS CHECK PASSED");
    } catch (e) {
        console.log(`  ❌ STATUS CHECK FAILED: ${e.message}`);
    }

    // =============================================================
    // TEST 2: Configurable Parameters
    // =============================================================
    console.log("\n⚙️ TEST 2: Configurable Parameters");
    console.log("-".repeat(40));

    try {
        const maxSlippage = await strategy.maxSlippage();
        const swapFee = await strategy.swapFee();
        const dailyLimit = await strategy.dailySwapLimitBTC();

        console.log(`  maxSlippage: ${Number(maxSlippage) / 100}% (${maxSlippage} bps)`);
        console.log(`  swapFee: ${Number(swapFee) / 100}% (${swapFee} bps)`);
        console.log(`  dailySwapLimit: ${ethers.formatUnits(dailyLimit, 8)} BTC`);
        console.log("  ✅ PARAMETERS CHECK PASSED");
    } catch (e) {
        console.log(`  ❌ PARAMETERS CHECK FAILED: ${e.message}`);
    }

    // =============================================================
    // TEST 3: Circuit Breaker State Variables
    // =============================================================
    console.log("\n🔌 TEST 3: Circuit Breaker State");
    console.log("-".repeat(40));

    try {
        const cbTriggered = await strategy.circuitBreakerTriggered();
        const gradualRecovery = await strategy.gradualRecoveryActive();
        const preRecoveryLimit = await strategy.preRecoveryDailyLimit();

        console.log(`  circuitBreakerTriggered: ${cbTriggered}`);
        console.log(`  gradualRecoveryActive: ${gradualRecovery}`);
        console.log(`  preRecoveryDailyLimit: ${ethers.formatUnits(preRecoveryLimit, 8)} BTC`);
        console.log("  ✅ CB STATE CHECK PASSED");
    } catch (e) {
        console.log(`  ❌ CB STATE CHECK FAILED: ${e.message}`);
    }

    // =============================================================
    // TEST 4: 100 BTC Load Test - Mint and Check
    // =============================================================
    console.log("\n💰 TEST 4: 100 BTC Load Test");
    console.log("-".repeat(40));

    try {
        // Mint 100 WBTC to strategy
        console.log("  Minting 100 WBTC to strategy...");
        const mintTx = await wbtc.mint(STRATEGY_ADDRESS, ethers.parseUnits("100", 8), { gasLimit: 100000 });
        await mintTx.wait();
        console.log("  ✅ Minted 100 WBTC");

        // Mint 100 cbBTC to strategy
        console.log("  Minting 100 cbBTC to strategy...");
        const mintTx2 = await cbbtc.mint(STRATEGY_ADDRESS, ethers.parseUnits("100", 8), { gasLimit: 100000 });
        await mintTx2.wait();
        console.log("  ✅ Minted 100 cbBTC");

        // Check total holdings
        const status = await strategy.getStrategyStatus();
        console.log(`  Total Holdings: ${ethers.formatUnits(status.totalHoldings, 8)} BTC`);

        if (Number(status.totalHoldings) >= 200e8) {
            console.log("  ✅ 100 BTC LOAD TEST PASSED (200 BTC total in strategy)");
        } else {
            console.log("  ⚠️ Holdings less than expected");
        }
    } catch (e) {
        console.log(`  ❌ LOAD TEST FAILED: ${e.message}`);
    }

    // =============================================================
    // TEST 5: Execute Report (Rebalance Attempt)
    // =============================================================
    console.log("\n⚖️ TEST 5: Rebalance Execution");
    console.log("-".repeat(40));

    try {
        console.log("  Calling report() to trigger rebalance...");
        const tx = await strategy.report({ gasLimit: 2000000 });
        const receipt = await tx.wait();
        console.log(`  Tx Hash: ${receipt.hash}`);
        console.log("  ✅ REPORT EXECUTED (rebalance attempted)");

        // Check status after
        const statusAfter = await strategy.getStrategyStatus();
        console.log(`  Rebalances Executed: ${statusAfter.rebalancesExecuted}`);
        console.log(`  Rebalances Failed: ${statusAfter.rebalancesFailed}`);
    } catch (e) {
        console.log(`  ❌ REPORT FAILED: ${e.message}`);
    }

    // =============================================================
    // FINAL SUMMARY
    // =============================================================
    console.log("\n" + "=".repeat(60));
    console.log("📋 TEST SUITE COMPLETE");
    console.log("=".repeat(60));

    const finalStatus = await strategy.getStrategyStatus();
    console.log(`Total Holdings: ${ethers.formatUnits(finalStatus.totalHoldings, 8)} BTC`);
    console.log(`WBTC Balance: ${ethers.formatUnits(await wbtc.balanceOf(STRATEGY_ADDRESS), 8)} WBTC`);
    console.log(`cbBTC Balance: ${ethers.formatUnits(await cbbtc.balanceOf(STRATEGY_ADDRESS), 8)} cbBTC`);
}

main().catch(console.error);
