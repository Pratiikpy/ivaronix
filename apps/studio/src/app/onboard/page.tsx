import type { Metadata } from 'next';
import { OnboardClient } from './OnboardClient';
import { getStudioDeployedAddress as getDeployedAddress } from '@/lib/deployments-bundle';
import { getNetwork } from '@/lib/chain';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Onboard · Ivaronix',
  description: 'Mint an ERC-7857 passport, run a first paid skill, see the receipt anchor on 0G — guided in 60 seconds.',
};

export default function OnboardPage() {
  const net = getNetwork();
  // V2-first mint target so new passports land on AgentPassportINFTV2
  // (post-K-1) and only fall back to V1 when V2 is not yet deployed on
  // the target network. Mint signature `mint(bytes32) → uint256` is
  // identical on both, so the OnboardClient ABI is forward-compatible.
  // Closes WT 51 (planning-003 §A.1.3).
  const passportAddr =
    getDeployedAddress(net, 'AgentPassportINFTV2') ??
    getDeployedAddress(net, 'AgentPassportINFT');

  return (
    <section
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '64px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span className="section-label">§ ONBOARD · WALLET → PASSPORT → RECEIPT</span>
        <h1 style={{ fontSize: 56, lineHeight: 1.05, margin: 0, letterSpacing: '-0.5px' }}>
          From wallet to <span className="italic-display">your first receipt.</span>
        </h1>
        <p style={{ fontSize: 17, color: 'var(--color-muted)', margin: 0 }}>
          By the end: one signed AI receipt anchored on 0G {net === 'testnet' ? 'Galileo Testnet' : 'Aristotle Mainnet'},
          with a public Proof URL you can share.
        </p>
      </header>

      <OnboardClient passportAddr={passportAddr} network={net} />
    </section>
  );
}
