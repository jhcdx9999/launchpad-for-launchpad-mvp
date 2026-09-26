// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IB20Factory {
    enum B20Variant {
        ASSET,
        STABLECOIN
    }

    struct B20AssetCreateParams {
        uint8 version;
        string name;
        string symbol;
        address initialAdmin;
        uint8 decimals;
    }

    struct B20StablecoinCreateParams {
        uint8 version;
        string name;
        string symbol;
        address initialAdmin;
        string currency;
    }

    event B20Created(
        address indexed token,
        B20Variant indexed variant,
        string name,
        string symbol,
        uint8 decimals,
        bytes variantEventParams
    );

    function createB20(B20Variant variant, bytes32 salt, bytes calldata params, bytes[] calldata initCalls)
        external
        payable
        returns (address token);

    function getB20Address(B20Variant variant, address sender, bytes32 salt) external view returns (address);

    function isB20(address token) external view returns (bool);

    function isB20Initialized(address token) external view returns (bool);
}
