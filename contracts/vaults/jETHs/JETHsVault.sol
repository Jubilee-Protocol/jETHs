// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IYearnStrategy {
    function deposit(
        uint256 assets,
        address receiver
    ) external returns (uint256);
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external returns (uint256);
    function totalAssets() external view returns (uint256);
}

/**
 * @title JETHsVault
 * @author Jubilee Labs
 * @notice The primary entry point for the Jubilee ETH Staking Index (jETHs)
 */
contract JETHsVault is ERC4626, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public strategy;

    event StrategyUpdated(address indexed newStrategy);

    constructor(
        IERC20 _asset,
        string memory _name,
        string memory _symbol,
        address _strategy,
        address _initialOwner
    ) ERC4626(_asset) ERC20(_name, _symbol) Ownable(_initialOwner) {
        strategy = _strategy;
    }

    /**
     * @notice Set a new strategy for the vault
     * @param _strategy The address of the new strategy
     */
    function setStrategy(address _strategy) external onlyOwner {
        require(_strategy != address(0), "Invalid strategy");
        strategy = _strategy;
        emit StrategyUpdated(_strategy);
    }

    /** @dev See {IERC4626-totalAssets}. */
    function totalAssets() public view virtual override returns (uint256) {
        // Includes idle assets in this vault + assets in strategy + virtual assets
        return
            IERC20(asset()).balanceOf(address(this)) +
            IYearnStrategy(strategy).totalAssets() +
            1; // +1 for inflation protection
    }

    /** @dev See {ERC4626-_deposit}. */
    function _deposit(
        address caller,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal virtual override {
        super._deposit(caller, receiver, assets, shares);

        // Push assets to strategy
        address asset_ = address(asset());
        IERC20(asset_).forceApprove(strategy, assets);
        IYearnStrategy(strategy).deposit(assets, address(this));
    }

    /** @dev See {ERC4626-_withdraw}. */
    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal virtual override {
        // Pull assets from strategy if needed
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        if (idle < assets) {
            uint256 needed = assets - idle;
            IYearnStrategy(strategy).withdraw(
                needed,
                address(this),
                address(this)
            );
        }

        super._withdraw(caller, receiver, owner, assets, shares);
    }

    /**
     * @dev Override decimals for inflation protection if needed,
     * but usually 18 is fine. The key is totalAssets() + 1 and totalSupply() + 10**decimals.
     */
    function _decimalsOffset() internal view virtual override returns (uint8) {
        return 3; // Virtual shares offset
    }

    // Additional zapper functions can be added here (ETH -> jETHs, stETH -> jETHs, etc.)
}
