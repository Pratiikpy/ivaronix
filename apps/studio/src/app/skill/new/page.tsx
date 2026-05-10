'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
// Direct import from /manifest avoids the @ivaronix/skills barrel
// which re-exports loader.ts (uses node:fs / node:crypto / node:path).
// Webpack cannot bundle node: scheme imports for client components,
// so the barrel breaks `next build`. Sweep 67 fix.
import {
  MemoryAccessEnum,
  ShellAccessEnum,
  ConsensusTierEnum,
  type MemoryAccess,
  type ShellAccess,
  type ConsensusTier,
} from '@ivaronix/skills/manifest';

/**
 * Visual skill creator. Form-driven SKILL.md generator: a non-developer
 * creator picks fields (name, system prompt, tier default, fee split,
 * permissions) and the page composes a real manifest. One click writes
 * it to `.ivaronix/skills/<id>/SKILL.md` via /api/skill/save.
 *
 * Schema-as-source-of-truth: the dropdown options for `memory_access` and
 * `shell_access` are derived from the canonical Zod schema in
 * `@ivaronix/skills/manifest`, NOT redeclared here. Any drift between
 * form and schema would surface immediately in the type system and the
 * `verify-a11-form-schema-parity` regression script.
 *
 * Honest scope:
 * - Local save is shipped — the skill becomes immediately runnable via
 *   `ivaronix doc ask <doc> "..." --skill <id>`.
 * - On-chain publishing (SkillRegistry mint) is a separate step. The form
 *   surfaces the `ivaronix skill publish <id>` CLI command so the user's
 *   signing key stays out of the operator path.
 */

// Derived from the canonical Zod schema. Updating the schema
// automatically updates the form (no manual edit required).
const TIER_OPTIONS = ConsensusTierEnum.options;
const MEMORY_OPTIONS = MemoryAccessEnum.options;
const SHELL_OPTIONS = ShellAccessEnum.options;

const LICENSE_OPTIONS = ['Apache-2.0', 'MIT', 'GPL-3.0'] as const;

interface SkillForm {
  name: string;
  version: string;
  description: string;
  license: typeof LICENSE_OPTIONS[number];
  systemPrompt: string;
  defaultTier: ConsensusTier;
  burnAutoEnable: boolean;
  consensusRequired: boolean;
  memoryAccess: MemoryAccess;
  walletAccess: boolean;
  writesFiles: boolean;
  shellAccess: ShellAccess;
  passportMinTrust: number;
  creatorBps: number; // 0..10000
}

const DEFAULT_FORM: SkillForm = {
  name: 'my-skill',
  version: '0.1.0',
  description: 'Describe what this skill does in one clear sentence.',
  license: 'Apache-2.0',
  systemPrompt: 'You are a specialist. State what the skill should do, what it should output, and the format of the answer.',
  defaultTier: 'quick',
  burnAutoEnable: false,
  consensusRequired: false,
  memoryAccess: 'project_only',
  walletAccess: false,
  writesFiles: false,
  shellAccess: 'none',
  passportMinTrust: 0,
  creatorBps: 9000,
};

function buildManifest(f: SkillForm, creatorPassport: string | null): string {
  const treasuryBps = 10000 - f.creatorBps;
  const creator = creatorPassport
    ? `  creator:\n    passport: "${creatorPassport}"\n    fee_split:\n      creator: ${f.creatorBps}\n      treasury: ${treasuryBps}`
    : `  creator:\n    fee_split:\n      creator: ${f.creatorBps}\n      treasury: ${treasuryBps}`;

  return `---
name: ${f.name}
version: ${f.version}
description: ${f.description}
license: ${f.license}
entrypoint: prompt.md
og:
  permissions:
    memory_access: ${f.memoryAccess}
    wallet_access: ${f.walletAccess}
    writes_files: ${f.writesFiles}
    shell_access: ${f.shellAccess}
    receipt_required: true
    compute_tee_required: true
    passport_min_trust: ${f.passportMinTrust}
  consensus:
    required: ${f.consensusRequired}
    default_tier: ${f.defaultTier}
  burn:
    auto_enable: ${f.burnAutoEnable}
${creator}
---

# ${f.name}

${f.systemPrompt}
`;
}

