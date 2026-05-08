/**
 * Client-safe ABI fragments. These are duplicated from `@ivaronix/og-chain`
 * because that package's barrel re-exports `deployments.ts` which uses
 * `node:fs` / `node:path` — fine on the server, but Next's webpack edge bundle
 * cannot resolve them when imported into a 'use client' component.
 *
 * IMPORTANT: wagmi v2 + viem 2.x require ABI as a parsed `Abi` object array,
 * NOT a human-readable string array. `parseAbi(['function ...'])` does the
 * conversion at module-load time. Without it, useReadContract / useWriteContract
 * silently return undefined and the UI looks like the chain is empty —
 * exactly the symptom of B19-1 in MemoryPanel.
 *
 * Keep these in sync with the canonical ABIs in
 * `packages/og-chain/src/contracts/*.ts`.
 */

import { parseAbi } from 'viem';

export const CAPABILITY_REGISTRY_ABI = parseAbi([
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
]);

export const MEMORY_ACCESS_LOG_ABI = parseAbi([
  'function logAccess(address agent, bytes32 grantId, bytes32 memoryRoot, uint8 accessType, bytes32 scopeHash) external',
  'event MemoryAccessed(address indexed agent, bytes32 indexed grantId, bytes32 indexed memoryRoot, uint8 accessType, uint64 timestamp, bytes32 scopeHash)',
]);
