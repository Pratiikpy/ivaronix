/**
 * FINAL_BUILD_PLAN.md Block I + D-5 · /admin/treasury · admin-only treasury withdraw.
 *
 * SIWE-gated. Connected wallet must match IVARONIX_ADMIN_WALLET env var.
 * Non-admins get a 403 message. Admins see treasury balance + withdraw button.
 */
import type { Metadata } from 'next';
import { Section } from '@/components/Section';
import { AdminTreasuryPanel } from '@/components/AdminTreasuryPanel';
import { getStudioDeployedAddress as getDeployedAddress } from '@/lib/deployments-bundle';
import type { Network } from '@ivaronix/core';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin · Treasury · Ivaronix',
  description: 'Admin-only treasury view — pending balance, lifetime earnings, withdraw flow.',
};

export default function AdminTreasuryPage() {
  const network: Network = (process.env.IVARONIX_NETWORK ?? 'testnet') as Network;
  const paymentAddr = getDeployedAddress(network, 'SkillRunPayment');
  // The admin wallet from env. v1 uses IVARONIX_ADMIN_WALLET (defaults to the
  // operator's signer address when unset, matching the contract's Ownable owner).
  const adminWallet = (
    process.env.IVARONIX_ADMIN_WALLET ?? process.env.IVARONIX_WALLET_ADDRESS ?? process.env.EVM_WALLET_ADDRESS ?? ''
  ).toLowerCase();

  if (!paymentAddr) {
    return (
      <Section label="§ ADMIN / TREASURY" title="Treasury (admin only)">
        <div className="card" style={{ padding: 24 }}>
          <p>SkillRunPayment contract not deployed on {network}.</p>
        </div>
      </Section>
    );
  }

  return (
    <Section
      label="§ ADMIN / TREASURY"
      title="Treasury withdrawal"
      description="Admin-only. The contract's Ownable owner can withdraw accumulated protocol fees."
    >
      <AdminTreasuryPanel paymentAddr={paymentAddr} expectedAdmin={adminWallet} />
    </Section>
  );
}
