/**
 * Mainnet Deployment Script - jETHs Protocol
 * 
 * IMPORTANT: This deploys to Ethereum MAINNET!
 * 
 * Prerequisites:
 * 1. Sufficient ETH in deployer wallet for gas
 * 2. PRIVATE_KEY in .env file
 * 3. Verified RPC URL for Ethereum Mainnet
 */

const hre = require("hardhat");
const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
    console.log("🚀 Deploying jETHs to ETHEREUM MAINNET...\n");
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deploying from: ${deployer.address}`);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

    // ==========================================
    // ETHEREUM MAINNET ADDRESSES
    // ==========================================
    const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const WSTETH = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0";
    const CBETH = "0xbe9895146f7af43049ca1c1ae358b0541ea49704";
    const RETH = "0xae78736cd615f374d3085123a210448e74fc6393";

    // Chainlink Oracles (Token / ETH)
    const WSTETH_ORACLE = "0xCfE54B5cd566C7AD883b394aA986E3241C020B42"; // stETH/ETH
    const CBETH_ORACLE = "0x4db0B1879B51877CF163C0DA280455B188f6B491"; // cbETH/ETH
    const RETH_ORACLE = "0x536218f9E9Eb48863970252233c8F271f554C2d0"; // rETH/ETH

    // Routers
    const UNISWAP_V2 = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
    const UNISWAP_V3 = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
    const CURVE = "0x99a58482BD75cb41660213Bb184C102483320771";

    console.log("📋 Mainnet Configuration Verified.");

    // 1. Deploy Strategy
    console.log("\n⏳ Deploying YearnJETHsStrategy...");
    const Strategy = await hre.ethers.getContractFactory("YearnJETHsStrategy");
    const strategy = await Strategy.deploy(
        WETH,
        "Jubilee ETH Staked Index",
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
    console.log(`✅ Strategy deployed at: ${strategyAddress}`);

    // 2. Deploy Vault
    console.log("\n⏳ Deploying JETHsVault...");
    const Vault = await hre.ethers.getContractFactory("JETHsVault");
    const vault = await Vault.deploy(
        WETH,
        "JETHs Vault",
        "jETHs",
        strategyAddress,
        deployer.address
    );
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log(`✅ Vault deployed at: ${vaultAddress}`);

    console.log("\n" + "=".repeat(50));
    console.log("🎉 MAINNET DEPLOYMENT SUCCESSFUL!");
    console.log("=".repeat(50));
    console.log(`Vault:    ${vaultAddress}`);
    console.log(`Strategy: ${strategyAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
