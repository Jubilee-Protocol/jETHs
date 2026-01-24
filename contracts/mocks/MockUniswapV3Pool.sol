// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockUniswapV3Pool {
    uint160 public sqrtPriceX96;
    address public token0;
    address public token1;
    int24 public mockTick; // Store the tick for TWAP calculation

    constructor(address _token0, address _token1, uint160 _sqrtPriceX96) {
        token0 = _token0;
        token1 = _token1;
        sqrtPriceX96 = _sqrtPriceX96;
        mockTick = 0; // Tick 0 = 1:1 price ratio
    }

    function slot0()
        external
        view
        returns (uint160, int24, uint16, uint16, uint16, uint8, bool)
    {
        return (
            sqrtPriceX96,
            mockTick, // Return the mock tick
            0, // observationIndex
            100, // observationCardinality (high enough to pass check)
            100, // observationCardinalityNext
            0, // feeProtocol
            true // unlocked
        );
    }

    // Mock observe function that returns consistent tick cumulatives
    // This simulates a stable TWAP that matches the spot price
    function observe(
        uint32[] calldata secondsAgos
    )
        external
        view
        returns (
            int56[] memory tickCumulatives,
            uint160[] memory secondsPerLiquidityCumulativeX128s
        )
    {
        tickCumulatives = new int56[](secondsAgos.length);
        secondsPerLiquidityCumulativeX128s = new uint160[](secondsAgos.length);

        // Return tick cumulatives that produce the same price as spot
        // tickCumulative = tick * time, so for stable price:
        // (tickCumulative[0] - tickCumulative[1]) / (secondsAgos[1] - secondsAgos[0]) = mockTick
        for (uint256 i = 0; i < secondsAgos.length; i++) {
            // Mock cumulative ticks based on elapsed time
            // This ensures TWAP calculation returns mockTick
            int56 elapsedTime = int56(uint56(block.timestamp)) -
                int56(uint56(secondsAgos[i]));
            tickCumulatives[i] = int56(mockTick) * elapsedTime;
            secondsPerLiquidityCumulativeX128s[i] = uint160(
                block.timestamp - uint256(secondsAgos[i])
            );
        }
    }

    // Helper to update price for testing
    function setPrice(uint160 _sqrtPriceX96, int24 _tick) external {
        sqrtPriceX96 = _sqrtPriceX96;
        mockTick = _tick;
    }
}
