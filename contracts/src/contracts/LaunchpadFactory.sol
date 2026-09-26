// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {LaunchpadInstance} from "./LaunchpadInstance.sol";

/// @title LaunchpadFactory
/// @notice Creates one dedicated launchpad contract per custom launchpad.
contract LaunchpadFactory {
    struct LaunchpadRecord {
        address owner;
        address instance;
        bytes32 slugHash;
        string metadataURI;
        uint16 additionalFeeBps;
        bool active;
        uint64 createdAt;
    }

    error InvalidOwner();
    error InvalidFee();
    error SlugAlreadyTaken(bytes32 slugHash);
    error InvalidLaunchpad();
    error NotLaunchpadOwner();

    event LaunchpadCreated(
        uint256 indexed launchpadId,
        address indexed owner,
        address indexed instance,
        bytes32 slugHash,
        string metadataURI,
        uint16 additionalFeeBps
    );
    event LaunchpadUpdated(
        uint256 indexed launchpadId,
        address indexed instance,
        string metadataURI,
        uint16 additionalFeeBps,
        bool active
    );

    address public immutable b20Factory;
    address public immutable platformTreasury;
    uint16 public constant MAX_ADDITIONAL_FEE_BPS = 1_000;

    uint256 public nextLaunchpadId = 1;

    mapping(uint256 launchpadId => LaunchpadRecord record) public launchpads;
    mapping(bytes32 slugHash => uint256 launchpadId) public launchpadIdBySlugHash;

    constructor(address b20Factory_, address platformTreasury_) {
        if (b20Factory_ == address(0) || platformTreasury_ == address(0)) revert InvalidOwner();
        b20Factory = b20Factory_;
        platformTreasury = platformTreasury_;
    }

    function createLaunchpad(bytes32 slugHash, string calldata metadataURI, uint16 additionalFeeBps)
        external
        returns (uint256 launchpadId, address instance)
    {
        if (additionalFeeBps > MAX_ADDITIONAL_FEE_BPS) revert InvalidFee();
        if (launchpadIdBySlugHash[slugHash] != 0) revert SlugAlreadyTaken(slugHash);

        launchpadId = nextLaunchpadId++;
        instance = address(
            new LaunchpadInstance(b20Factory, msg.sender, launchpadId, slugHash, metadataURI, additionalFeeBps)
        );

        launchpads[launchpadId] = LaunchpadRecord({
            owner: msg.sender,
            instance: instance,
            slugHash: slugHash,
            metadataURI: metadataURI,
            additionalFeeBps: additionalFeeBps,
            active: true,
            createdAt: uint64(block.timestamp)
        });
        launchpadIdBySlugHash[slugHash] = launchpadId;

        emit LaunchpadCreated(launchpadId, msg.sender, instance, slugHash, metadataURI, additionalFeeBps);
    }

    function updateLaunchpad(uint256 launchpadId, string calldata metadataURI, uint16 additionalFeeBps, bool active)
        external
    {
        LaunchpadRecord storage record = launchpads[launchpadId];
        if (record.owner == address(0)) revert InvalidLaunchpad();
        if (msg.sender != record.owner) revert NotLaunchpadOwner();
        if (additionalFeeBps > MAX_ADDITIONAL_FEE_BPS) revert InvalidFee();

        record.metadataURI = metadataURI;
        record.additionalFeeBps = additionalFeeBps;
        record.active = active;

        LaunchpadInstance(record.instance).updateConfig(metadataURI, additionalFeeBps, active);
        emit LaunchpadUpdated(launchpadId, record.instance, metadataURI, additionalFeeBps, active);
    }

    function launchpadCount() external view returns (uint256) {
        return nextLaunchpadId - 1;
    }
}
