// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IB20Factory} from "../interfaces/IB20Factory.sol";

/// @title MockB20Factory
/// @notice Hackathon/local-test replacement for Base's B20 Factory precompile.
/// @dev It mirrors the integration surface needed by the MVP: deterministic address preview,
///      B20Created emission, and basic initialized checks. It intentionally does not implement
///      the full Base-native B20 token behavior.
contract MockB20Factory is IB20Factory {
    error TokenAlreadyExists(address token);
    error UnsupportedVariant();

    mapping(address token => bool initialized) public initialized;

    function createB20(B20Variant variant, bytes32 salt, bytes calldata params, bytes[] calldata)
        external
        payable
        returns (address token)
    {
        token = getB20Address(variant, msg.sender, salt);
        if (initialized[token]) revert TokenAlreadyExists(token);
        initialized[token] = true;

        string memory name;
        string memory symbol;
        uint8 decimals;
        bytes memory variantEventParams;

        if (variant == B20Variant.ASSET) {
            B20AssetCreateParams memory p = abi.decode(params, (B20AssetCreateParams));
            name = p.name;
            symbol = p.symbol;
            decimals = p.decimals;
        } else if (variant == B20Variant.STABLECOIN) {
            B20StablecoinCreateParams memory p = abi.decode(params, (B20StablecoinCreateParams));
            name = p.name;
            symbol = p.symbol;
            decimals = 6;
            variantEventParams = abi.encode(p.currency);
        } else {
            revert UnsupportedVariant();
        }

        emit B20Created(token, variant, name, symbol, decimals, variantEventParams);
    }

    function getB20Address(B20Variant variant, address sender, bytes32 salt) public pure returns (address) {
        bytes32 digest = keccak256(abi.encodePacked("MOCK_B20", variant, sender, salt));
        return address(uint160(uint256(digest)));
    }

    function isB20(address token) external view returns (bool) {
        return initialized[token];
    }

    function isB20Initialized(address token) external view returns (bool) {
        return initialized[token];
    }
}
