// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockChainlinkOracle {
    int256 public price;
    uint8 public decimalsVal;
    uint256 public updatedAtVal;

    constructor(int256 _initialPrice, uint8 _decimals) {
        price = _initialPrice;
        decimalsVal = _decimals;
        updatedAtVal = block.timestamp;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            1, // roundId
            price, // answer
            updatedAtVal, // startedAt
            updatedAtVal, // updatedAt
            1 // answeredInRound
        );
    }

    function decimals() external view returns (uint8) {
        return decimalsVal;
    }

    // Helper to update price
    function setPrice(int256 _price) external {
        price = _price;
        updatedAtVal = block.timestamp;
    }

    // Alias for compatibility and explicit setting
    function updateAnswer(int256 _price) external {
        price = _price;
        updatedAtVal = block.timestamp;
    }

    // For stale price testing
    function setUpdatedAt(uint256 _updatedAt) external {
        updatedAtVal = _updatedAt;
    }
}
