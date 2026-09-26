// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IB20Asset {
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) external;

    function updateExtraMetadata(string calldata key, string calldata value) external;
}
