const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = require("ethers");

describe("YearnJETHsStrategy Deployment", function () {
    let strategy;
    let owner;

    it("Should deploy the strategy successfully", async function () {
        // 1. Setup Provider & Wallet
        // Hardhat network provider is global if running via `hardhat test`, but standard ethers provider needs to connect to it.
        // Actually, inside `hardhat test`, `hre.network.provider` is the EIP1193 provider.
        // Ethers v6 BrowserProvider wraps EIP1193.
        const provider = new ethers.BrowserProvider(hre.network.provider);
        const signer = await provider.getSigner(0); // Account #0

        console.log("Deploying with account:", await signer.getAddress());

        // Helper
        const deploy = async (name, args = []) => {
            const artifact = await hre.artifacts.readArtifact(name);
            const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
            const contract = await factory.deploy(...args);
            await contract.waitForDeployment();
            return contract;
        };

        // 1. Deploy Mocks
        const weth = await deploy("MockERC20", ["Wrapped ETH", "WETH", 18]);
        const wsteth = await deploy("MockERC20", ["Wrapped Staked ETH", "wstETH", 18]);
        const cbeth = await deploy("MockERC20", ["Coinbase ETH", "cbETH", 18]);
        const reth = await deploy("MockERC20", ["Rocket Pool ETH", "rETH", 18]);

        const ethOracle = await deploy("MockChainlinkOracle", [300000000000, 8]); // $3000
        const wstOracle = await deploy("MockChainlinkOracle", [1150000000000000000n, 18]);
        const cbOracle = await deploy("MockChainlinkOracle", [1050000000000000000n, 18]);
        const rOracle = await deploy("MockChainlinkOracle", [1100000000000000000n, 18]);

        const router = await deploy("MockRouter");

        // 2. Deploy Strategy
        const strategyName = "jETHs Index";
        strategy = await deploy("YearnJETHsStrategy", [
            await weth.getAddress(),
            strategyName,
            await wsteth.getAddress(),
            await cbeth.getAddress(),
            await reth.getAddress(),
            await wstOracle.getAddress(),
            await cbOracle.getAddress(),
            await rOracle.getAddress(),
            await router.getAddress(), // uniswapV2
            await router.getAddress(), // uniswapV3
            await router.getAddress()  // curve
        ]);

        console.log("Strategy deployed at:", await strategy.getAddress());

        // Use the ERC20 interface to check the name since it's handled via fallback
        const strategyAsERC20 = new ethers.Contract(await strategy.getAddress(), ["function name() view returns (string)"], signer);
        const name = await strategyAsERC20.name();
        if (name !== strategyName) {
            throw new Error(`Name mismatch: expected ${strategyName}, got ${name}`);
        }
    });
});
