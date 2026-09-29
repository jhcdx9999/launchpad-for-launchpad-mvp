// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IB20Factory} from "../src/interfaces/IB20Factory.sol";
import {LaunchpadFactory} from "../src/contracts/LaunchpadFactory.sol";
import {LaunchpadInstance} from "../src/contracts/LaunchpadInstance.sol";
import {MockB20Factory} from "../src/contracts/MockB20Factory.sol";

contract LaunchpadFactoryTest is Test {
    MockB20Factory internal b20Factory;
    LaunchpadFactory internal factory;

    address internal creator = address(0xA11CE);
    address internal treasury = address(0xFEE);

    function setUp() public {
        b20Factory = new MockB20Factory();
        factory = new LaunchpadFactory(address(b20Factory), treasury);
    }

    function testFactoryCreatesDedicatedLaunchpadInstance() public {
        vm.prank(creator);
        (uint256 id, address instance) = factory.createLaunchpad(keccak256("ai"), "ipfs://launchpads/ai", 50);

        assertEq(id, 1);
        assertEq(LaunchpadInstance(instance).owner(), creator);
        assertEq(LaunchpadInstance(instance).launchpadId(), id);
        assertEq(LaunchpadInstance(instance).slugHash(), keccak256("ai"));
    }

    function testLaunchpadInstanceLaunchesB20AndEmitsAttribution() public {
        vm.prank(creator);
        (uint256 id, address instanceAddress) = factory.createLaunchpad(keccak256("ai"), "ipfs://launchpads/ai", 50);
        LaunchpadInstance instance = LaunchpadInstance(instanceAddress);

        bytes32 salt = keccak256("token-1");
        bytes memory params = abi.encode(
            IB20Factory.B20AssetCreateParams({
                version: 1,
                name: "AI Index",
                symbol: "AIDX",
                initialAdmin: creator,
                decimals: 18
            })
        );

        vm.prank(creator);
        address token = instance.launchB20Token(IB20Factory.B20Variant.ASSET, salt, params, new bytes[](0));

        assertEq(instance.launchpadId(), id);
        assertTrue(instance.isTokenAttributed(token));
        assertTrue(b20Factory.isB20Initialized(token));
    }

    function testOnlyOwnerCanUpdateLaunchpadConfig() public {
        vm.prank(creator);
        (uint256 id,) = factory.createLaunchpad(keccak256("rwa"), "ipfs://launchpads/rwa", 75);

        vm.expectRevert(LaunchpadFactory.NotLaunchpadOwner.selector);
        factory.updateLaunchpad(id, "ipfs://launchpads/rwa-v2", 100, true);
    }
}
