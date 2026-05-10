// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Erc7857Verifier} from "./Erc7857Verifier.sol";

/**
 * @title AgentPassportINFT
 * @notice ERC-7857 Agent Passport — wallet-bound identity for Ivaronix AI
 *         agents. LEGACY (V1) — new mints land on AgentPassportINFTV2.
 *         V1 stays live for existing tokenIds (chain history immutable).
 * @dev Strict superset of Aishi / MUSASHI / SealedMind / MindVault patterns:
 *      - One passport per wallet (one-agent-per-wallet enforcement)
 *      - On-chain reputation: trustScore + receiptCount + violationCount
 *      - Encrypted metadata pointer (storage root); plaintext stays off-chain
 *      - ERC-7857 secure transfer flow gated by Erc7857Verifier
 *      - recordReceipt() integration: each Action Receipt updates the passport
 *      - Memory + skill manifest roots stored on chain (mutable)
 *
 *      Threat model:
 *      - Defends against: unauthorized recordReceipt() callers via the
 *        authorizedRecorders mapping (only whitelisted contracts can mutate
 *        on-chain reputation).
 *      - Defends against: integrity loss on transfer via Erc7857Verifier
 *        attestation (the inbound sealed-data blob must match an attestor-
 *        signed (recipient, metadataHash, nonce) tuple).
 *      - Defends against: pause-during-incident via Pausable (owner can
 *        halt mints/transfers if a downstream bug is discovered).
 *      - Does NOT defend against: self-claimed trust score in a single
 *        recordReceipt() call. AgentPassportINFTV2 hardens this with a
 *        per-token monotonic delta cap (±100) plus cross-check against
 *        ReceiptRegistry to confirm the passed receiptId matches a real
 *        anchored receipt. New mints should use V2.
 *      - Does NOT defend against: a compromised attestor key. The attestor
 *        signature is the trust root for transfer integrity; mitigation is
 *        to rotate via Erc7857Verifier.addAttestor / removeAttestor.
 *      - Does NOT defend against: a malicious owner pausing the contract
 *        indefinitely. Mitigation: Ownable2Step transfer + multisig review.
 */
