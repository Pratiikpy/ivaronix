/**
 * Client-safe ABI fragments. These are duplicated from `@ivaronix/og-chain`
 * because that package's barrel re-exports `deployments.ts` which uses
 * `node:fs` / `node:path` — fine on the server, but Next's webpack edge bundle
 * cannot resolve them when imported into a 'use client' component.
 *
 * Keep these in sync with the canonical ABIs in
 * `packages/og-chain/src/contracts/*.ts`.
 */

export const CAPABILITY_REGISTRY_ABI = [
  'function issueGrant(address grantee, bytes32 scopeHash, uint64 ttlSeconds, uint32 readsCap) external returns (bytes32)',
  'function revokeGrant(bytes32 grantId) external',
  'function consumeRead(bytes32 grantId) external returns (bool)',
  'function isValid(bytes32 grantId, address grantee, bytes32 scopeHash) external view returns (bool)',
  'function grants(bytes32 grantId) external view returns (address owner, address grantee, bytes32 scopeHash, uint64 issuedAt, uint64 expiresAt, uint32 readsRemaining, bool revoked)',
  'function listGrantsByOwner(address owner) external view returns (bytes32[])',
  'function listGrantsByGrantee(address grantee) external view returns (bytes32[])',
  'event GrantIssued(bytes32 indexed grantId, address indexed owner, address indexed grantee, bytes32 scopeHash, uint64 expiresAt, uint32 readsCap)',
  'event GrantRevoked(bytes32 indexed grantId, address indexed owner)',
  'event GrantConsumed(bytes32 indexed grantId, uint32 readsRemaining)',
] as const;

export const MEMORY_ACCESS_LOG_ABI = [
  'function logAccess(address agent, bytes32 grantId, bytes32 memoryRoot, uint8 accessType, bytes32 scopeHash) external',
  'event MemoryAccessed(address indexed agent, bytes32 indexed grantId, bytes32 indexed memoryRoot, uint8 accessType, uint64 timestamp, bytes32 scopeHash)',
] as const;
