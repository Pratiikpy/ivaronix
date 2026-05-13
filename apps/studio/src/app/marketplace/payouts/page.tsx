/**
 * FINAL_BUILD_PLAN.md Block I · /marketplace/payouts · creator withdrawal dashboard.
 *
 * Server component reads on-chain creatorBalance + creatorLifetimeEarned.
 * Client island shows Withdraw button (wagmi.writeContract withdrawCreator).
 */
import { Section } from '@/components/Section';
import { CreatorPayoutsPanel } from '@/components/CreatorPayoutsPanel';
import { getStudioDeployedAddress as getDeployedAddress } from '@/lib/deployments-bundle';
import type { Network } from '@ivaronix/core';

export const dynamic = 'force-dynamic';

export default function PayoutsPage() {
  const network: Network = (process.env.IVARONIX_NETWORK ?? 'testnet') as Network;
  const paymentAddr = getDeployedAddress(network, 'SkillRunPayment');

  if (!paymentAddr) {
    return (
      <Section label="§ MARKETPLACE / PAYOUTS" title="Creator payouts">
        <div className="card" style={{ padding: 24 }}>
          <p>SkillRunPayment contract not deployed on {network}.</p>
        </div>
      </Section>
    );
  }

  return (
    <Section
      label="§ MARKETPLACE / PAYOUTS"
      title="Your creator earnings"
      description="Withdraw your accumulated balance to your connected wallet. Lifetime earnings are monotonic — they never decrement on withdrawal."
    >
      <CreatorPayoutsPanel paymentAddr={paymentAddr} />
    </Section>
  );
}
