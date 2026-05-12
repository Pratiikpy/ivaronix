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
  const capabilityAddr = getDeployedAddress(getNetwork(), 'CapabilityRegistry');
  const memoryAddr = getDeployedAddress(getNetwork(), 'MemoryAccessLog');

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
