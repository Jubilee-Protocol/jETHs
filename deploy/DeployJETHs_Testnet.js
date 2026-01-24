/**
 * Testnet Deployment Script - jETHs Protocol
 * 
 * IMPORTANT: This deploys to Sepolia Testnet!
 * 
 * Prerequisites:
 * 1. Sepolia ETH in deployer wallet
 * 2. Mocks deployed or addresses identified
 */

const hre = require("hardhat");
const { ethers } = require("ethers");

async function main() {
    console.log("🚀 Deploying jETHs to SEPOLIA TESTNET...\n");
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deploying from: ${deployer.address}`);

    // ==========================================
    // SEPOLIA CONFIGURATION (Placeholder mocks)
    // ==========================================
    // These should be updated after running Mock deployment if needed
    const WETH = "0x595211c89774c7976818BF6927e6782Df0dadB09";
    const WSTETH = "0x0000000000000000000000000000000000000001";
    const CBETH = "0x0000000000000000000000000000000000000002";
    const RETH = "0x0000000000000000000000000000000000000003";

    const WSTETH_ORACLE = "0x0000000000000000000000000000000000000004";
    const CBETH_ORACLE = "0x0000000000000000000000000000000000000005";
    const RETH_ORACLE = "0x0000000000000000000000000000000000000006";

    const UNISWAP_V2 = "0x0000000000000000000000000000000000000007";
    const UNISWAP_V3 = "0x0000000000000000000000000000000000000008";
    const CURVE = "0x0000000000000000000000000000000000000009";

    // 1. Deploy Strategy
    console.log("⏳ Deploying Strategy...");
    const Strategy = await hre.ethers.getContractFactory("YearnJETHsStrategy");
    const strategy = await Strategy.deploy(
        WETH,
        "jETHs Sepolia Strategy",
        WSTETH,
        CBETH,
        RETH,
        WSTETH_ORACLE,
        CBETH_ORACLE,
        RETH_ORACLE,
        UNISWAP_V2,
        UNISWAP_V3,
        CURVE
    );
    await strategy.waitForDeployment();
    const strategyAddress = await strategy.getAddress();
    console.log(`✅ Strategy: ${strategyAddress}`);

    // 2. Deploy Vault
    console.log("⏳ Deploying Vault...");
    const Vault = await hre.ethers.getContractFactory("JETHsVault");
    const vault = await Vault.deploy(
        WETH,
        "jETHs Sepolia Vault",
        "jETHs-S",
        strategyAddress,
        deployer.address
    );
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log(`✅ Vault: ${vaultAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
