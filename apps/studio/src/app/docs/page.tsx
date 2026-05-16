import Link from 'next/link';
import { Section } from '@/components/Section';
import { getSampleReceiptId, getSampleReceiptHref, getSampleEmbedHref, getSampleEmbedIframeSrc } from '@/lib/sample-receipt';

export const dynamic = 'force-static';

const SAMPLE_ID = getSampleReceiptId();
const SAMPLE_EMBED_URL = getSampleEmbedIframeSrc();
const SAMPLE_RECEIPT_URL = `https://www.ivaronix.xyz/r/${SAMPLE_ID}`;

export const metadata = {
  title: 'Docs · CLI · SDK · MCP · Embed widget · Ivaronix',
  description:
    'Four integration paths into Ivaronix: CLI, TypeScript SDK, Model Context Protocol server, and embeddable receipt widget. Every snippet runs against the live 0G Network — testnet for cheap iteration, mainnet for production.',
};

interface DocSection {
  id: string;
  name: string;
  body: string;
  snippets: { label: string; code: string }[];
  link?: { href: string; label: string };
}

const SECTIONS: DocSection[] = [
  {
    id: 'cli',
    name: 'CLI',
    body:
      'The Ivaronix CLI ships 34 commands. Install once, run a private review against any local file, anchor a receipt on chain. Every command works against the live 0G Network on both testnet and mainnet.',
    snippets: [
      {
        label: 'Install + first run',
        code:
          '$ git clone https://github.com/Pratiikpy/ivaronix.git\n' +
          '$ cd ivaronix && pnpm install\n' +
          '$ cp .env.example .env  # fill IVARONIX_SIGNER_KEY\n' +
          '$ pnpm ivaronix doctor\n' +
          '$ pnpm ivaronix demo --tier standard',
      },
      {
        label: 'Ask a private skill',
        code: '$ pnpm ivaronix doc ask contract.pdf "find risks" --skill private-doc-review --burn --quick',
      },
      {
        label: 'Verify a receipt anywhere',
        code:
          '$ pnpm ivaronix receipt verify 1004 --tee-independent\n' +
          '→ FULLY VERIFIED ✓  schema · hash · signature · anchor · TEE',
      },
    ],
    link: { href: '/marketplace', label: 'Browse paid skills →' },
  },
  {
    id: 'sdk',
    name: 'SDK',
    body:
      '21 TypeScript packages. `@ivaronix/runtime` is the integration surface for embedding receipt anchoring in a Node service. `@ivaronix/receipts` carries the canonical hash + verify logic. `@ivaronix/og-chain` wraps the V3 / V2 / V1 receipt registry clients.',
    snippets: [
      {
        label: 'Run a skill from a server',
        code:
          'import { runSkill } from \'@ivaronix/runtime\';\n\n' +
          'const receipt = await runSkill({\n' +
          '  skillId: \'private-doc-review\',\n' +
          '  input: { document: contractText, question: \'find risks\' },\n' +
          '  tier: \'standard\',\n' +
          '});\n\n' +
          'console.log(receipt.id, receipt.chainAnchor.anchorTxHash);',
      },
      {
        label: 'Verify a receipt offline',
        code:
          'import { verifyClaimed } from \'@ivaronix/receipts\';\n\n' +
          'const { state, checks } = verifyClaimed(receiptBody);\n' +
          'if (state !== \'CLAIMED\') throw new Error(\'forged receipt\');',
      },
    ],
  },
  {
    id: 'mcp',
    name: 'MCP server',
    body:
      'Wire Ivaronix into Claude Desktop or Cursor through the Model Context Protocol. The MCP server exposes 4 tools: run_skill, verify_receipt, list_passports, recall_memory. The host LLM calls them directly inside a chat session.',
    snippets: [
      {
        label: 'Claude Desktop config',
        code:
          '{\n' +
          '  "mcpServers": {\n' +
          '    "ivaronix": {\n' +
          '      "command": "ivaronix-mcp"\n' +
          '    }\n' +
          '  }\n' +
          '}',
      },
      {
        label: 'Inside the chat',
        code:
          '> @ivaronix verify 1004\n' +
          '→ FULLY VERIFIED · schema PASS · hash PASS · signature PASS · anchor 0x… · TEE re-attestation PASS',
      },
    ],
  },
  {
    id: 'embed',
    name: 'Embed widget',
    body:
      'Drop a verified receipt into any page with one iframe. The widget renders the TIER badge, four-light row, signer wallet, anchor tx, and verify chip without needing the Ivaronix install on the visitor side.',
    snippets: [
      {
        label: 'Single receipt embed',
        code:
          '<iframe\n' +
          `  src="${SAMPLE_EMBED_URL}"\n` +
          '  width="640" height="480"\n' +
          '  frameborder="0"\n' +
          `  title="Ivaronix Verified Receipt #${SAMPLE_ID}"\n` +
          '/>',
      },
      {
        label: 'Full proof page link',
        code:
          `<a href="${SAMPLE_RECEIPT_URL}" target="_blank" rel="noopener">\n` +
          `  Verified by Ivaronix · /r/${SAMPLE_ID}\n` +
          '</a>',
      },
    ],
    link: { href: getSampleEmbedHref(), label: 'Preview the embed →' },
  },
];

