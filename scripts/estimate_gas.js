const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Simulating deployment with account:", deployer.address);

    // Mainnet Placeholder addresses (Normalized for ethers v6)
    const WETH = hre.ethers.getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2".toLowerCase());
    const WSTETH = hre.ethers.getAddress("0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0".toLowerCase());
    const CBETH = hre.ethers.getAddress("0xbe9895146f7af43049ca1c1ae358b0541ea49704".toLowerCase());
    const RETH = hre.ethers.getAddress("0xae78736cd615f374d3085123a210448e74fc6393".toLowerCase());
    const WSTETH_ORACLE = hre.ethers.getAddress("0xCfE54B5cd566C7AD883b394aA986E3241C020B42".toLowerCase());
    const CBETH_ORACLE = hre.ethers.getAddress("0x4db0B1879B51877CF163C0DA280455B188f6B491".toLowerCase());
    const RETH_ORACLE = hre.ethers.getAddress("0x536218f9E9Eb48863970252233c8F271f554C2d0".toLowerCase());
    const UNISWAP_V2 = hre.ethers.getAddress("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D".toLowerCase());
    const UNISWAP_V3 = hre.ethers.getAddress("0xE592427A0AEce92De3Edee1F18E0157C05861564".toLowerCase());
    const CURVE = hre.ethers.getAddress("0x99a58482BD75cb41660213Bb184C102483320771".toLowerCase());

    const Strategy = await hre.ethers.getContractFactory("YearnJETHsStrategy");
    const strategyDeployTx = await Strategy.getDeployTransaction(
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

    const strategyGas = await deployer.estimateGas(strategyDeployTx);
    console.log("Estimated Gas for YearnJETHsStrategy:", strategyGas.toString());

    const Vault = await hre.ethers.getContractFactory("JETHsVault");
    const vaultDeployTx = await Vault.getDeployTransaction(
        WETH,
        "JETHs Vault",
        "jETHs",
        "0x0000000000000000000000000000000000000001", // Dummy strategy
        deployer.address
    );
    const vaultGas = await deployer.estimateGas(vaultDeployTx);
    console.log("Estimated Gas for JETHsVault:", vaultGas.toString());

    const totalGas = strategyGas + vaultGas;
    console.log("Total Estimated Gas:", totalGas.toString());
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
