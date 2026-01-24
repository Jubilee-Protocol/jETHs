const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = require("ethers");

describe("YearnJETHsStrategy STRESS TESTS", function () {
    let strategy;
    let owner;
    let provider; // Make provider global
    let weth, wsteth, cbeth, reth;
    let ethOracle, wstOracle, cbOracle, rOracle;
    let router;
    let wethAddr, wstAddr, cbAddr, rethAddr;

    // Helper to deploy
    const deploy = async (name, args = [], signer) => {
        const artifact = await hre.artifacts.readArtifact(name);
        const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
        const contract = await factory.deploy(...args);
        await contract.waitForDeployment();
        return contract;
    };

    beforeEach(async function () {
        provider = new ethers.BrowserProvider(hre.network.provider);
        const signer = await provider.getSigner(0);
        owner = signer;

        // 1. Deploy Mocks
        weth = await deploy("MockERC20", ["Wrapped ETH", "WETH", 18], signer);
        wsteth = await deploy("MockERC20", ["Wrapped Staked ETH", "wstETH", 18], signer);
        cbeth = await deploy("MockERC20", ["Coinbase ETH", "cbETH", 18], signer);
        reth = await deploy("MockERC20", ["Rocket Pool ETH", "rETH", 18], signer);

        wethAddr = await weth.getAddress();
        wstAddr = await wsteth.getAddress();
        cbAddr = await cbeth.getAddress();
        rethAddr = await reth.getAddress();

        // Oracles (Normal state)
        ethOracle = await deploy("MockChainlinkOracle", [300000000000, 8], signer); // $3000
        wstOracle = await deploy("MockChainlinkOracle", [1150000000000000000n, 18], signer); // 1.15
        cbOracle = await deploy("MockChainlinkOracle", [1050000000000000000n, 18], signer); // 1.05
        rOracle = await deploy("MockChainlinkOracle", [1100000000000000000n, 18], signer); // 1.10

        router = await deploy("MockRouter", [], signer);

        // 2. Deploy Strategy
        strategy = await deploy("YearnJETHsStrategy", [
            wethAddr,
            "jETHs Index",
            wstAddr,
            cbAddr,
            rethAddr,
            await wstOracle.getAddress(),
            await cbOracle.getAddress(),
            await rOracle.getAddress(),
            await router.getAddress(), // V2
            await router.getAddress(), // V3
            await router.getAddress()  // Curve
        ], signer);

        // Setup initial balances for Strategy (Simulate deposits)
        // Give strategy 100 WETH, 100 wstETH, 100 cbETH, 100 rETH
        await weth.mint(await strategy.getAddress(), ethers.parseEther("100"));
        await wsteth.mint(await strategy.getAddress(), ethers.parseEther("100"));
        await cbeth.mint(await strategy.getAddress(), ethers.parseEther("100"));
        await reth.mint(await strategy.getAddress(), ethers.parseEther("100"));
    });

    it("STRESS 1: Market Crash (50% Drop)", async function () {
        // Drop ETH price to $1500
        await ethOracle.updateAnswer(150000000000);

        // Drop LST peg (Depeg event) - wstETH drops to 0.8 ETH
        await wstOracle.updateAnswer(800000000000000000n);

        // Strategy should still calculate total value correctly (lower)
        // Total Holdings Calculation Check
        // 100 WETH = 100 ETH
        // 100 wstETH = 80 ETH
        // 100 cbETH = 105 ETH
        // 100 rETH = 110 ETH
        // Total = 395 ETH

        // We use availableDepositLimit to verify _calculateTotalHoldings (Limit = Cap - Holdings)
        // Cap is 1000 ETH.
        // Expected Limit = 1000 - 395 = 605 ETH

        const limit = await strategy.availableDepositLimit(owner.address);

        // Expected Limit ~ 605 ETH (Exact match expected with mock math)
        const expectedLimit = ethers.parseEther("605");
        expect(limit).to.equal(expectedLimit);
    });

    it("STRESS 2: Deposit Cap Enforcement", async function () {
        // Default cap 1000 ETH. Current holdings ~430 ETH

        // Set Cap to 400 ETH (below current holdings)
        await strategy.setParameters(
            ethers.parseEther("400"), // Deposit Cap
            200, // Threshold
            100, // Slippage
            ethers.parseEther("0.005"), // Min profit
            25 // Swap fee
        );

        // Available limit should be 0
        const limit = await strategy.availableDepositLimit(owner.address);
        expect(limit.toString()).to.equal("0");

        // Set Cap to 500 ETH
        await strategy.setParameters(ethers.parseEther("500"), 200, 100, ethers.parseEther("0.005"), 25);

        // Current holdings ~430
        // Limit should be ~70
        const limit2 = await strategy.availableDepositLimit(owner.address);
        expect(limit2).to.be.gt(ethers.parseEther("69"));
        expect(limit2).to.be.lt(ethers.parseEther("71"));
    });

    it("STRESS 3: Oracle Failure (Stale Price)", async function () {
        // MockOracle doesn't check staleness locally, the Strategy does.
        // Strategy constraint: ORACLE_STALE_THRESHOLD = 24 hours

        const latestBlock = await provider.getBlock("latest");
        const oldTimestamp = latestBlock.timestamp - (25 * 3600); // 25 hours ago

        // Make wstETH Oracle Stale
        await wstOracle.setUpdatedAt(oldTimestamp);

        // Strategy health check should fail, causing revert on valuation
        // availableDepositLimit -> _calculateTotalHoldings -> _getChainlinkPrice
        await expect(strategy.availableDepositLimit(owner.address)).to.be.reverted;
    });
});