export default function DocsPage() {
  return (
    <Section
      label="§ DOCS · CLI · SDK · MCP · EMBED"
      title="Four ways to plug Ivaronix into a workflow."
      description="Every snippet runs against the live 0G Network — testnet for cheap iteration, mainnet for production. Receipt id 1004 is the canonical sample; replace with any anchored id you have."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
        <nav
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            padding: '12px 16px',
            background: 'var(--color-tonal)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--color-fg)',
                textDecoration: 'none',
                padding: '4px 12px',
                border: '1px solid var(--color-hairline)',
                borderRadius: 999,
              }}
            >
              #{s.id}
            </a>
          ))}
        </nav>

        {SECTIONS.map((section) => (
          <div
            key={section.id}
            id={section.id}
            style={{ display: 'flex', flexDirection: 'column', gap: 16, scrollMarginTop: 80 }}
          >
            <div className="section-label">{section.name}</div>
            <p
              style={{
                margin: 0,
                fontSize: 15,
                lineHeight: 1.6,
                color: 'var(--color-muted)',
                maxWidth: 720,
              }}
            >
              {section.body}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {section.snippets.map(({ label, code }) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: 14,
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-hairline)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--color-muted)', letterSpacing: '0.5px' }}>{label}</span>
                  <pre
                    style={{
                      margin: 0,
                      padding: '10px 12px',
                      background: 'var(--color-tonal)',
                      border: '1px solid var(--color-hairline)',
                      borderRadius: 8,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      lineHeight: 1.55,
                      overflowX: 'auto',
                      whiteSpace: 'pre',
                      color: 'var(--color-fg)',
                    }}
                  >
                    {code}
                  </pre>
                </div>
              ))}
            </div>
            {section.link && (
              <Link
                href={section.link.href}
                className="btn-ghost"
                style={{ alignSelf: 'flex-start', fontSize: 13, padding: '6px 12px', textDecoration: 'underline' }}
              >
                {section.link.label}
              </Link>
            )}
          </div>
        ))}

        <div
          style={{
            paddingTop: 24,
            borderTop: '1px solid var(--color-hairline)',
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            fontSize: 13,
            color: 'var(--color-muted)',
          }}
        >
          <span>
            Source on GitHub:{' '}
            <a href="https://github.com/Pratiikpy/ivaronix" style={{ color: 'var(--color-fg)' }}>
              Pratiikpy/ivaronix
            </a>
          </span>
          <span>·</span>
          <span>
            0G primitives:{' '}
            <Link href="/0g" style={{ color: 'var(--color-fg)' }}>/0g</Link>
          </span>
          <span>·</span>
          <span>
            Receipt anatomy:{' '}
            <Link href="/learn#receipt-anatomy" style={{ color: 'var(--color-fg)' }}>/learn#receipt-anatomy</Link>
          </span>
        </div>
      </div>
    </Section>
  );
}