export default function SkillNewPage() {
  const { address } = useAccount();
  const [form, setForm] = useState<SkillForm>(DEFAULT_FORM);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [savedPath, setSavedPath] = useState<string | null>(null);

  const creatorPassport = address ? `did:0g:passport:${address}:1` : null;
  const manifest = useMemo(() => buildManifest(form, creatorPassport), [form, creatorPassport]);

  const treasuryBps = 10000 - form.creatorBps;

  function update<K extends keyof SkillForm>(key: K, value: SkillForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSave() {
    setSaveStatus('saving');
    setSaveMessage('');
    try {
      const res = await fetch('/api/skill/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ skillId: form.name, manifest }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setSaveStatus('saved');
      setSavedPath(json.path);
    } catch (err) {
      setSaveStatus('error');
      setSaveMessage((err as Error).message.slice(0, 200));
    }
  }

  return (
    <article style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 32px 96px' }}>
      <div className="section-label" style={{ marginBottom: 16 }}>
        Skill builder
      </div>
      <h1 style={{ fontSize: 48, lineHeight: 1.05, letterSpacing: '-1px', fontWeight: 700, margin: 0, marginBottom: 16 }}>
        Compose a skill <span className="italic-display" style={{ fontWeight: 400 }}>without writing TypeScript.</span>
      </h1>
      <p style={{ fontSize: 16, color: 'var(--color-muted)', margin: '0 0 32px', maxWidth: 760, lineHeight: 1.55 }}>
        Pick a system prompt, set the permissions, choose a default tier and fee split, and the page composes a
        real <code className="mono">SKILL.md</code> manifest. Save it locally to make the skill immediately runnable
        from the CLI.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 32 }} className="skill-builder-grid">
        {/* FORM */}
        <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="section-label">configure</div>

          <Field label="skill id (slug)" hint="lowercase, dash-separated. matches the directory name.">
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              style={inputStyle}
            />
          </Field>

          <Field label="version" hint="semver. bump when the prompt changes.">
            <input
              type="text"
              value={form.version}
              onChange={(e) => update('version', e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="description" hint="one sentence. shows up on the /skills page.">
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              style={textareaStyle}
            />
          </Field>

          <Field label="system prompt" hint="the body of SKILL.md. tells the model exactly what to do.">
            <textarea
              rows={6}
              value={form.systemPrompt}
              onChange={(e) => update('systemPrompt', e.target.value)}
              style={textareaStyle}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="license">
              <select value={form.license} onChange={(e) => update('license', e.target.value as SkillForm['license'])} style={inputStyle}>
                {LICENSE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="default tier">
              <select value={form.defaultTier} onChange={(e) => update('defaultTier', e.target.value as SkillForm['defaultTier'])} style={inputStyle}>
                {TIER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="memory access">
              <select value={form.memoryAccess} onChange={(e) => update('memoryAccess', e.target.value as SkillForm['memoryAccess'])} style={inputStyle}>
                {MEMORY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="shell access">
              <select value={form.shellAccess} onChange={(e) => update('shellAccess', e.target.value as SkillForm['shellAccess'])} style={inputStyle}>
                {SHELL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
          </div>

          <Field label="permissions">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={form.burnAutoEnable} onChange={(e) => update('burnAutoEnable', e.target.checked)} />
                Auto-enable Burn Mode (AES-256-GCM, key destroyed after run)
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={form.consensusRequired} onChange={(e) => update('consensusRequired', e.target.checked)} />
                Require consensus (skill cannot run in quick tier)
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={form.walletAccess} onChange={(e) => update('walletAccess', e.target.checked)} />
                Wallet access (skill can read connected wallet)
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={form.writesFiles} onChange={(e) => update('writesFiles', e.target.checked)} />
                Writes files (skill can create/edit local files)
              </label>
            </div>
          </Field>

          <Field label="passport min trust" hint="agents below this trust score cannot run the skill.">
            <input
              type="number"
              min={0}
              value={form.passportMinTrust}
              onChange={(e) => update('passportMinTrust', Math.max(0, Number(e.target.value)))}
              style={inputStyle}
            />
          </Field>

          <Field label={`fee split · creator ${form.creatorBps / 100}% / treasury ${treasuryBps / 100}%`} hint="every receipt anchored by this skill splits the fee accordingly.">
            <input
              type="range"
              min={0}
              max={10000}
              step={500}
              value={form.creatorBps}
              onChange={(e) => update('creatorBps', Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </Field>

          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-muted)' }}>
            creator passport ·{' '}
            <code className="mono">
              {creatorPassport ?? '(connect wallet to attach passport)'}
            </code>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            <button onClick={onSave} disabled={saveStatus === 'saving'} className="btn-primary" style={{ cursor: saveStatus === 'saving' ? 'wait' : 'pointer' }}>
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved ✓' : 'Save manifest locally'}
            </button>
            <Link href="/skills" className="btn-secondary" style={{ textDecoration: 'none' }}>
              Browse existing skills →
            </Link>
          </div>
          {saveStatus === 'saved' && savedPath && (
            <div style={{ fontSize: 12, color: 'var(--color-verified, #166534)', marginTop: 8 }}>
              Saved to <code className="mono">{savedPath}</code>. Run it now:{' '}
              <code className="mono">ivaronix doc ask &lt;file&gt; "..." --skill {form.name}</code>
            </div>
          )}
          {saveStatus === 'error' && (
            <div style={{ fontSize: 12, color: 'var(--color-mismatch, #991b1b)', marginTop: 8 }}>
              {saveMessage || 'save failed'}
            </div>
          )}

          <p style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 16, lineHeight: 1.5 }}>
            Publishing on-chain to <code className="mono">SkillRegistry</code> uses the connected wallet, not the
            operator. Run <code className="mono">ivaronix skill publish {form.name}</code> from your terminal after
            saving — the CLI signs the publish tx with your local key and prints the chainscan link. Wallet-side
            signing through this form via wagmi is queued (USER_TODO §B-V2).
          </p>
        </div>

        {/* PREVIEW */}
        <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="section-label">live preview · SKILL.md</div>
            <span style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
              {manifest.length.toLocaleString()} chars
            </span>
          </div>
          <pre
            style={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-sm)',
              padding: 16,
              fontSize: 12,
              lineHeight: 1.5,
              fontFamily: 'var(--font-mono)',
              overflow: 'auto',
              margin: 0,
              maxHeight: '70vh',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {manifest}
          </pre>
        </div>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .skill-builder-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </article>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 500 }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11, color: 'var(--color-muted)', lineHeight: 1.4 }}>{hint}</span>}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 13,
  border: '1px solid var(--color-hairline)',
  borderRadius: 6,
  background: 'var(--color-card)',
  color: 'var(--color-fg)',
  fontFamily: 'inherit',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  lineHeight: 1.5,
  resize: 'vertical',
};
