import { Section } from '@/components/Section';
import { MemoryPanel } from '@/components/MemoryPanel';
import { MemoryNotesPanel } from '@/components/MemoryNotesPanel';
import { getStudioDeployedAddress as getDeployedAddress } from '@/lib/deployments-bundle';
import { getNetwork } from '@/lib/chain';

export const dynamic = 'force-dynamic';

/**
 * /memory — two surfaces stacked:
 *
 *   §01 Quick capture   plaintext per-wallet sandbox; mirrors the CLI's
 *                       `ivaronix memory remember/recall/forget`. The
 *                       full encrypted MemoryEngine ships in
 *                       `packages/memory/` for the CLI path; Studio
 *                       writes plaintext for demoability and discloses
 *                       the trade-off inline (planning-003 §A.4.8).
 *
 *   §02 Permission      on-chain CapabilityRegistry grant admin (read +
 *       Center           write through wagmi). Audit feed of every read
 *                       another agent has performed against this owner's
 *                       scope, sourced from MemoryAccessLog events.
 */
export default function MemoryPage() {
  // V2-first per iter-125. V2 carries the social-graph privacy fix (B-V2-15)
  // for CapabilityRegistry and the log-spoofing fix (B-V2-16) for
  // MemoryAccessLog. Pre-iter-125 every grant issued + every audit row
  // displayed through Studio's /memory went to V1, missing both security
  // upgrades. issueGrant/revokeGrant signatures are identical V1↔V2 so
  // the MemoryPanel client component works against either address.
  // hardcoded-contracts:allow: pinned V1↔V2 fallback for CapabilityRegistry + MemoryAccessLog; the page semantically needs both names spelled out (V2-first lookup + V1 fallback per contract pair).
  const net = getNetwork();
  const capabilityAddr =
    getDeployedAddress(net, 'CapabilityRegistryV2') ??
    getDeployedAddress(net, 'CapabilityRegistry');
  const memoryAddr =
    getDeployedAddress(net, 'MemoryAccessLogV2') ??
    getDeployedAddress(net, 'MemoryAccessLog');

  return (
    <>
      <Section
        label="§ 01 · MEMORY · QUICK CAPTURE"
        title="Remember. Recall. Forget."
        description="Drop notes scoped to project/work/legal/deals/personal. Stored in your per-wallet sandbox. The CLI's ivaronix memory commands give you the same surface with end-to-end encrypted persistence — see the disclosure inside."
      >
        <MemoryNotesPanel />
      </Section>
      <Section
        label="§ 02 · MEMORY · PERMISSION CENTER"
        title="Grants. Scopes. Audit."
        description={`Issue, list, and revoke memory grants directly on the on-chain CapabilityRegistry. Reads + writes on ${getNetwork()}.`}
      >
        <MemoryPanel
          capabilityAddr={capabilityAddr ?? ''}
          memoryLogAddr={memoryAddr ?? ''}
        />
      </Section>
    </>
  );
}
