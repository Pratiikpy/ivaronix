/**
 * FINAL_BUILD_PLAN.md Block I · publish-and-price form.
 *
 * Client component. Walks 2 wagmi txs (publish + setPrice) sequentially.
 */
'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { parseAbi, keccak256, toBytes } from 'viem';
import { useRouter } from 'next/navigation';
import { GALILEO_GAS_PARAMS } from '@/lib/client-abis';

interface Props {
  registryAddr: string;
  pricingAddr: string;
}

const REGISTRY_ABI = parseAbi([
  'function publishVersion(bytes32 skillId, bytes32 versionId, bytes32 manifestHash)',
]);
const PRICING_ABI = parseAbi([
  'function setPrice(bytes32 skillId, uint256 priceWei, uint16 creatorBps, uint16 treasuryBps)',
]);

type FlowState =
  | { kind: 'idle' }
  | { kind: 'publishing' }
  | { kind: 'pricing'; publishTx: string }
  | { kind: 'success'; publishTx: string; pricingTx: string; skillId: string }
  | { kind: 'error'; message: string };

export function NewSkillForm({ registryAddr, pricingAddr }: Props) {
  const { isConnected } = useAccount();
  const router = useRouter();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [slug, setSlug] = useState('my-skill');
  const [version, setVersion] = useState('1.0.0');
  const [description, setDescription] = useState('A custom paid skill.');
  const [priceOg, setPriceOg] = useState('0.001');
  const [creatorBps, setCreatorBps] = useState(9000);
  const [state, setState] = useState<FlowState>({ kind: 'idle' });

  const treasuryBps = 10000 - creatorBps;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      setState({ kind: 'error', message: 'Connect your wallet first.' });
      return;
    }

    try {
      // Compute skillId + versionId + manifestHash
      const skillId = keccak256(toBytes(`skill:${slug}`));
      const versionId = keccak256(toBytes(version));
      // For v1, manifestHash is a simple sha256 of a JSON blob. v1.1 uploads to 0G Storage.
      const manifestBody = JSON.stringify({ name: slug, version, description });
      const manifestHash = keccak256(toBytes(manifestBody));

      // 1. Publish to registry
      setState({ kind: 'publishing' });
      const publishTx = await writeContractAsync({
        address: registryAddr as `0x${string}`,
        abi: REGISTRY_ABI,
        functionName: 'publishVersion',
        args: [skillId, versionId, manifestHash],
        ...GALILEO_GAS_PARAMS,
      });

      // Wait for publish tx to confirm on chain (replaces v1 setTimeout hack).
      if (!publicClient) {
        setState({ kind: 'error', message: 'Public client unavailable. Refresh and try again.' });
        return;
      }
      const publishReceipt = await publicClient.waitForTransactionReceipt({ hash: publishTx as `0x${string}`, timeout: 60_000 });
      if (publishReceipt.status !== 'success') {
        setState({ kind: 'error', message: `Publish tx reverted on chain. Hash: ${publishTx}` });
        return;
      }

      // 2. Set price
      setState({ kind: 'pricing', publishTx });
      const priceWei = BigInt(Math.round(parseFloat(priceOg) * 1e18));
      const pricingTx = await writeContractAsync({
        address: pricingAddr as `0x${string}`,
        abi: PRICING_ABI,
        functionName: 'setPrice',
        args: [skillId, priceWei, creatorBps, treasuryBps],
        ...GALILEO_GAS_PARAMS,
      });

      setState({ kind: 'success', publishTx, pricingTx, skillId });
      setTimeout(() => router.push(`/marketplace/${encodeURIComponent(skillId)}`), 2000);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.toLowerCase().includes('user rejected')) {
        setState({ kind: 'error', message: 'Wallet popup rejected. No charge.' });
      } else if (msg.toLowerCase().includes('already published')) {
        setState({ kind: 'error', message: 'A skill with that slug already exists. Pick another.' });
      } else {
        setState({ kind: 'error', message: msg });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Skill slug</label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
          required
          pattern="[a-z0-9-]+"
          style={{ width: '100%', padding: 8, fontSize: 14, border: '1px solid var(--color-rule)', borderRadius: 4 }}
        />
        <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>Lowercase, hyphen-separated. Used as <code>skillId = keccak256("skill:{slug}")</code>.</p>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Version</label>
        <input
          type="text"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          required
          pattern="\d+\.\d+\.\d+"
          style={{ width: '100%', padding: 8, fontSize: 14, border: '1px solid var(--color-rule)', borderRadius: 4 }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={2}
          style={{ width: '100%', padding: 8, fontSize: 14, border: '1px solid var(--color-rule)', borderRadius: 4 }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Price (OG per run)</label>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={priceOg}
            onChange={(e) => setPriceOg(e.target.value)}
            required
            style={{ width: '100%', padding: 8, fontSize: 14, border: '1px solid var(--color-rule)', borderRadius: 4 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Creator share (bps)</label>
          <input
            type="number"
            min="5000"
            max="9500"
            step="100"
            value={creatorBps}
            onChange={(e) => setCreatorBps(parseInt(e.target.value, 10))}
            required
            style={{ width: '100%', padding: 8, fontSize: 14, border: '1px solid var(--color-rule)', borderRadius: 4 }}
          />
          <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
            {creatorBps / 100}% creator · {treasuryBps / 100}% treasury (min 50% / max 95% creator)
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={!isConnected || (state.kind !== 'idle' && state.kind !== 'error')}
        style={{
          padding: '12px 24px',
          fontSize: 15,
          fontWeight: 600,
          background: state.kind === 'success' ? 'var(--color-verified-bg)' : 'var(--color-ink, #0A0A0A)',
          color: state.kind === 'success' ? '#166534' : 'var(--color-paper, #FAFAF7)',
          border: '1px solid var(--color-rule)',
          borderRadius: 6,
          cursor: !isConnected ? 'not-allowed' : 'pointer',
          opacity: !isConnected ? 0.5 : 1,
        }}
      >
        {state.kind === 'idle' && 'Publish + price (2 transactions) →'}
        {state.kind === 'publishing' && '1/2 Publishing to registry…'}
        {state.kind === 'pricing' && '2/2 Setting price…'}
        {state.kind === 'success' && '✓ Published! Opening skill page…'}
        {state.kind === 'error' && 'Try again'}
      </button>

      {!isConnected && (
        <p style={{ fontSize: 13, opacity: 0.7 }}>Connect your wallet (top right) to enable.</p>
      )}

      {state.kind === 'error' && (
        <div style={{ padding: 12, background: 'var(--color-pending-bg)', border: '1px solid var(--color-pending)', borderRadius: 4, fontSize: 13 }}>
          <strong>Error</strong><br />
          {state.message}
        </div>
      )}

      {state.kind === 'success' && (
        <div style={{ fontSize: 13 }}>
          <p>✓ Publish tx: <code style={{ fontSize: 11 }}>{state.publishTx}</code></p>
          <p>✓ Pricing tx: <code style={{ fontSize: 11 }}>{state.pricingTx}</code></p>
          <p>Skill id: <code style={{ fontSize: 11 }}>{state.skillId}</code></p>
        </div>
      )}
    </form>
  );
}
