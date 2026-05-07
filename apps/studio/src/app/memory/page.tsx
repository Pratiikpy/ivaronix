import { Section } from '@/components/Section';
import { MemoryPanel } from '@/components/MemoryPanel';
import { getDeployedAddress } from '@ivaronix/og-chain';
import { getNetwork } from '@/lib/chain';

export const dynamic = 'force-dynamic';

export default function MemoryPage() {
  const capabilityAddr = getDeployedAddress(getNetwork(), 'CapabilityRegistry');
  const memoryAddr = getDeployedAddress(getNetwork(), 'MemoryAccessLog');

  return (
    <Section
      label="§ 01 · MEMORY PERMISSION CENTER"
      title="Grants. Scopes. Audit."
      description={`Issue, list, and revoke memory grants directly on the on-chain CapabilityRegistry. Reads + writes on ${getNetwork()}.`}
    >
      <MemoryPanel
        capabilityAddr={capabilityAddr ?? ''}
        memoryLogAddr={memoryAddr ?? ''}
      />
    </Section>
  );
}
