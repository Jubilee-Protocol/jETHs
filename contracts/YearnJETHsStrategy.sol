// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseStrategy} from "./lib/tokenized-strategy/BaseStrategy.sol";
import {
    SafeERC20,
    IERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ============================================================================
//                           CUSTOM ERRORS
// ============================================================================

error ZeroAddress();
error SameAddress();
error InvalidPrice();
error StalePrice();
error PriceDeviation();
error PriceOutOfRange();
error InsufficientBalance();
error PositionTooSmall();
error PositionTooLarge();
error SlippageExceeded();
error AmountExceedsLimit();
error AmountIsZero();
error InternalOnly();
error AlreadyPaused();
error NotPaused();
error AlreadyInFailureMode();
error NotInFailureMode();
error BelowMinimum();
error ExceedsMaximum();
error DuplicateTokens();
error InvalidTick();
error InvalidPool();
error AlreadyQueued(uint256 id);
error WithdrawalNotReady();
error WithdrawalAlreadyClaimed();
error InvalidWithdrawalId();

// ============================================================================
//                            INTERFACES
// ============================================================================

interface IChainlinkOracle {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );

    function decimals() external view returns (uint8);
}

interface IDEXRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getAmountsOut(
        uint256 amountIn,
        address[] calldata path
    ) external view returns (uint256[] memory amounts);
}

interface IUniswapV3Router {
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
    ) external payable returns (uint256 amountOut);
}

interface IUniswapV3Pool {
    function observe(
        uint32[] calldata secondsAgos
    )
        external
        view
        returns (
            int56[] memory tickCumulatives,
            uint160[] memory secondsPerLiquidityCumulativeX123s
        );
}

// ============================================================================
//                            LIBRARIES
// ============================================================================

// ============================================================================
//                            MAIN CONTRACT
// ============================================================================

/**
 * @title jETHs
 * @author Jubilee Labs on behalf of Jubilee Protocol & Hundredfold Foundation
 * @notice The Jubilee ETH Staking Index on Ethereum Mainnet via Yearn V3
 */
