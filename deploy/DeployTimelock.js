/**
 * Deploy Timelock for jBTCi Strategy
 * 
 * Usage:
 *   npx hardhat run deploy/DeployTimelock.js --network baseSepolia
 *   npx hardhat run deploy/DeployTimelock.js --network base
 */

const { ethers } = require("ethers");
const hre = require("hardhat");
require("dotenv").config();

async function main() {
    console.log("🔐 Deploying JubileeTimelock...\n");

    // Setup Provider & Wallet manually (matching testnet pattern)
    const provider = new ethers.JsonRpcProvider(hre.network.config.url);
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) throw new Error("PRIVATE_KEY not found in .env");

    const deployer = new ethers.Wallet(privateKey, provider);
    console.log(`Deployer: ${deployer.address}`);

    // Helper to get factory
    const getFactory = async (name) => {
        const artifact = await hre.artifacts.readArtifact(name);
        return new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
    };

    // Deploy Timelock
    const JubileeTimelock = await getFactory("JubileeTimelock");
    const timelock = await JubileeTimelock.deploy(deployer.address);
    await timelock.waitForDeployment();

    const timelockAddr = await timelock.getAddress();
    console.log(`\n✅ Timelock deployed: ${timelockAddr}`);
    console.log(`   Min delay: 24 hours`);

    console.log("\n📋 POST-DEPLOYMENT STEPS:");
    console.log("   1. Deploy strategy (if not done)");
    console.log("   2. Keep yourself as emergencyAdmin for instant pause access");
    console.log("   3. Transfer management to timelock for 24hr governance delay");

    return timelockAddr;
}

main()
    .then((addr) => {
        console.log(`\n✅ Complete: ${addr}`);
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Failed:", error);
        process.exit(1);
    });
