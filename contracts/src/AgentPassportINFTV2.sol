// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Erc7857Verifier} from "./Erc7857Verifier.sol";

/**
 * @notice Minimal ReceiptRegistry view interface for the V2 cross-check.
 * @dev Mirrors ReceiptRegistry.receipts(id) public getter ABI.
 */
interface IReceiptRegistryView {
    function receipts(uint256 id)
        external
        view
        returns (
            bytes32 receiptRoot,
            bytes32 storageRoot,
            bytes32 attestationHash,
            address agentAddress,
            uint64 timestamp,
            uint8 receiptType
        );
    function nextId() external view returns (uint256);
}

/**
 * @title AgentPassportINFTV2
 * @notice ERC-7857 Agent Passport · V2.
 *
 * V2 closes three audit findings from HALF_BAKED.md (round-2 audit, locked
 * 2026-05-10):
 *
 *   K-1 (Critical) · the V1 `recordReceipt` accepted writes from either the
 *        token owner OR an authorized recorder, with no link to a real
 *        ReceiptRegistry row and no bound on `trustScoreDelta`. Owners could
 *        forge unbounded reputation. V2 drops the owner branch entirely:
 *        only `authorizedRecorders` may write, every write must reference a
 *        real receipt id whose `agentAddress` matches the passport owner,
 *        and `trustScoreDelta` is capped to [-100, +100] per call.
 *
 *   K-4 (High) · V1's `iTransferFrom` left every executor authorization
 *        from the previous owner intact after transfer. V2 bumps a per-token
 *        version counter on every transfer; `isAuthorizedExecutor` reads the
 *        current version + the per-version map, so old grants stop matching.
 *
 *   K-6 (Medium) · V1's `mint` performed `_safeMint` BEFORE writing
 *        `passportOf[to]`. A malicious recipient contract could re-enter
 *        from `onERC721Received` and mint a second passport for the same
 *        wallet. V2 sets `passportOf` BEFORE `_safeMint`, AND adds
 *        `nonReentrant` to `mint` for defence in depth.
 *
 * Deployment: V1 stays live for the four existing minted passports (chain
 * history is immutable). V2 is a fresh deployment; new mints land here and
 * `trustScore` resets to 0 for every new passport because V1's self-claimed
 * scores cannot be migrated honestly. Studio renders a `LEGACY-PASSPORT`
 * chip on V1 rows.
 *
 * Threat model:
 *   - Defends against: a passport owner self-minting reputation. Only
 *     authorizedRecorders may write trust deltas, and every write is
 *     bounded ([-100, +100]) AND cross-checked against a real
 *     ReceiptRegistry row whose agentAddress equals the passport owner.
 *   - Defends against: a previous owner's executor grants surviving
 *     transfer. executorVersion bumps on every owner change, so the
 *     per-version map slot rotates and old grants stop matching.
 *   - Defends against: re-entry during mint. passportOf is set BEFORE
 *     _safeMint (CEI ordering) AND the function carries nonReentrant.
 *   - Does NOT defend against: a compromised authorizedRecorder. If
 *     msg.sender holds the recorder role, the per-call cap is the only
 *     gate; over many calls a malicious recorder could grind reputation
 *     up or down. Recorder set is operator-vetted and revocable.
 *   - Does NOT defend against: receiptRegistry.receipts() returning a
 *     forged row. The cross-check assumes the configured registry is
 *     trustworthy; a malicious registry pointer would let any anchored
 *     receipt be claimed against any passport. setReceiptRegistry() is
 *     onlyOwner; default deploys point at the canonical V2 registry.
 *   - Assumed attacker capabilities: any wallet may mint a fresh
 *     passport (intentional · permissionless). The attacker may try to
 *     pass a spoofed receipt id, a recipient contract that re-enters
 *     mint, or transfer-grant tricks. They cannot mint as someone
 *     else (msg.sender == minter) and cannot record reputation without
 *     holding the authorizedRecorder role.
 */
