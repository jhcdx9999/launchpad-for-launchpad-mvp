// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IB20Factory} from "../interfaces/IB20Factory.sol";

/// @title LaunchpadRegistry
/// @notice MVP registry/router for "launchpad of launchpads".
/// @dev The registry stores trust-critical ownership, fee, and attribution data.
///      Branding and richer configuration stay off-chain and are referenced by metadataURI.
contract LaunchpadRegistry {
    struct Launchpad {
        address owner;
        bytes32 slugHash;
        string metadataURI;
        uint16 additionalFeeBps;
        bool active;
        uint64 createdAt;
    }

    struct TokenAttribution {
        uint256 launchpadId;
        address creator;
        bytes32 salt;
        uint64 createdAt;
    }

    error InvalidOwner();
    error InvalidFee();
    error InvalidLaunchpad();
    error InactiveLaunchpad();
    error SlugAlreadyTaken(bytes32 slugHash);
    error NotLaunchpadOwner();
    error TokenAlreadyAttributed(address token);

    event LaunchpadCreated(
        uint256 indexed launchpadId,
        address indexed owner,
        bytes32 indexed slugHash,
        string metadataURI,
        uint16 additionalFeeBps
    );
    event LaunchpadUpdated(uint256 indexed launchpadId, string metadataURI, uint16 additionalFeeBps, bool active);
    event TokenLaunched(
        uint256 indexed launchpadId,
        address indexed token,
        address indexed creator,
        IB20Factory.B20Variant variant,
        bytes32 salt
    );

    IB20Factory public immutable b20Factory;
    address public immutable platformTreasury;
    uint16 public constant MAX_ADDITIONAL_FEE_BPS = 1_000;

    uint256 public nextLaunchpadId = 1;

    mapping(uint256 launchpadId => Launchpad launchpad) public launchpads;
    mapping(bytes32 slugHash => uint256 launchpadId) public launchpadIdBySlugHash;
    mapping(address token => TokenAttribution attribution) public tokenAttributions;

    constructor(address b20Factory_, address platformTreasury_) {
        if (b20Factory_ == address(0) || platformTreasury_ == address(0)) revert InvalidOwner();
        b20Factory = IB20Factory(b20Factory_);
        platformTreasury = platformTreasury_;
    }

    function createLaunchpad(bytes32 slugHash, string calldata metadataURI, uint16 additionalFeeBps)
        external
        returns (uint256 launchpadId)
    {
        if (additionalFeeBps > MAX_ADDITIONAL_FEE_BPS) revert InvalidFee();
        if (launchpadIdBySlugHash[slugHash] != 0) revert SlugAlreadyTaken(slugHash);

        launchpadId = nextLaunchpadId++;
        launchpads[launchpadId] = Launchpad({
            owner: msg.sender,
            slugHash: slugHash,
            metadataURI: metadataURI,
            additionalFeeBps: additionalFeeBps,
            active: true,
            createdAt: uint64(block.timestamp)
        });
        launchpadIdBySlugHash[slugHash] = launchpadId;

        emit LaunchpadCreated(launchpadId, msg.sender, slugHash, metadataURI, additionalFeeBps);
    }

    function updateLaunchpad(uint256 launchpadId, string calldata metadataURI, uint16 additionalFeeBps, bool active)
        external
    {
        Launchpad storage launchpad = _getLaunchpad(launchpadId);
        if (msg.sender != launchpad.owner) revert NotLaunchpadOwner();
        if (additionalFeeBps > MAX_ADDITIONAL_FEE_BPS) revert InvalidFee();

        launchpad.metadataURI = metadataURI;
        launchpad.additionalFeeBps = additionalFeeBps;
        launchpad.active = active;

        emit LaunchpadUpdated(launchpadId, metadataURI, additionalFeeBps, active);
    }

    /// @notice Launch a B20 token through the Base B20 Factory and attribute it to a custom launchpad.
    /// @dev For the MVP this contract routes the create call and emits attribution.
    ///      A production version can also collect explicit platform fees here if o1's fee path requires it.
    function launchB20Token(
        uint256 launchpadId,
        IB20Factory.B20Variant variant,
        bytes32 salt,
        bytes calldata params,
        bytes[] calldata initCalls
    ) external payable returns (address token) {
        Launchpad storage launchpad = _getLaunchpad(launchpadId);
        if (!launchpad.active) revert InactiveLaunchpad();

        token = b20Factory.createB20{value: msg.value}(variant, salt, params, initCalls);
        if (tokenAttributions[token].launchpadId != 0) revert TokenAlreadyAttributed(token);

        tokenAttributions[token] = TokenAttribution({
            launchpadId: launchpadId,
            creator: msg.sender,
            salt: salt,
            createdAt: uint64(block.timestamp)
        });

        emit TokenLaunched(launchpadId, token, msg.sender, variant, salt);
    }

    function predictB20Address(IB20Factory.B20Variant variant, bytes32 salt) external view returns (address) {
        return b20Factory.getB20Address(variant, address(this), salt);
    }

    function launchpadCount() external view returns (uint256) {
        return nextLaunchpadId - 1;
    }

    function _getLaunchpad(uint256 launchpadId) internal view returns (Launchpad storage launchpad) {
        launchpad = launchpads[launchpadId];
        if (launchpad.owner == address(0)) revert InvalidLaunchpad();
    }
}
