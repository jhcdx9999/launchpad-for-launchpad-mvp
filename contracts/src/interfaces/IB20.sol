// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IB20 {
    function updateSupplyCap(uint256 newSupplyCap) external;

    function updateContractURI(string calldata newURI) external;

    function grantRole(bytes32 role, address account) external;

    function updatePolicy(bytes32 policyScope, uint64 newPolicyId) external;
}
