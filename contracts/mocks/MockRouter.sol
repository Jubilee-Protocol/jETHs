// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMintableERC20 {
    function mint(address to, uint256 amount) external;
}

contract MockRouter {
    // 1:1 swap rate by default for simplicity, or just mint exact amount requested as minOut

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(path.length >= 2, "Invalid path");

        // Transfer input tokens from sender to this router (simulate swap logic)
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);

        // In a real mock environment for these tests, we want to ensure the swap succeeds
        // and gives us back enough tokens to pass the Zap checks.
        // We'll simulate a perfect swap that gives exactly amountIn * 1 (ignoring decimals in this naive mock)
        // OR better: we utilize the IMintableERC20 interface since we use mocks.

        address tokenOut = path[path.length - 1];

        // We assume tokenOut is our MockERC20 which has a mint function.
        // We mint `amountOutMin` + 1 to the recipient to ensure we pass slippage checks.
        // In reality, we should respect prices, but for unit testing the *Zap flow*, passing checks is key.

        uint256 amountOut = amountOutMin == 0 ? amountIn : amountOutMin;

        try IMintableERC20(tokenOut).mint(to, amountOut) {
            // Success
        } catch {
            // Fallback for non-mintable tokens (e.g. if we test with real tokens later)
            // Just assume the router was pre-funded
            IERC20(tokenOut).transfer(to, amountOut);
        }
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        amounts[amounts.length - 1] = amountOut;

        return amounts;
    }

    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(
        ExactInputSingleParams calldata params
    ) external payable returns (uint256 amountOut) {
        // Transfer inputs to router
        IERC20(params.tokenIn).transferFrom(
            msg.sender,
            address(this),
            params.amountIn
        );

        // Calculate amountOut (1:1 for testing)
        amountOut = params.amountOutMinimum == 0
            ? params.amountIn
            : params.amountOutMinimum;

        // Mint or Transfer output
        try IMintableERC20(params.tokenOut).mint(params.recipient, amountOut) {
            // Success
        } catch {
            IERC20(params.tokenOut).transfer(params.recipient, amountOut);
        }
    }

    function getAmountsOut(
        uint256 amountIn,
        address[] calldata path
    ) external pure returns (uint256[] memory amounts) {
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i = 1; i < path.length; i++) {
            amounts[i] = amountIn; // 1:1 ratio for testing
        }
    }
}
