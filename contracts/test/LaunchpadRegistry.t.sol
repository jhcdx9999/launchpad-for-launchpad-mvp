// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IB20Factory} from "../src/interfaces/IB20Factory.sol";
import {LaunchpadFactory} from "../src/contracts/LaunchpadFactory.sol";
import {LaunchpadInstance} from "../src/contracts/LaunchpadInstance.sol";
import {LaunchpadRegistry} from "../src/contracts/LaunchpadRegistry.sol";
import {MockB20Factory} from "../src/contracts/MockB20Factory.sol";

contract LaunchpadRegistryTest is Test {
    MockB20Factory internal b20Factory;
    LaunchpadRegistry internal registry;

    address internal creator = address(0xA11CE);
    address internal treasury = address(0xFEE);

    function setUp() public {
        b20Factory = new MockB20Factory();
        registry = new LaunchpadRegistry(address(b20Factory), treasury);
    }

    function testCreateLaunchpad() public {
        vm.prank(creator);
        uint256 id = registry.createLaunchpad(keccak256("ai"), "ipfs://launchpads/ai", 50);

        (
            address owner,
            bytes32 slugHash,
            string memory metadataURI,
            uint16 additionalFeeBps,
            bool active,
        ) = registry.launchpads(id);

        assertEq(owner, creator);
        assertEq(slugHash, keccak256("ai"));
        assertEq(metadataURI, "ipfs://launchpads/ai");
        assertEq(additionalFeeBps, 50);
        assertTrue(active);
    }

    function testLaunchB20TokenEmitsAttribution() public {
        vm.startPrank(creator);
        uint256 id = registry.createLaunchpad(keccak256("ai"), "ipfs://launchpads/ai", 50);

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

        address predicted = registry.predictB20Address(IB20Factory.B20Variant.ASSET, salt);
        address token = registry.launchB20Token(id, IB20Factory.B20Variant.ASSET, salt, params, new bytes[](0));
        vm.stopPrank();

        assertEq(token, predicted);
        assertTrue(b20Factory.isB20Initialized(token));

        (uint256 launchpadId, address tokenCreator, bytes32 tokenSalt,) = registry.tokenAttributions(token);
        assertEq(launchpadId, id);
        assertEq(tokenCreator, creator);
        assertEq(tokenSalt, salt);
    }

    function testOnlyOwnerCanUpdateLaunchpad() public {
        vm.prank(creator);
        uint256 id = registry.createLaunchpad(keccak256("rwa"), "ipfs://launchpads/rwa", 75);

        vm.expectRevert(LaunchpadRegistry.NotLaunchpadOwner.selector);
        registry.updateLaunchpad(id, "ipfs://launchpads/rwa-v2", 100, true);
    }

    function testFactoryCreatesDedicatedLaunchpadInstance() public {
        LaunchpadFactory factory = new LaunchpadFactory(address(b20Factory), treasury);

        vm.prank(creator);
        (uint256 id, address instance) = factory.createLaunchpad(keccak256("ai"), "ipfs://launchpads/ai", 50);

        assertEq(id, 1);
        assertEq(LaunchpadInstance(instance).owner(), creator);
        assertEq(LaunchpadInstance(instance).launchpadId(), id);
        assertEq(LaunchpadInstance(instance).slugHash(), keccak256("ai"));
    }
}