contract AgentPassportINFTV2 is ERC721, Ownable2Step, Pausable, ReentrancyGuard {
    /// @notice Sealed-data integrity verifier (ERC-7857 oracle role)
    Erc7857Verifier public verifier;

    /// @notice ReceiptRegistry the cross-check reads against. Set at deploy time.
    IReceiptRegistryView public receiptRegistry;

    /// @notice One passport per wallet
    mapping(address => uint256) public passportOf;

    /// @notice Authorized contracts that may call recordReceipt() (e.g., a
    ///         deployment of `ReceiptRegistry`'s post-anchor hook)
    mapping(address => bool) public authorizedRecorders;

    struct AgentData {
        bytes32 metadataRoot;
        bytes32 memoryRoot;
        bytes32 skillManifestRoot;
        uint64  receiptCount;
        uint64  violationCount;
        int128  trustScore;
        uint64  mintedAt;
        uint64  lastEvolutionAt;
    }

    mapping(uint256 => AgentData) public agents;

    /// @notice Per-token executor-authorization version counter.
    ///         Bumped on every transfer; old grants compare against the prior
    ///         version and are silently invalidated. This defends against a
    ///         seller granting an executor pre-transfer and that grant
    ///         remaining valid against the new owner's passport.
    mapping(uint256 => uint64) public executorVersion;

    /// @notice tokenId => version => executor => expiry timestamp.
    mapping(uint256 => mapping(uint64 => mapping(address => uint64))) public executorAuthorizations;

    uint256 public nextTokenId = 1;

    /// @notice Hard cap on per-call trustScore delta. Either sign.
    ///         Bounds the maximum reputation impact an authorized recorder
    ///         can apply per receipt so a compromised recorder cannot fast-
    ///         elevate (or fast-burn) any passport in a single call.
    int128 public constant MAX_TRUST_DELTA = 100;

    // ─── Events ──────────────────────────────────────────────────────────
    event PassportMinted(uint256 indexed tokenId, address indexed owner, bytes32 metadataRoot);
    event ReceiptRecorded(
        uint256 indexed tokenId,
        bytes32 indexed receiptRoot,
        uint256 indexed receiptId,
        uint8 receiptType,
        int128 trustScoreDelta
    );
    event MemoryRootUpdated(uint256 indexed tokenId, bytes32 oldRoot, bytes32 newRoot);
    event SkillManifestRootUpdated(uint256 indexed tokenId, bytes32 oldRoot, bytes32 newRoot);
    event MetadataRotated(uint256 indexed tokenId, bytes32 oldRoot, bytes32 newRoot);
    event ExecutorAuthorized(uint256 indexed tokenId, uint64 indexed version, address indexed executor, uint64 expiresAt);
    event ExecutorRevoked(uint256 indexed tokenId, uint64 indexed version, address indexed executor);
    event AuthorizedRecorderAdded(address indexed recorder);
    event AuthorizedRecorderRemoved(address indexed recorder);
    event ViolationRecorded(uint256 indexed tokenId, uint256 indexed receiptId, int128 trustScoreDelta, string reason);
    event ExecutorVersionBumped(uint256 indexed tokenId, uint64 newVersion);

    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner,
        address verifierAddress,
        address receiptRegistryAddress
    ) ERC721(name_, symbol_) Ownable(initialOwner) {
        require(verifierAddress != address(0), "AgentPassportINFTV2: zero verifier");
        require(receiptRegistryAddress != address(0), "AgentPassportINFTV2: zero receipt registry");
        verifier = Erc7857Verifier(verifierAddress);
        receiptRegistry = IReceiptRegistryView(receiptRegistryAddress);
    }

    // ─── Mint (CEI ordering · re-entry safe) ─────────────────────────────
    function mint(bytes32 metadataRoot) external whenNotPaused nonReentrant returns (uint256 tokenId) {
        require(passportOf[msg.sender] == 0, "AgentPassportINFTV2: wallet already has a passport");
        require(metadataRoot != bytes32(0), "AgentPassportINFTV2: empty metadataRoot");

        tokenId = nextTokenId++;

        // CEI ordering: write passportOf BEFORE _safeMint so a re-entering
        // recipient cannot pass the `passportOf[to] == 0` check twice. The
        // nonReentrant modifier alone is not sufficient — _safeMint can call
        // out via onERC721Received before any state effects we'd otherwise
        // place after it.
        passportOf[msg.sender] = tokenId;

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

        executorVersion[tokenId] = 1;

        _safeMint(msg.sender, tokenId);

        emit PassportMinted(tokenId, msg.sender, metadataRoot);
    }

    // ─── Reputation (bounded delta + receipt cross-check) ───────────────
    /**
     * @notice Record an Action Receipt against the passport. Authorized
     *         recorders only. Cross-checks the receipt id on the configured
     *         ReceiptRegistry; the registry row's agentAddress must match the
     *         passport owner. Per-call trustScoreDelta is bounded.
     */
    function recordReceipt(
        uint256 tokenId,
        uint256 receiptId,
        bytes32 expectedReceiptRoot,
        uint8 expectedReceiptType,
        int128 trustScoreDelta
    ) external whenNotPaused {
        require(authorizedRecorders[msg.sender], "AgentPassportINFTV2: only authorized recorder");
        address owner = _ownerOf(tokenId);
        require(owner != address(0), "AgentPassportINFTV2: token does not exist");
        require(
            trustScoreDelta >= -MAX_TRUST_DELTA && trustScoreDelta <= MAX_TRUST_DELTA,
            "AgentPassportINFTV2: trustScoreDelta out of range"
        );

        // Cross-check: the receipt id must exist and reference the passport's owner.
        require(receiptId < receiptRegistry.nextId(), "AgentPassportINFTV2: receipt id out of range");
        (bytes32 root, , , address agent, , uint8 typ) = receiptRegistry.receipts(receiptId);
        require(root == expectedReceiptRoot, "AgentPassportINFTV2: receiptRoot mismatch");
        require(typ == expectedReceiptType, "AgentPassportINFTV2: receiptType mismatch");
        require(agent == owner, "AgentPassportINFTV2: receipt agent does not match passport owner");

        AgentData storage a = agents[tokenId];
        a.receiptCount += 1;
        a.trustScore += trustScoreDelta;
        a.lastEvolutionAt = uint64(block.timestamp);

        emit ReceiptRecorded(tokenId, root, receiptId, typ, trustScoreDelta);
    }

    /**
     * @notice Record a policy violation. Authorized recorders only; cross-check
     *         the receipt id, bound the negative delta.
     */
    function recordViolation(
        uint256 tokenId,
        uint256 receiptId,
        bytes32 expectedReceiptRoot,
        int128 trustScoreDelta,
        string calldata reason
    ) external whenNotPaused {
        require(authorizedRecorders[msg.sender], "AgentPassportINFTV2: only authorized recorder");
        address owner = _ownerOf(tokenId);
        require(owner != address(0), "AgentPassportINFTV2: token does not exist");
        require(trustScoreDelta < 0, "AgentPassportINFTV2: violations must be negative");
        require(trustScoreDelta >= -MAX_TRUST_DELTA, "AgentPassportINFTV2: trustScoreDelta out of range");

        require(receiptId < receiptRegistry.nextId(), "AgentPassportINFTV2: receipt id out of range");
        (bytes32 root, , , address agent, , ) = receiptRegistry.receipts(receiptId);
        require(root == expectedReceiptRoot, "AgentPassportINFTV2: receiptRoot mismatch");
        require(agent == owner, "AgentPassportINFTV2: receipt agent does not match passport owner");

        AgentData storage a = agents[tokenId];
        a.violationCount += 1;
        a.trustScore += trustScoreDelta;
        a.lastEvolutionAt = uint64(block.timestamp);

        emit ViolationRecorded(tokenId, receiptId, trustScoreDelta, reason);
    }

    // ─── State updates ───────────────────────────────────────────────────
    function updateMemoryRoot(uint256 tokenId, bytes32 newRoot) external {
        require(msg.sender == _ownerOf(tokenId), "AgentPassportINFTV2: not owner");
        bytes32 oldRoot = agents[tokenId].memoryRoot;
        agents[tokenId].memoryRoot = newRoot;
        agents[tokenId].lastEvolutionAt = uint64(block.timestamp);
        emit MemoryRootUpdated(tokenId, oldRoot, newRoot);
    }

    function updateSkillManifestRoot(uint256 tokenId, bytes32 newRoot) external {
        require(msg.sender == _ownerOf(tokenId), "AgentPassportINFTV2: not owner");
        bytes32 oldRoot = agents[tokenId].skillManifestRoot;
        agents[tokenId].skillManifestRoot = newRoot;
        agents[tokenId].lastEvolutionAt = uint64(block.timestamp);
        emit SkillManifestRootUpdated(tokenId, oldRoot, newRoot);
    }

    function rotateMetadata(uint256 tokenId, bytes32 newRoot) external {
        require(msg.sender == _ownerOf(tokenId), "AgentPassportINFTV2: not owner");
        require(newRoot != bytes32(0), "AgentPassportINFTV2: empty newRoot");
        bytes32 oldRoot = agents[tokenId].metadataRoot;
        agents[tokenId].metadataRoot = newRoot;
        agents[tokenId].lastEvolutionAt = uint64(block.timestamp);
        emit MetadataRotated(tokenId, oldRoot, newRoot);
    }

    // ─── Authorized executors (per-version slot · transfer-invalidates) ─
    function authorizeExecutor(uint256 tokenId, address executor, uint64 ttlSeconds) external {
        require(msg.sender == _ownerOf(tokenId), "AgentPassportINFTV2: not owner");
        require(executor != address(0), "AgentPassportINFTV2: zero executor");
        uint64 expiresAt = uint64(block.timestamp) + ttlSeconds;
        uint64 v = executorVersion[tokenId];
        executorAuthorizations[tokenId][v][executor] = expiresAt;
        emit ExecutorAuthorized(tokenId, v, executor, expiresAt);
    }

    function revokeExecutor(uint256 tokenId, address executor) external {
        require(msg.sender == _ownerOf(tokenId), "AgentPassportINFTV2: not owner");
        uint64 v = executorVersion[tokenId];
        delete executorAuthorizations[tokenId][v][executor];
        emit ExecutorRevoked(tokenId, v, executor);
    }

    /**
     * @notice True iff `executor` is currently authorized for `tokenId`.
     *         Reads the CURRENT version slot — on transfer the version bumps,
     *         so prior owners' grants stop matching.
     */
    function isAuthorizedExecutor(uint256 tokenId, address executor) external view returns (bool) {
        uint64 v = executorVersion[tokenId];
        uint64 expiresAt = executorAuthorizations[tokenId][v][executor];
        return expiresAt != 0 && expiresAt > block.timestamp;
    }

    // ─── ERC-7857 secure transfer (also bumps executor version via _update)
    function iTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes32 newMetadataRoot,
        bytes32 nonce,
        bytes calldata attestorSignature
    ) external whenNotPaused {
        require(msg.sender == from || isApprovedForAll(from, msg.sender) || _isAuthorized(from, msg.sender, tokenId),
            "AgentPassportINFTV2: not approved");
        require(passportOf[to] == 0, "AgentPassportINFTV2: recipient already has a passport");

        bool ok = verifier.verifyDataIntegrity(to, newMetadataRoot, nonce, attestorSignature);
        require(ok, "AgentPassportINFTV2: integrity verification failed");

        _transfer(from, to, tokenId);

        bytes32 oldRoot = agents[tokenId].metadataRoot;
        agents[tokenId].metadataRoot = newMetadataRoot;
        agents[tokenId].lastEvolutionAt = uint64(block.timestamp);
        emit MetadataRotated(tokenId, oldRoot, newMetadataRoot);

        delete passportOf[from];
        passportOf[to] = tokenId;
    }

    // ─── Authorized recorders ────────────────────────────────────────────
    function addAuthorizedRecorder(address recorder) external onlyOwner {
        require(recorder != address(0), "AgentPassportINFTV2: zero recorder");
        authorizedRecorders[recorder] = true;
        emit AuthorizedRecorderAdded(recorder);
    }

    function removeAuthorizedRecorder(address recorder) external onlyOwner {
        authorizedRecorders[recorder] = false;
        emit AuthorizedRecorderRemoved(recorder);
    }

    /// @notice Allow the owner to swap the configured ReceiptRegistry (used
    ///         once if the registry is itself redeployed; otherwise pin once).
    function setReceiptRegistry(address newRegistry) external onlyOwner {
        require(newRegistry != address(0), "AgentPassportINFTV2: zero registry");
        receiptRegistry = IReceiptRegistryView(newRegistry);
    }

    // ─── Pausable ────────────────────────────────────────────────────────
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─── ERC-721 internal hook ───────────────────────────────────────────
    /**
     * @dev Bumps `executorVersion` on every owner-changing transfer so prior
     *      owners' grants stop matching. Also keeps `passportOf` in sync
     *      without breaking the mint-time CEI ordering invariant (the mint
     *      path writes passportOf BEFORE _safeMint to defeat re-entry; this
     *      hook only fires on real transfers, never on mint, because mint
     *      passes `from == address(0)`).
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        if (from != address(0) && to != address(0) && from != to) {
            require(passportOf[to] == 0, "AgentPassportINFTV2: recipient already has a passport");
            delete passportOf[from];
            passportOf[to] = tokenId;
            // Bump executor-authorization version on every real owner change
            // so prior owners' grants stop matching the current version slot.
            executorVersion[tokenId] += 1;
            emit ExecutorVersionBumped(tokenId, executorVersion[tokenId]);
        }
    }
}
