// AssemblyScript event handlers for MemoryAccessLogV2 contract.
// FINAL_BUILD_PLAN.md Block O · Goldsky subgraph.
//
// MemoryAccessLogV2 enforces msg.sender == agent for self-logs and
// cross-checks the CapabilityRegistryV2 grant for grant-backed logs.
// This handler trusts the contract's enforcement and just indexes the
// emitted event so the dashboard surface can show "who read what when."

import { MemoryAccessed as MemoryAccessedEvent } from '../generated/MemoryAccessLogV2/MemoryAccessLog';
import { MemoryAccess } from '../generated/schema';

export function handleMemoryAccessed(event: MemoryAccessedEvent): void {
  const accessId = event.transaction.hash.toHex() + '-' + event.logIndex.toString();
  const access = new MemoryAccess(accessId);
  access.agent = event.params.agent;
  access.grantId = event.params.grantId;
  access.kind = event.params.kind;
  access.ts = event.params.timestamp;
  access.txHash = event.transaction.hash;
  access.save();
}