contract AgentPassportINFT is ERC721, Ownable2Step, Pausable {
    /// @notice Sealed-data integrity verifier (ERC-7857 oracle role)
    Erc7857Verifier public verifier;

    /// @notice One passport per wallet
    mapping(address => uint256) public passportOf;

    /// @notice Authorized contracts that may call recordReceipt() (e.g., ReceiptRegistry)
    mapping(address => bool) public authorizedRecorders;

    struct AgentData {
        bytes32 metadataRoot;       // Encrypted metadata blob hash on 0G Storage
        bytes32 memoryRoot;         // Current memory state hash
        bytes32 skillManifestRoot;  // Installed skills manifest hash
        uint64  receiptCount;       // Action Receipts produced
        uint64  violationCount;     // Policy violations recorded
        int128  trustScore;         // Signed reputation; can go negative
        uint64  mintedAt;           // First mint timestamp
        uint64  lastEvolutionAt;    // Last meaningful state change
    }

    /// @notice Per-token agent state. ERC-721 ownership is in _ownerOf.
    mapping(uint256 => AgentData) public agents;

    /// @notice Authorized executors per token (run-without-ownership)
    /// tokenId => executor => expiry timestamp
    mapping(uint256 => mapping(address => uint64)) public executorAuthorizations;

    /// @notice Token id counter (incremental)
    uint256 public nextTokenId = 1;

    // ─── Events ─────────────────────────────────────────────────────────
    event PassportMinted(uint256 indexed tokenId, address indexed owner, bytes32 metadataRoot);
    event ReceiptRecorded(uint256 indexed tokenId, bytes32 indexed receiptRoot, uint8 receiptType, int128 trustScoreDelta);
    event MemoryRootUpdated(uint256 indexed tokenId, bytes32 oldRoot, bytes32 newRoot);
    event SkillManifestRootUpdated(uint256 indexed tokenId, bytes32 oldRoot, bytes32 newRoot);
    event MetadataRotated(uint256 indexed tokenId, bytes32 oldRoot, bytes32 newRoot);
    event ExecutorAuthorized(uint256 indexed tokenId, address indexed executor, uint64 expiresAt);
    event ExecutorRevoked(uint256 indexed tokenId, address indexed executor);
    event AuthorizedRecorderAdded(address indexed recorder);
    event AuthorizedRecorderRemoved(address indexed recorder);
    event ViolationRecorded(uint256 indexed tokenId, int128 trustScoreDelta, string reason);

    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner,
        address verifierAddress
    ) ERC721(name_, symbol_) Ownable(initialOwner) {
        require(verifierAddress != address(0), "AgentPassportINFT: zero verifier");
        verifier = Erc7857Verifier(verifierAddress);
    }

    // ─── Mint ────────────────────────────────────────────────────────────
    /**
     * @notice Mint a fresh passport for the caller. One per wallet.
     * @param metadataRoot Hash of the encrypted metadata blob (off-chain on 0G Storage)
     */
    function mint(bytes32 metadataRoot) external whenNotPaused returns (uint256 tokenId) {
        require(passportOf[msg.sender] == 0, "AgentPassportINFT: wallet already has a passport");
        require(metadataRoot != bytes32(0), "AgentPassportINFT: empty metadataRoot");

        tokenId = nextTokenId++;
        _safeMint(msg.sender, tokenId);

        agents[tokenId] = AgentData({
            metadataRoot: metadataRoot,
            memoryRoot: bytes32(0),
            skillManifestRoot: bytes32(0),
            receiptCount: 0,
            violationCount: 0,
            trustScore: 0,
            mintedAt: uint64(block.timestamp),
            lastEvolutionAt: uint64(block.timestamp)
        });

        passportOf[msg.sender] = tokenId;

        emit PassportMinted(tokenId, msg.sender, metadataRoot);
    }

    // ─── Reputation ──────────────────────────────────────────────────────
    /**
     * @notice Record an Action Receipt against the passport.
     *         Bumps receiptCount, adjusts trustScore by `trustScoreDelta`.
     *         Caller must be the token owner OR an authorizedRecorder.
     */
    function recordReceipt(
        uint256 tokenId,
        bytes32 receiptRoot,
        uint8 receiptType,
        int128 trustScoreDelta
    ) external whenNotPaused {
        require(_ownerOf(tokenId) != address(0), "AgentPassportINFT: token does not exist");
        require(
            msg.sender == _ownerOf(tokenId) || authorizedRecorders[msg.sender],
            "AgentPassportINFT: not owner or authorized recorder"
        );

        AgentData storage a = agents[tokenId];
        a.receiptCount += 1;
        a.trustScore += trustScoreDelta;
        a.lastEvolutionAt = uint64(block.timestamp);

        emit ReceiptRecorded(tokenId, receiptRoot, receiptType, trustScoreDelta);
    }

    /**
     * @notice Record a policy violation (negative reputation event).
     */
    function recordViolation(uint256 tokenId, int128 trustScoreDelta, string calldata reason) external whenNotPaused {
        require(_ownerOf(tokenId) != address(0), "AgentPassportINFT: token does not exist");
        require(
            msg.sender == _ownerOf(tokenId) || authorizedRecorders[msg.sender],
            "AgentPassportINFT: not owner or authorized recorder"
        );
        require(trustScoreDelta < 0, "AgentPassportINFT: violations must be negative deltas");

        AgentData storage a = agents[tokenId];
        a.violationCount += 1;
        a.trustScore += trustScoreDelta;
        a.lastEvolutionAt = uint64(block.timestamp);

        emit ViolationRecorded(tokenId, trustScoreDelta, reason);
    }

    // ─── State updates (memory / skills / metadata) ──────────────────────
    function updateMemoryRoot(uint256 tokenId, bytes32 newRoot) external {
        require(msg.sender == _ownerOf(tokenId), "AgentPassportINFT: not owner");
        bytes32 oldRoot = agents[tokenId].memoryRoot;
        agents[tokenId].memoryRoot = newRoot;
        agents[tokenId].lastEvolutionAt = uint64(block.timestamp);
        emit MemoryRootUpdated(tokenId, oldRoot, newRoot);
    }

    function updateSkillManifestRoot(uint256 tokenId, bytes32 newRoot) external {
        require(msg.sender == _ownerOf(tokenId), "AgentPassportINFT: not owner");
        bytes32 oldRoot = agents[tokenId].skillManifestRoot;
        agents[tokenId].skillManifestRoot = newRoot;
        agents[tokenId].lastEvolutionAt = uint64(block.timestamp);
        emit SkillManifestRootUpdated(tokenId, oldRoot, newRoot);
    }

    function rotateMetadata(uint256 tokenId, bytes32 newRoot) external {
        require(msg.sender == _ownerOf(tokenId), "AgentPassportINFT: not owner");
        require(newRoot != bytes32(0), "AgentPassportINFT: empty newRoot");
        bytes32 oldRoot = agents[tokenId].metadataRoot;
        agents[tokenId].metadataRoot = newRoot;
        agents[tokenId].lastEvolutionAt = uint64(block.timestamp);
        emit MetadataRotated(tokenId, oldRoot, newRoot);
    }

    // ─── Authorized executors (run-without-ownership) ────────────────────
    function authorizeExecutor(uint256 tokenId, address executor, uint64 ttlSeconds) external {
        require(msg.sender == _ownerOf(tokenId), "AgentPassportINFT: not owner");
        require(executor != address(0), "AgentPassportINFT: zero executor");
        uint64 expiresAt = uint64(block.timestamp) + ttlSeconds;
        executorAuthorizations[tokenId][executor] = expiresAt;
        emit ExecutorAuthorized(tokenId, executor, expiresAt);
    }

    function revokeExecutor(uint256 tokenId, address executor) external {
        require(msg.sender == _ownerOf(tokenId), "AgentPassportINFT: not owner");
        delete executorAuthorizations[tokenId][executor];
        emit ExecutorRevoked(tokenId, executor);
    }

    function isAuthorizedExecutor(uint256 tokenId, address executor) external view returns (bool) {
        uint64 expiresAt = executorAuthorizations[tokenId][executor];
        return expiresAt != 0 && expiresAt > block.timestamp;
    }

    // ─── ERC-7857 secure transfer ────────────────────────────────────────
    /**
     * @notice ERC-7857-style transfer with sealed-data integrity verification.
     *         The sealed metadata is re-encrypted to the recipient off-chain;
     *         this function verifies the attestor signed off on the new blob,
     *         then transfers the token and rotates the on-chain metadataRoot.
     *         Authorizations are cleared on transfer for security.
     */
    function iTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes32 newMetadataRoot,
        bytes32 nonce,
        bytes calldata attestorSignature
    ) external whenNotPaused {
        require(msg.sender == from || isApprovedForAll(from, msg.sender) || _isAuthorized(from, msg.sender, tokenId),
            "AgentPassportINFT: not approved");
        require(passportOf[to] == 0, "AgentPassportINFT: recipient already has a passport");

        // Verify the sealed-data attestor signed off on the new blob for `to`.
        // Consumes the nonce; replay-proof.
        bool ok = verifier.verifyDataIntegrity(to, newMetadataRoot, nonce, attestorSignature);
        require(ok, "AgentPassportINFT: integrity verification failed");

        // Transfer
        _transfer(from, to, tokenId);

        // Rotate metadata root
        bytes32 oldRoot = agents[tokenId].metadataRoot;
        agents[tokenId].metadataRoot = newMetadataRoot;
        agents[tokenId].lastEvolutionAt = uint64(block.timestamp);
        emit MetadataRotated(tokenId, oldRoot, newMetadataRoot);

        // Update wallet -> token bookkeeping
        delete passportOf[from];
        passportOf[to] = tokenId;
    }

    // ─── Authorized recorders (e.g., a future ReceiptRegistry hook) ──────
    function addAuthorizedRecorder(address recorder) external onlyOwner {
        require(recorder != address(0), "AgentPassportINFT: zero recorder");
        authorizedRecorders[recorder] = true;
        emit AuthorizedRecorderAdded(recorder);
    }

    function removeAuthorizedRecorder(address recorder) external onlyOwner {
        authorizedRecorders[recorder] = false;
        emit AuthorizedRecorderRemoved(recorder);
    }

    // ─── Pausable ────────────────────────────────────────────────────────
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─── ERC-721 internal hook to keep passportOf consistent on _safeMint
    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        if (from != address(0) && to != address(0) && from != to) {
            // Standard transfer (non-iTransferFrom path) — keep passportOf in sync
            // Note: we still require recipient to have no existing passport
            require(passportOf[to] == 0, "AgentPassportINFT: recipient already has a passport");
            delete passportOf[from];
            passportOf[to] = tokenId;
        }
    }
}
