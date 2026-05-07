// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title Erc7857Verifier
 * @notice Verifies sealed-data integrity for Ivaronix Agent Passports per ERC-7857.
 * @dev Day 6 MVP ships an attestor-signed verifier: an oracle (the deployer for now)
 *      signs metadataHash + recipient + nonce attestations off-chain. On transfer,
 *      AgentPassportINFT calls verifyDataIntegrity() to confirm the new sealed-data
 *      blob matches the attestation. Future work (Phase B+) will swap this attestor
 *      for a TEE-backed remote attestation or ZKP verifier per ERC-7857 §integration.
 */
contract Erc7857Verifier is Ownable2Step {
    /// @notice Authorized attestors that may sign integrity attestations.
    mapping(address => bool) public attestors;

    /// @notice Replay protection: each (recipient, metadataHash, nonce) can only be used once.
    mapping(bytes32 => bool) public usedNonces;

    event AttestorAdded(address indexed attestor);
    event AttestorRemoved(address indexed attestor);
    event DataIntegrityVerified(
        address indexed recipient,
        bytes32 indexed metadataHash,
        bytes32 indexed nonce
    );

    constructor(address initialOwner) Ownable(initialOwner) {
        attestors[initialOwner] = true;
        emit AttestorAdded(initialOwner);
    }

    function addAttestor(address attestor) external onlyOwner {
        require(attestor != address(0), "Erc7857Verifier: zero address");
        attestors[attestor] = true;
        emit AttestorAdded(attestor);
    }

    function removeAttestor(address attestor) external onlyOwner {
        attestors[attestor] = false;
        emit AttestorRemoved(attestor);
    }

    /**
     * @notice Verify the integrity of a sealed-data blob via an attestor signature.
     * @param recipient The address that will receive the sealed-data agent
     * @param metadataHash 32-byte hash of the ENCRYPTED metadata blob
     * @param nonce Unique nonce to prevent replay across transfers
     * @param signature Attestor's ECDSA signature over (recipient, metadataHash, nonce, address(this), block.chainid)
     * @return true if the signature is valid and the (recipient, metadataHash, nonce) tuple is fresh
     */
    function verifyDataIntegrity(
        address recipient,
        bytes32 metadataHash,
        bytes32 nonce,
        bytes calldata signature
    ) external returns (bool) {
        bytes32 nonceKey = keccak256(abi.encodePacked(recipient, metadataHash, nonce));
        require(!usedNonces[nonceKey], "Erc7857Verifier: nonce reused");

        bytes32 message = keccak256(abi.encodePacked(
            recipient,
            metadataHash,
            nonce,
            address(this),
            block.chainid
        ));
        // EIP-191 prefix
        bytes32 ethSigned = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            message
        ));

        address signer = _recover(ethSigned, signature);
        require(attestors[signer], "Erc7857Verifier: bad attestor");

        usedNonces[nonceKey] = true;
        emit DataIntegrityVerified(recipient, metadataHash, nonce);
        return true;
    }

    /**
     * @notice View-only attestation check: does NOT consume the nonce.
     *         Useful for off-chain pre-checks before submitting a transfer.
     */
    function isAttestationValid(
        address recipient,
        bytes32 metadataHash,
        bytes32 nonce,
        bytes calldata signature
    ) external view returns (bool) {
        bytes32 nonceKey = keccak256(abi.encodePacked(recipient, metadataHash, nonce));
        if (usedNonces[nonceKey]) return false;

        bytes32 message = keccak256(abi.encodePacked(
            recipient,
            metadataHash,
            nonce,
            address(this),
            block.chainid
        ));
        bytes32 ethSigned = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            message
        ));

        address signer = _recover(ethSigned, signature);
        return attestors[signer];
    }

    function _recover(bytes32 hash, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);
        return ecrecover(hash, v, r, s);
    }
}
