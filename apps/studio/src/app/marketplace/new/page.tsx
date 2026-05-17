/**
 * FINAL_BUILD_PLAN.md Block I · /marketplace/new · publish + price a skill.
 *
 * Creator-facing route. Form fields: skill slug + manifest fields + price + bps split.
 * On submit:
 *   1. wagmi.writeContract: SkillRegistryV2.publishVersion(skillId, versionId, manifestRoot)
 *   2. wagmi.writeContract: SkillPricing.setPrice(skillId, priceWei, creatorBps, treasuryBps)
 *   3. Redirect to /marketplace/<skillId>
 *
 * For v1 the manifestRoot is computed from a simple `manifest.json` upload
 * (sha256). v1.1 adds 0G Storage upload for the full manifest body.
 */
import type { Metadata } from 'next';
import { Section } from '@/components/Section';
import { NewSkillForm } from '@/components/NewSkillForm';
import { getStudioDeployedAddress as getDeployedAddress } from '@/lib/deployments-bundle';
import type { Network } from '@ivaronix/core';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Publish a skill · Ivaronix marketplace',
  description: 'Publish + price a skill on SkillRegistryV2 + SkillPricing — set creator/treasury bps split.',
};

export default function NewSkillPage() {
  const network: Network = (process.env.IVARONIX_NETWORK ?? 'testnet') as Network;
  const registryAddr = getDeployedAddress(network, 'SkillRegistryV2');
  const pricingAddr = getDeployedAddress(network, 'SkillPricing');

  if (!registryAddr || !pricingAddr) {
    return (
      <Section label="§ MARKETPLACE / NEW" title="Publish a skill">
        <div className="card" style={{ padding: 24 }}>
          <p>SkillRegistryV2 or SkillPricing not deployed on {network}.</p>
          <p>Run the deploy scripts in <code>contracts/script/</code>.</p>
        </div>
      </Section>
    );
  }

  return (
    <Section
      label="§ MARKETPLACE / NEW"
      title="Publish a paid skill"
      description="Set your skill's price + creator/treasury split. Each run pays your wallet directly."
    >
      <NewSkillForm
        registryAddr={registryAddr}
        pricingAddr={pricingAddr}
      />

      <div style={{ marginTop: 32, padding: 16, fontSize: 13, opacity: 0.7 }}>
        <p><strong>Two transactions:</strong></p>
        <ol style={{ paddingLeft: 20 }}>
          <li><code>SkillRegistryV2.publishVersion</code> — registers your skill name + version + manifest root</li>
          <li><code>SkillPricing.setPrice</code> — sets the OG price + creator/treasury bps split</li>
        </ol>
        <p style={{ marginTop: 8 }}>
          You're charged ~0.0001 OG total in gas. After both confirm, the skill appears in <a href="/marketplace">/marketplace</a> within ~1 block.
        </p>
      </div>
    </Section>
  );
}
