const hre = require("hardhat");

async function main() {
    console.log("Keys in hre:", Object.keys(hre));
    console.log("ethers present?", !!hre.ethers);
    if (hre.ethers) {
        console.log("ethers keys:", Object.keys(hre.ethers));
        console.log("ethers.getSigners type:", typeof hre.ethers.getSigners);
    }
}

main().catch(console.error);
