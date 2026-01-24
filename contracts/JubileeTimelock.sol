// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title JubileeTimelock
 * @notice 24-hour timelock for jETHs strategy management
 * @dev Wraps OpenZeppelin's TimelockController for strategy governance
 *
 * Usage:
 * 1. Deploy this contract
 * 2. Transfer strategy management to this timelock
 * 3. All admin calls now require 24hr delay
 *
 * Emergency functions (pause, oracle mode) bypass timelock
 * by using the emergencyAdmin role directly on the strategy.
 */
contract JubileeTimelock is TimelockController {
    uint256 public constant MIN_DELAY = 1 days; // 24 hours

    /**
     * @notice Deploy the timelock
     * @param admin The address that can propose, execute, and cancel
     * @dev In production, consider separating proposer/executor roles
     */
    constructor(
        address admin
    )
        TimelockController(
            MIN_DELAY, // Minimum delay: 24 hours
            _toArray(admin), // Proposers: admin only
            _toArray(admin), // Executors: admin only
            address(0) // No separate admin (deployer manages)
        )
    {}

    /**
     * @dev Helper to create single-element array
     */
    function _toArray(address addr) internal pure returns (address[] memory) {
        address[] memory arr = new address[](1);
        arr[0] = addr;
        return arr;
    }
}
