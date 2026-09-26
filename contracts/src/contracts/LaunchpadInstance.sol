// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IB20Factory} from "../interfaces/IB20Factory.sol";

/// @title LaunchpadInstance
/// @notice Dedicated contract for a single custom launchpad.
/// @dev Created by LaunchpadFactory. It owns launchpad-specific routing and token attribution.
contract LaunchpadInstance {
    error NotOwner();
    error InactiveLaunchpad();
    error InvalidFee();
    error TokenAlreadyAttributed(address token);

    event LaunchpadConfigUpdated(string metadataURI, uint16 additionalFeeBps, bool active);
    event TokenLaunched(
        uint256 indexed launchpadId,
        address indexed token,
        address indexed creator,
        IB20Factory.B20Variant variant,
        bytes32 salt
    );

    IB20Factory public immutable b20Factory;
    address public immutable owner;
    uint256 public immutable launchpadId;
    bytes32 public immutable slugHash;

    string public metadataURI;
    uint16 public additionalFeeBps;
    bool public active = true;

    mapping(address token => bool attributed) public isTokenAttributed;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(
        address b20Factory_,
        address owner_,
        uint256 launchpadId_,
        bytes32 slugHash_,
        string memory metadataURI_,
        uint16 additionalFeeBps_
    ) {
        if (additionalFeeBps_ > 1_000) revert InvalidFee();
        b20Factory = IB20Factory(b20Factory_);
        owner = owner_;
        launchpadId = launchpadId_;
        slugHash = slugHash_;
        metadataURI = metadataURI_;
        additionalFeeBps = additionalFeeBps_;
    }

    function updateConfig(string calldata metadataURI_, uint16 additionalFeeBps_, bool active_) external onlyOwner {
        if (additionalFeeBps_ > 1_000) revert InvalidFee();
        metadataURI = metadataURI_;
        additionalFeeBps = additionalFeeBps_;
        active = active_;

        emit LaunchpadConfigUpdated(metadataURI_, additionalFeeBps_, active_);
    }

    function launchB20Token(
        IB20Factory.B20Variant variant,
        bytes32 salt,
        bytes calldata params,
        bytes[] calldata initCalls
    ) external payable returns (address token) {
        if (!active) revert InactiveLaunchpad();

        token = b20Factory.createB20{value: msg.value}(variant, salt, params, initCalls);
        if (isTokenAttributed[token]) revert TokenAlreadyAttributed(token);
        isTokenAttributed[token] = true;

        emit TokenLaunched(launchpadId, token, msg.sender, variant, salt);
    }

    function predictB20Address(IB20Factory.B20Variant variant, bytes32 salt) external view returns (address) {
        return b20Factory.getB20Address(variant, address(this), salt);
    }
}