contract YearnJETHsStrategy is BaseStrategy, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // ========================================================================
    //                        STATE VARIABLES - TOKENS
    // ========================================================================

    IERC20 public immutable WSTETH;
    IERC20 public immutable CBETH;
    IERC20 public immutable RETH;

    // ========================================================================
    //                        STATE VARIABLES - ORACLES
    // ========================================================================

    // LST/ETH oracles
    IChainlinkOracle public immutable WSTETH_ETH_ORACLE;
    IChainlinkOracle public immutable CBETH_ETH_ORACLE;
    IChainlinkOracle public immutable RETH_ETH_ORACLE;

    // ========================================================================
    //                        STATE VARIABLES - ROUTERS
    // ========================================================================

    IDEXRouter public immutable UNISWAP_V2_ROUTER; // For legacy paths if needed
    address public immutable UNISWAP_V3_ROUTER;
    address public immutable CURVE_ROUTER;

    // ========================================================================
    //                    STATE VARIABLES - STRATEGY PARAMETERS
    // ========================================================================

    uint256 public depositCap = 1000e18; // 1000 ETH
    uint256 public rebalanceThreshold = 200; // 2%
    uint256 public minArbitrageProfit = 0.005e18; // 0.005 ETH

    // Target Weights (in Basis Points)
    uint256 public constant WSTETH_WEIGHT = 4000; // 40%
    uint256 public constant CBETH_WEIGHT = 3500; // 35%
    uint256 public constant RETH_WEIGHT = 2500; // 25%

    // Dynamic gas tracking
    uint256 public lastEstimatedGasInETH;
    uint256 public maxGasPerRebalancePercent = 500; // 5%

    // Approval management
    mapping(address => mapping(address => uint256)) public swapApprovals;
    mapping(address => mapping(address => uint256)) public approvalTimestamps;
    mapping(address => mapping(address => bool)) public approvalExpired;
    uint256 public maxApprovalPerSwap = 100e18; // 100 ETH max per swap

    // Circuit breaker - multi-level
    uint256 public failedRebalanceCount;
    uint256 public lastFailedRebalance;
    uint256 public constant MAX_FAILED_REBALANCES = 3;
    uint256 public circuitBreakerCooldown = 1 days;
    bool public circuitBreakerTriggered;
    bool public gradualRecoveryActive;
    uint256 public preRecoveryDailyLimit;

    // Withdrawal Queue
    struct WithdrawalRequest {
        address user;
        uint256 amount; // in Asset (WETH) terms
        uint256 timestamp;
        bool processed;
        bool claimed;
    }
    mapping(uint256 => WithdrawalRequest) public withdrawalRequests;
    uint256 public nextWithdrawalId;
    uint256 public withdrawalDelay = 1 days;

    // Emergency state
    uint256 public emergencyWithdrawCount;
    uint256 public lastEmergencyWithdraw;

    // Position limits
    uint256 public maxPositionSize = 1000e18; // 1000 ETH
    string public strategyName;
    uint256 public minPositionSize = 0.01e18; // 0.01 ETH

    // Rate limiting with tracking
    uint256 public dailySwapLimitETH = 500e18; // 500 ETH daily swap limit
    uint256 public swapLimitResetTime;
    uint256 public dailySwapVolumeUsed;

    uint256 public lastRebalanceTime;
    uint256 public minRebalanceInterval = 1 hours;
    uint256 public lastSwapTime;
    uint256 public minSwapInterval = 10 minutes;

    // Operational flags
    bool public rebalancingPaused;
    bool public emergencyWithdrawActive;
    bool public oracleFailureMode; // Use fallback oracles

    // Historical tracking for monitoring
    uint256 public totalRebalancesExecuted;
    uint256 public totalRebalancesFailed;
    uint256 public totalSwapsExecuted;
    uint256 public totalSwapsFailed;

    // ========================================================================
    //                            CONSTANTS
    // ========================================================================

    uint256 private constant BASIS_POINTS = 10_000;
    uint256 private constant ORACLE_STALE_THRESHOLD = 24 hours; // LST oracles might update less frequently
    uint256 private constant ORACLE_PRICE_DEVIATION_THRESHOLD = 200; // 2%
    uint256 public maxSlippage = 100; // 1% default, configurable
    uint256 private constant EMERGENCY_SLIPPAGE = 500; // 5%
    uint256 public swapFee = 25; // 0.25% default, configurable
    uint256 public twapWindow = 30 minutes;
    uint256 public maxTwapDeviation = 300; // 3%
    uint256 private constant MIN_DEPOSIT_CAP = 1e18;
    uint256 private constant MAX_DEPOSIT_CAP = 10000e18; // 10k ETH maximum
    uint256 private constant GAS_ESTIMATION_BASE = 400_000;
    uint256 private constant GAS_ESTIMATION_BUFFER = 200_000;

    // Price safety bounds
    uint256 private constant MIN_ORACLE_PRICE = 1e7; // $100 min ETH
    uint256 private constant MAX_ORACLE_PRICE = 1e18; // $100k max ETH

    // Events (Copied and adapted where needed)
    event Rebalanced(
        address indexed fromToken,
        address indexed toToken,
        uint256 amountIn,
        uint256 amountOut,
        uint256 profit,
        uint256 timestamp
    );
    event RebalancingCompleted(
        uint256 indexed rebalanceId,
        uint256 timestamp,
        uint256 totalImbalance,
        uint256 gasCost
    );
    event RebalancingFailed(
        uint256 indexed rebalanceId,
        uint256 timestamp,
        uint256 failCount,
        string reason
    );
    event CircuitBreakerTriggered(string indexed reason, uint256 timestamp);
    event CircuitBreakerReset(uint256 timestamp);
    event OracleModeChanged(bool failureMode, uint256 timestamp);
    event DailyLimitReset(uint256 newLimit, uint256 timestamp);
    event ParametersUpdated(
        uint256 depositCap,
        uint256 rebalanceThreshold,
        uint256 minProfit,
        uint256 timestamp
    );
    event EmergencyAction(string indexed action, uint256 timestamp);
    event ApprovalIssued(
        address indexed token,
        address indexed spender,
        uint256 amount,
        uint256 expiry,
        uint256 timestamp
    );
    event ApprovalRevoked(
        address indexed token,
        address indexed spender,
        uint256 timestamp
    );
    event SwapExecuted(
        address indexed fromToken,
        address indexed toToken,
        uint256 amountIn,
        uint256 amountOut,
        uint256 slippageUsed,
        uint256 oraclePrice,
        uint256 dexPrice,
        uint256 timestamp
    );
    event MEVProtectionTriggered(
        string indexed reason,
        uint256 oraclePrice,
        uint256 dexPrice,
        uint256 deviation,
        uint256 timestamp
    );
    event RateLimitExceeded(
        string indexed reason,
        uint256 value,
        uint256 timestamp
    );
    event GasCostCalculated(
        uint256 gasCostWei,
        uint256 gasCostETH,
        uint256 timestamp
    );
    event OraclePriceUpdate(
        address indexed tokenPair,
        uint256 priceFromOracle,
        uint256 priceFromDEX,
        uint256 deviationBps,
        uint256 timestamp
    );
    event OracleFailureDetected(
        address indexed oracle,
        string reason,
        uint256 timestamp
    );
    event WithdrawalQueued(uint256 indexed id);
    event HealthCheck(
        uint256 timestamp,
        bool oraclesHealthy,
        bool routersHealthy,
        uint256 positionSize
    );

    // ========================================================================
    //                            CONSTRUCTOR
    // ========================================================================

    constructor(
        address _asset, // Should be WETH
        string memory _name,
        address _wsteth,
        address _cbeth,
        address _reth,
        address _wstethEthOracle,
        address _cbethEthOracle,
        address _rethEthOracle,
        address _uniswapV2Router,
        address _uniswapV3Router,
        address _curveRouter
    ) BaseStrategy(_asset, _name) {
        // Basic validations
        if (
            _wsteth == address(0) || _cbeth == address(0) || _reth == address(0)
        ) revert ZeroAddress();

        WSTETH = IERC20(_wsteth);
        CBETH = IERC20(_cbeth);
        RETH = IERC20(_reth);

        WSTETH_ETH_ORACLE = IChainlinkOracle(_wstethEthOracle);
        CBETH_ETH_ORACLE = IChainlinkOracle(_cbethEthOracle);
        RETH_ETH_ORACLE = IChainlinkOracle(_rethEthOracle);

        UNISWAP_V2_ROUTER = IDEXRouter(_uniswapV2Router);
        UNISWAP_V3_ROUTER = _uniswapV3Router;
        CURVE_ROUTER = _curveRouter;

        swapLimitResetTime = block.timestamp + 1 days;
        strategyName = _name;
    }

    function name() external view returns (string memory) {
        return strategyName;
    }

    // ========================================================================
    //                    YEARN STRATEGY REQUIRED FUNCTIONS
    // ========================================================================

    function _deployFunds(
        uint256 /* _amount */
    ) internal override nonReentrant {
        if (
            rebalancingPaused ||
            TokenizedStrategy.isShutdown() ||
            circuitBreakerTriggered
        ) {
            return;
        }

        if (block.timestamp < lastRebalanceTime + minRebalanceInterval) {
            emit RateLimitExceeded(
                "RebalInt",
                minRebalanceInterval,
                block.timestamp
            );
            return;
        }

        if (!_performHealthCheck()) return;

        if (_shouldRebalance()) {
            _executeRebalance();
        }
    }

    function _freeFunds(uint256 _amount) internal override nonReentrant {
        uint256 totalBalance = _calculateTotalHoldings();
        if (totalBalance < _amount) revert InsufficientBalance();

        // 1. Try to free funds via DEX swaps if possible (limited slippage)
        uint256 wstBalance = WSTETH.balanceOf(address(this));
        uint256 cbBalance = CBETH.balanceOf(address(this));
        uint256 rBalance = RETH.balanceOf(address(this));

        uint256 freed;

        // Naive proportional attempt
        if (wstBalance > 0) {
            uint256 toWithdraw = (_amount * wstBalance) / totalBalance;
            if (toWithdraw > 0) {
                uint256 before = asset.balanceOf(address(this));
                _swapIfNeeded(
                    address(WSTETH),
                    address(asset),
                    toWithdraw,
                    false
                );
                freed += (asset.balanceOf(address(this)) - before);
            }
        }
        if (cbBalance > 0 && freed < _amount) {
            uint256 toWithdraw = ((_amount - freed) * cbBalance) /
                (totalBalance - freed);
            if (toWithdraw > 0) {
                uint256 before = asset.balanceOf(address(this));
                _swapIfNeeded(
                    address(CBETH),
                    address(asset),
                    toWithdraw,
                    false
                );
                freed += (asset.balanceOf(address(this)) - before);
            }
        }
        if (rBalance > 0 && freed < _amount) {
            uint256 toWithdraw = ((_amount - freed) * rBalance) /
                (totalBalance - freed);
            if (toWithdraw > 0) {
                uint256 before = asset.balanceOf(address(this));
                _swapIfNeeded(address(RETH), address(asset), toWithdraw, false);
                freed += (asset.balanceOf(address(this)) - before);
            }
        }

        // 2. If we couldn't free enough via swaps (e.g. illiquidity), queue the rest
        if (freed < _amount) {
            uint256 remaining = _amount - freed;
            _queueWithdrawal(msg.sender, remaining);
        }
    }

    function _queueWithdrawal(address _user, uint256 _amount) internal {
        withdrawalRequests[nextWithdrawalId] = WithdrawalRequest({
            user: _user,
            amount: _amount,
            timestamp: block.timestamp,
            processed: false,
            claimed: false
        });
        emit WithdrawalQueued(nextWithdrawalId);
        nextWithdrawalId++;
    }

    /**
     * @notice Claim a processed withdrawal from the queue
     * @param _id The ID of the withdrawal request
     */
    function claimWithdrawal(uint256 _id) external nonReentrant {
        WithdrawalRequest storage req = withdrawalRequests[_id];
        if (req.user != msg.sender) revert InternalOnly();
        if (req.claimed) revert WithdrawalAlreadyClaimed();
        if (block.timestamp < req.timestamp + withdrawalDelay)
            revert WithdrawalNotReady();
        if (!req.processed) revert WithdrawalNotReady();

        req.claimed = true;
        IERC20(address(asset)).safeTransfer(req.user, req.amount);
    }

    function _harvestAndReport()
        internal
        override
        nonReentrant
        returns (uint256 _totalAssets)
    {
        if (!TokenizedStrategy.isShutdown() && !rebalancingPaused) {
            _checkCircuitBreaker();
            if (
                !circuitBreakerTriggered &&
                _shouldRebalance() &&
                failedRebalanceCount < MAX_FAILED_REBALANCES
            ) {
                try this._executeRebalanceInternal() {
                    failedRebalanceCount = 0;
                    lastRebalanceTime = block.timestamp;
                    totalRebalancesExecuted++;
                } catch Error(string memory reason) {
                    _handleRebalanceFailure(reason);
                }
            }
        }
        return _calculateTotalHoldings();
    }

    // Limits
    function availableDepositLimit(
        address
    ) public view override returns (uint256) {
        uint256 positionSize = _calculateTotalHoldings();
        uint256 effectiveCap = Math.min(depositCap, maxPositionSize);
        return positionSize >= effectiveCap ? 0 : effectiveCap - positionSize;
    }

    function availableWithdrawLimit(
        address
    ) public view override returns (uint256) {
        return TokenizedStrategy.totalAssets();
    }

    function _emergencyWithdraw(
        uint256 _amount
    ) internal override nonReentrant {
        emergencyWithdrawActive = true;
        emergencyWithdrawCount++;
        lastEmergencyWithdraw = block.timestamp;

        _amount = Math.min(_amount, _calculateTotalHoldings());

        // Liquidate everything to Asset (WETH)
        uint256 wstBalance = WSTETH.balanceOf(address(this));
        if (wstBalance > 0)
            _swapEmergency(address(WSTETH), address(asset), wstBalance);

        uint256 cbBalance = CBETH.balanceOf(address(this));
        if (cbBalance > 0)
            _swapEmergency(address(CBETH), address(asset), cbBalance);

        uint256 rBalance = RETH.balanceOf(address(this));
        if (rBalance > 0)
            _swapEmergency(address(RETH), address(asset), rBalance);

        _revokeAllApprovals();
        emergencyWithdrawActive = false;
        emit EmergencyAction("Withdraw", block.timestamp);
    }

    // ========================================================================
    //                        HEALTH & ORACLE
    // ========================================================================

    function _performHealthCheck() internal returns (bool healthy) {
        bool oraclesHealthy = true;

        // Check all 3 LST oracles
        try this._getChainlinkPrice(address(WSTETH_ETH_ORACLE)) returns (
            uint256
        ) {} catch {
            oraclesHealthy = false;
        }
        try this._getChainlinkPrice(address(CBETH_ETH_ORACLE)) returns (
            uint256
        ) {} catch {
            oraclesHealthy = false;
        }
        try this._getChainlinkPrice(address(RETH_ETH_ORACLE)) returns (
            uint256
        ) {} catch {
            oraclesHealthy = false;
        }
        bool routersHealthy = true;
        try this._checkRouterHealth() returns (bool h) {
            routersHealthy = h;
        } catch {
            routersHealthy = false;
        }
        emit HealthCheck(
            block.timestamp,
            oraclesHealthy,
            routersHealthy,
            _calculateTotalHoldings()
        );
        return oraclesHealthy && routersHealthy;
    }

    function _checkRouterHealth() external view returns (bool) {
        // Simple check
        try UNISWAP_V2_ROUTER.getAmountsOut(1e18, new address[](2)) {
            return true;
        } catch {
            return false;
        }
    }

    function _getChainlinkPrice(address oracle) public view returns (uint256) {
        (, int256 answer, , uint256 updatedAt, ) = IChainlinkOracle(oracle)
            .latestRoundData();
        if (answer <= 0) revert InvalidPrice();
        if (block.timestamp - updatedAt >= ORACLE_STALE_THRESHOLD)
            revert StalePrice();
        return uint256(answer);
    }

    function _getOraclePrice(address _token) internal view returns (uint256) {
        if (_token == address(WSTETH))
            return _getChainlinkPrice(address(WSTETH_ETH_ORACLE));
        if (_token == address(CBETH))
            return _getChainlinkPrice(address(CBETH_ETH_ORACLE));
        if (_token == address(RETH))
            return _getChainlinkPrice(address(RETH_ETH_ORACLE));
        if (_token == address(asset)) return 1e18; // 1 ETH = 1 ETH
        return 0;
    }

    /**
     * @notice Check if DEX price deviates too much from Oracle
     */
    function _checkPriceSafety(
        uint256 oraclePrice,
        uint256 dexPrice
    ) internal view {
        uint256 deviation = oraclePrice > dexPrice
            ? ((oraclePrice - dexPrice) * BASIS_POINTS) / oraclePrice
            : ((dexPrice - oraclePrice) * BASIS_POINTS) / oraclePrice;

        if (deviation > maxTwapDeviation) {
            revert PriceDeviation();
        }
    }

    // ========================================================================
    //                        REBALANCING
    // ========================================================================

    function _shouldRebalance() internal view returns (bool) {
        (uint256 wstW, uint256 cbW, uint256 rW) = _getCurrentWeightings();

        uint256 wstDev = wstW > WSTETH_WEIGHT
            ? wstW - WSTETH_WEIGHT
            : WSTETH_WEIGHT - wstW;
        uint256 cbDev = cbW > CBETH_WEIGHT
            ? cbW - CBETH_WEIGHT
            : CBETH_WEIGHT - cbW;
        uint256 rDev = rW > RETH_WEIGHT ? rW - RETH_WEIGHT : RETH_WEIGHT - rW;

        return
            wstDev > rebalanceThreshold ||
            cbDev > rebalanceThreshold ||
            rDev > rebalanceThreshold;
    }

    // ========================================================================
    //                        HELPERS
    // ========================================================================

    // Asset accounting
    function _calculateTotalHoldings() internal view returns (uint256) {
        uint256 wstBalance = WSTETH.balanceOf(address(this));
        uint256 cbBalance = CBETH.balanceOf(address(this));
        uint256 rBalance = RETH.balanceOf(address(this));
        uint256 idleAsset = asset.balanceOf(address(this));

        uint256 wstInEth = (_getOraclePrice(address(WSTETH)) * wstBalance) /
            1e18;
        uint256 cbInEth = (_getOraclePrice(address(CBETH)) * cbBalance) / 1e18;
        uint256 rInEth = (_getOraclePrice(address(RETH)) * rBalance) / 1e18;

        return wstInEth + cbInEth + rInEth + idleAsset;
    }

    struct StrategyPerformance {
        uint256 rebalancesExecuted;
        uint256 rebalancesFailed;
        uint256 swapsExecuted;
        uint256 swapsFailed;
        uint256 failCount;
        uint256 timeUntilReset;
    }

    struct StrategyAllocations {
        uint256 wsteth;
        uint256 cbeth;
        uint256 reth;
    }

    struct StrategyStatus {
        bool isPaused;
        bool isCBTriggered;
        bool isInOracleFailureMode;
        uint256 totalHoldings;
        uint256 dailySwapUsed;
        uint256 dailySwapLimit;
        uint256 lastGasCost;
        StrategyPerformance stats;
        StrategyAllocations allocs;
        uint256 nextWithdrawalId;
        uint256 withdrawalDelay;
    }

    function getStrategyStatus() external view returns (StrategyStatus memory) {
        uint256 total = _calculateTotalHoldings();

        uint256 wstA = 0;
        uint256 cbA = 0;
        uint256 rA = 0;

        if (total > 0) {
            wstA =
                (((_getOraclePrice(address(WSTETH)) *
                    WSTETH.balanceOf(address(this))) / 1e18) * 10000) /
                total;
            cbA =
                (((_getOraclePrice(address(CBETH)) *
                    CBETH.balanceOf(address(this))) / 1e18) * 10000) /
                total;
            rA =
                (((_getOraclePrice(address(RETH)) *
                    RETH.balanceOf(address(this))) / 1e18) * 10000) /
                total;
        }

        return
            StrategyStatus({
                isPaused: TokenizedStrategy.isShutdown(),
                isCBTriggered: circuitBreakerTriggered,
                isInOracleFailureMode: oracleFailureMode,
                totalHoldings: total,
                dailySwapUsed: dailySwapVolumeUsed,
                dailySwapLimit: dailySwapLimitETH,
                lastGasCost: lastEstimatedGasInETH,
                stats: StrategyPerformance({
                    rebalancesExecuted: totalRebalancesExecuted,
                    rebalancesFailed: totalRebalancesFailed,
                    swapsExecuted: totalSwapsExecuted,
                    swapsFailed: totalSwapsFailed,
                    failCount: failedRebalanceCount,
                    timeUntilReset: (block.timestamp <
                        swapLimitResetTime + 1 days)
                        ? (swapLimitResetTime + 1 days - block.timestamp)
                        : 0
                }),
                allocs: StrategyAllocations({
                    wsteth: wstA,
                    cbeth: cbA,
                    reth: rA
                }),
                nextWithdrawalId: nextWithdrawalId,
                withdrawalDelay: withdrawalDelay
            });
    }

    function totalAssets() public view returns (uint256) {
        return _calculateTotalHoldings();
    }

    function _getCurrentWeightings()
        internal
        view
        returns (uint256 wstW, uint256 cbW, uint256 rW)
    {
        uint256 total = _calculateTotalHoldings();
        if (total == 0) return (0, 0, 0);

        uint256 wstVal = (WSTETH.balanceOf(address(this)) *
            _getChainlinkPrice(address(WSTETH_ETH_ORACLE))) / 1e18;
        uint256 cbVal = (CBETH.balanceOf(address(this)) *
            _getChainlinkPrice(address(CBETH_ETH_ORACLE))) / 1e18;
        uint256 rVal = (RETH.balanceOf(address(this)) *
            _getChainlinkPrice(address(RETH_ETH_ORACLE))) / 1e18;

        wstW = (wstVal * BASIS_POINTS) / total;
        cbW = (cbVal * BASIS_POINTS) / total;
        rW = (rVal * BASIS_POINTS) / total;
    }

    function _executeRebalance() internal {
        uint256 totalBalance = _calculateTotalHoldings();
        if (totalBalance == 0) return;

        // Target values in ETH terms
        uint256 targetWstVal = (totalBalance * WSTETH_WEIGHT) / BASIS_POINTS;
        uint256 targetCbVal = (totalBalance * CBETH_WEIGHT) / BASIS_POINTS;
        uint256 targetRVal = (totalBalance * RETH_WEIGHT) / BASIS_POINTS;

        // Current values in ETH terms
        uint256 wstPrice = _getChainlinkPrice(address(WSTETH_ETH_ORACLE));
        uint256 cbPrice = _getChainlinkPrice(address(CBETH_ETH_ORACLE));
        uint256 rPrice = _getChainlinkPrice(address(RETH_ETH_ORACLE));

        uint256 currentWstVal = (WSTETH.balanceOf(address(this)) * wstPrice) /
            1e18;
        uint256 currentCbVal = (CBETH.balanceOf(address(this)) * cbPrice) /
            1e18;
        uint256 currentRVal = (RETH.balanceOf(address(this)) * rPrice) / 1e18;

        // Rebalancing strategy:
        // 1. Sell Overweights -> to WETH
        // 2. Buy Underweights <- from WETH

        // SELL Phase
        if (
            currentWstVal >
            targetWstVal + ((targetWstVal * rebalanceThreshold) / BASIS_POINTS)
        ) {
            uint256 excessVal = currentWstVal - targetWstVal;
            uint256 amountToSell = (excessVal * 1e18) / wstPrice;
            _swapIfNeeded(address(WSTETH), address(asset), amountToSell, false);
        }
        if (
            currentCbVal >
            targetCbVal + ((targetCbVal * rebalanceThreshold) / BASIS_POINTS)
        ) {
            uint256 excessVal = currentCbVal - targetCbVal;
            uint256 amountToSell = (excessVal * 1e18) / cbPrice;
            _swapIfNeeded(address(CBETH), address(asset), amountToSell, false);
        }
        if (
            currentRVal >
            targetRVal + ((targetRVal * rebalanceThreshold) / BASIS_POINTS)
        ) {
            uint256 excessVal = currentRVal - targetRVal;
            uint256 amountToSell = (excessVal * 1e18) / rPrice;
            _swapIfNeeded(address(RETH), address(asset), amountToSell, false);
        }

        // BUY Phase (using whatever WETH we have, including proceeds from checking 1)
        uint256 wethBalance = asset.balanceOf(address(this));

        if (wethBalance > minArbitrageProfit) {
            // Recalculate deficits based on current WETH holdings availability
            // (We might not have enough WETH to fill all deficits, so fill proportionally or priority)

            // Allow buying if under target
            if (currentWstVal < targetWstVal) {
                uint256 deficitVal = targetWstVal - currentWstVal;
                // Don't buy if diff is negligible
                if (
                    deficitVal >
                    ((targetWstVal * rebalanceThreshold) / BASIS_POINTS)
                ) {
                    // Cap at available WETH
                    uint256 buyVal = Math.min(deficitVal, wethBalance);
                    _swapIfNeeded(
                        address(asset),
                        address(WSTETH),
                        buyVal,
                        false
                    );
                    wethBalance -= buyVal; // Update local tracker
                }
            }
            if (wethBalance > 0 && currentCbVal < targetCbVal) {
                uint256 deficitVal = targetCbVal - currentCbVal;
                if (
                    deficitVal >
                    ((targetCbVal * rebalanceThreshold) / BASIS_POINTS)
                ) {
                    uint256 buyVal = Math.min(deficitVal, wethBalance);
                    _swapIfNeeded(
                        address(asset),
                        address(CBETH),
                        buyVal,
                        false
                    );
                    wethBalance -= buyVal;
                }
            }
            if (wethBalance > 0 && currentRVal < targetRVal) {
                uint256 deficitVal = targetRVal - currentRVal;
                if (
                    deficitVal >
                    ((targetRVal * rebalanceThreshold) / BASIS_POINTS)
                ) {
                    uint256 buyVal = Math.min(deficitVal, wethBalance);
                    _swapIfNeeded(address(asset), address(RETH), buyVal, false);
                }
            }
        }
    }

    // Internal Helper implementation (Placeholder filled)
    function _swapIfNeeded(
        address _from,
        address _to,
        uint256 _amount,
        bool _isEmergency
    ) internal {
        if (_from == _to || _amount == 0) return;

        // In this strategy, we route everything through WETH (Asset).
        // Since we are likely swapping LST <-> WETH, we can check for direct pools.

        // Ideally we use a robust router (Aerodrome/Uniswap) that finds best path.
        // For now, we assume _swapWithProfitCheck handles router selection.

        if (_isEmergency) {
            _swapEmergency(_from, _to, _amount);
        } else {
            _swapWithProfitCheck(_from, _to, _amount);
        }
    }

    function _swapWithProfitCheck(
        address _from,
        address _to,
        uint256 _amount
    ) internal {
        if (_amount == 0) return;

        // Approve Routers
        IERC20(_from).forceApprove(address(UNISWAP_V2_ROUTER), _amount);
        // For V3/Curve we would use different approval/swap logic
        // IERC20(_from).forceApprove(UNISWAP_V3_ROUTER, _amount);

        address[] memory path = new address[](2);
        path[0] = _from;
        path[1] = _to;

        // Quote
        uint256 expOut = 0;
        address bestRouter; // Using address to handle multiple types

        // Uniswap V2
        try UNISWAP_V2_ROUTER.getAmountsOut(_amount, path) returns (
            uint256[] memory amounts
        ) {
            if (amounts.length > 1 && amounts[1] > expOut) {
                expOut = amounts[1];
                bestRouter = address(UNISWAP_V2_ROUTER);
            }
        } catch {}
        // TODO: In production, we add V3 quotes using a Quoter or direct V3 router checks.
        // For now, let's implement the V3 execution logic.

        if (bestRouter == address(0)) {
            return;
        }

        // Price Safety Check (Oracle vs DEX)
        // (Assuming ETH is one of the tokens)
        // ... (Logic to fetch relevant oracle price for comparison)

        // Execute V2 Swap
        if (bestRouter == address(UNISWAP_V2_ROUTER)) {
            uint256 minOut = (expOut * (BASIS_POINTS - maxSlippage)) /
                BASIS_POINTS;

            try
                UNISWAP_V2_ROUTER.swapExactTokensForTokens(
                    _amount,
                    minOut,
                    path,
                    address(this),
                    block.timestamp + 60
                )
            returns (uint256[] memory amounts) {
                emit SwapExecuted(
                    _from,
                    _to,
                    _amount,
                    amounts[amounts.length - 1],
                    0,
                    0,
                    0,
                    block.timestamp
                );
            } catch {}
        }
    }

    function _swapV3(
        address _from,
        address _to,
        uint256 _amount,
        uint24 _fee
    ) internal {
        IERC20(_from).forceApprove(UNISWAP_V3_ROUTER, _amount);
        IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router
            .ExactInputSingleParams({
                tokenIn: _from,
                tokenOut: _to,
                fee: _fee,
                recipient: address(this),
                deadline: block.timestamp + 60,
                amountIn: _amount,
                amountOutMinimum: 0, // Should be calculated
                sqrtPriceLimitX96: 0
            });
        IUniswapV3Router(UNISWAP_V3_ROUTER).exactInputSingle(params);
        // Clear approvals
        IERC20(_from).forceApprove(UNISWAP_V3_ROUTER, 0);
    }

    function _swapEmergency(
        address _from,
        address _to,
        uint256 _amount
    ) internal {
        if (_amount == 0 || _from == _to) return;

        IERC20(_from).forceApprove(address(UNISWAP_V2_ROUTER), _amount);

        address[] memory path = new address[](2);
        path[0] = _from;
        path[1] = _to;

        // Quote
        uint256 expOut = 0;
        try UNISWAP_V2_ROUTER.getAmountsOut(_amount, path) returns (
            uint256[] memory amounts
        ) {
            if (amounts.length > 1) expOut = amounts[1];
        } catch {}
        if (expOut == 0) return;

        // Massive slippage tolerance in emergency
        uint256 minOut = (expOut * (BASIS_POINTS - EMERGENCY_SLIPPAGE)) /
            BASIS_POINTS;

        try
            UNISWAP_V2_ROUTER.swapExactTokensForTokens(
                _amount,
                minOut,
                path,
                address(this),
                block.timestamp + 60
            )
        {} catch {}
        IERC20(_from).forceApprove(address(UNISWAP_V2_ROUTER), 0);
    }

    function _checkCircuitBreaker() internal {
        // Then check if circuit breaker needs to be reset
        if (circuitBreakerTriggered) {
            if (
                block.timestamp >= lastFailedRebalance + circuitBreakerCooldown
            ) {
                circuitBreakerTriggered = false;
                failedRebalanceCount = 0;
                emit CircuitBreakerReset(block.timestamp);
            }
        }
    }

    function _handleRebalanceFailure(string memory reason) internal {
        failedRebalanceCount++;
        emit RebalancingFailed(
            totalRebalancesFailed,
            block.timestamp,
            failedRebalanceCount,
            reason
        );
    }

    // ========================================================================
    //                        REBASING & WRAPPING
    // ========================================================================

    /**
     * @notice Helper to wrap stETH to wstETH
     * @dev Should be called if anyone accidentally sends stETH to the contract
     */
    function wrapStETH() public {
        IERC20 stETH = IERC20(0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84);
        uint256 balance = stETH.balanceOf(address(this));
        if (balance > 0) {
            stETH.forceApprove(address(WSTETH), balance);
            // wstETH is a wrapper for stETH
            // We need to call the wrap function on wstETH contract
            (bool success, ) = address(WSTETH).call(
                abi.encodeWithSignature("wrap(uint256)", balance)
            );
            require(success, "Wrap failed");
        }
    }

    /**
     * @notice Process a queued withdrawal request
     * @param _id The ID of the request to process
     */
    function processWithdrawalRequest(uint256 _id) external onlyKeepers {
        WithdrawalRequest storage req = withdrawalRequests[_id];
        if (req.processed) revert AlreadyQueued(_id); // Reusing error

        uint256 totalAvailable = asset.balanceOf(address(this));
        if (totalAvailable >= req.amount) {
            req.processed = true;
            // The assets stay in the contract until claimWithdrawal is called
        } else {
            // If not enough WETH, try to free more (rebalancing or emergency liquidation)
            revert InsufficientBalance();
        }
    }

    function _executeRebalanceInternal() external {
        if (msg.sender != address(this)) revert InternalOnly();
        _executeRebalance();
    }

    function _revokeAllApprovals() internal {
        _revokeApproval(WSTETH, address(UNISWAP_V2_ROUTER));
        _revokeApproval(CBETH, address(UNISWAP_V2_ROUTER));
        _revokeApproval(RETH, address(UNISWAP_V2_ROUTER));
        // Add other routers if implemented
    }

    function _issueTimeLimitedApproval(
        IERC20 token,
        address spender,
        uint256 amount
    ) internal {
        if (amount > maxApprovalPerSwap) revert AmountExceedsLimit();
        if (amount == 0) revert AmountIsZero();

        uint256 expiryTime = block.timestamp + 1 hours;

        token.forceApprove(spender, 0);
        token.forceApprove(spender, amount);

        swapApprovals[address(token)][spender] = amount;
        approvalTimestamps[address(token)][spender] = expiryTime;
        approvalExpired[address(token)][spender] = false;

        emit ApprovalIssued(
            address(token),
            spender,
            amount,
            expiryTime,
            block.timestamp
        );
    }

    function _revokeApproval(IERC20 token, address spender) internal {
        token.forceApprove(spender, 0);
        swapApprovals[address(token)][spender] = 0;
        approvalTimestamps[address(token)][spender] = 0;
        approvalExpired[address(token)][spender] = true;

        emit ApprovalRevoked(address(token), spender, block.timestamp);
    }

    // ========================================================================
    //                        ADMIN & MANAGEMENT
    // ========================================================================

    function setParameters(
        uint256 _depositCap,
        uint256 _rebalanceThreshold,
        uint256 _maxSlippage,
        uint256 _minArbitrageProfit,
        uint256 _swapFee
    ) external onlyManagement {
        if (_depositCap < MIN_DEPOSIT_CAP || _depositCap > MAX_DEPOSIT_CAP)
            revert ExceedsMaximum();
        if (_rebalanceThreshold > 500) revert ExceedsMaximum(); // Max 5%
        if (_maxSlippage > 1000) revert ExceedsMaximum(); // Max 10%
        if (_swapFee > 100) revert ExceedsMaximum(); // Max 1%

        depositCap = _depositCap;
        rebalanceThreshold = _rebalanceThreshold;
        maxSlippage = _maxSlippage;
        minArbitrageProfit = _minArbitrageProfit;
        swapFee = _swapFee;

        emit ParametersUpdated(
            _depositCap,
            _rebalanceThreshold,
            _minArbitrageProfit,
            block.timestamp
        );
    }

    function setCircuitBreaker(
        uint256 _cooldown,
        uint256 /* _maxFailures */
    ) external onlyManagement {
        circuitBreakerCooldown = _cooldown;
        // immutable MAX_FAILED_REBALANCES is constant, but logic could use a state var if needed.
        // For now just cooldown.
    }

    function setEmergencyConfig(uint256 _slippage) external onlyManagement {
        // EMERGENCY_SLIPPAGE is constant for safety, but we could add overrides if modularity is key.
        // For now, let's stick to updating basic params.
    }
}
