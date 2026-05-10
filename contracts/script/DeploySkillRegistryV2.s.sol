// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {SkillRegistryV2} from "../src/SkillRegistryV2.sol";

/**
 * @notice Deploys SkillRegistryV2 with the 6 first-party skill names
 *         pre-reserved to the operator wallet. Closes WT 20 + planning-003
 *         §A.5.11 (squatter risk fix · reserved-list + arbitration).
 *
 * @dev The reserved list at construction protects canonical first-party
 *      skill names: private-doc-review, github-audit, 0g-integration-auditor,
 *      code-edit, plan-step, content-pitch-review. Each pre-registered to
 *      the operator wallet (deployer) so squatters cannot front-run
 *      legitimate publishes.
 *
 *      Skill ID format: keccak256("skill:<lowercase-name>") per
 *      packages/skills/src/index.ts skillIdFromName.
 *
 * Run on Galileo testnet:
 *   cd contracts
 *   export OG_PRIVATE_KEY=<deployer-key>
 *   forge script script/DeploySkillRegistryV2.s.sol:DeploySkillRegistryV2 \
 *     --rpc-url https://evmrpc-testnet.0g.ai --broadcast --legacy
 *
 * Run on Aristotle mainnet (requires USER_TODO §A-2 funding):
 *   forge script script/DeploySkillRegistryV2.s.sol:DeploySkillRegistryV2 \
 *     --rpc-url https://evmrpc.0g.ai --broadcast --legacy
 *
 * Post-deploy:
 *   1. Add the address to contracts/deployments/{testnet,mainnet}.json under
 *      "SkillRegistryV2". Leave V1 entry untouched.
 *   2. Studio + CLI skill-publishing surfaces query V2 first via the
 *      V2-first read pattern (planning-003 §A.1.3).
 *   3. To reserve additional names post-deploy, call
 *      `reserveSkillName(skillId, owner)` from the contract owner wallet.
 */
contract DeploySkillRegistryV2 is Script {
    function run() external returns (SkillRegistryV2 reg) {
        uint256 deployerKey = vm.envOr("IVARONIX_SIGNER_KEY", vm.envUint("OG_PRIVATE_KEY"));
        address deployer = vm.addr(deployerKey);

        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", block.chainid);

        // Reserved list · 6 first-party skill names pinned to the deployer wallet.
        bytes32[] memory reservedIds = new bytes32[](6);
        reservedIds[0] = keccak256("skill:private-doc-review");
        reservedIds[1] = keccak256("skill:github-audit");
        reservedIds[2] = keccak256("skill:0g-integration-auditor");
        reservedIds[3] = keccak256("skill:code-edit");
        reservedIds[4] = keccak256("skill:plan-step");
        reservedIds[5] = keccak256("skill:content-pitch-review");

        address[] memory reservedOwners = new address[](6);
        for (uint256 i = 0; i < 6; i++) {
            reservedOwners[i] = deployer;
        }

        vm.startBroadcast(deployerKey);
        reg = new SkillRegistryV2(deployer, reservedIds, reservedOwners);
        vm.stopBroadcast();

        console2.log("SkillRegistryV2 deployed at:", address(reg));
        console2.log("Reserved 6 first-party skill IDs to deployer.");
    }
}
