const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts on Sepolia with account:", deployer.address);

    const deploy = async (name, args = []) => {
        const factory = await hre.ethers.getContractFactory(name);
        const contract = await factory.deploy(...args);
        await contract.waitForDeployment();
        return contract;
    };

    // 1. Deploy Mocks
    console.log("Deploying Mocks...");
    const weth = await deploy("MockERC20", ["Wrapped ETH", "WETH", 18]);
    const wsteth = await deploy("MockERC20", ["Wrapped Staked ETH", "wstETH", 18]);
    const cbeth = await deploy("MockERC20", ["Coinbase ETH", "cbETH", 18]);
    const reth = await deploy("MockERC20", ["Rocket Pool ETH", "rETH", 18]);

    const wstOracle = await deploy("MockChainlinkOracle", [ethers.parseEther("1.15"), 18]);
    const cbOracle = await deploy("MockChainlinkOracle", [ethers.parseEther("1.05"), 18]);
    const rOracle = await deploy("MockChainlinkOracle", [ethers.parseEther("1.10"), 18]);

    const router = await deploy("MockRouter");

    const wethAddr = await weth.getAddress();
    const wstAddr = await wsteth.getAddress();
    const cbAddr = await cbeth.getAddress();
    const rethAddr = await reth.getAddress();
    const routerAddr = await router.getAddress();

    // 2. Deploy Strategy
    console.log("Deploying YearnJETHsStrategy...");
    const strategy = await deploy("YearnJETHsStrategy", [
        wethAddr,
        "jETHs Index Testnet",
        wstAddr,
        cbAddr,
        rethAddr,
        await wstOracle.getAddress(),
        await cbOracle.getAddress(),
        await rOracle.getAddress(),
        routerAddr, // V2
        routerAddr, // V3
        routerAddr  // Curve
    ]);
    const strategyAddress = await strategy.getAddress();
    console.log("Strategy deployed to:", strategyAddress);

    // 3. Deploy Vault
    console.log("Deploying JETHsVault...");
    const vault = await deploy(
        "JETHsVault",
        [wethAddr, "jETHs Vault", "jETHs", strategyAddress, deployer.address]
    );
    console.log("Vault deployed to:", await vault.getAddress());

    console.log("--- Sepolia Deployment Summary ---");
    console.log("WETH:", wethAddr);
    console.log("Strategy:", strategyAddress);
    console.log("Vault:", await vault.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
