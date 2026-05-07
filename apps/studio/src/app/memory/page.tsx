import { Section } from '@/components/Section';

export default function MemoryPage() {
  return (
    <Section
      label="§ 01 · MEMORY PERMISSION CENTER"
      title="Grants, scopes, audit."
      description="The on-chain CapabilityRegistry already issues TTL-bounded grants. The web UI for issuing + revoking grants ships Day 17. CLI: 'ivaronix memory grant <grantee> --scope project --ttl 7d'."
    />
  );
}
