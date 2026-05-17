/**
 * Probe the /api/run/confirm endpoint directly with a recent paySkillRun tx
 * to see the FULL server-side error response.
 */
const STUDIO = 'https://www.ivaronix.xyz';

async function main() {
  // Use a recent paySkillRun tx hash from v70 retry attempts
  // The tx 0x72c7317c... was from v71 (legal-citation paid run that failed)
  const recentPayments = [
    { tx: '0xac5a0186f6e44fc77479e4a77e388f5a97d1e3a577eaada017ffd37e397c0890', skill: 'term-sheet (first user attempt)' },
    { tx: '0x72c7317c707d25a2', skill: 'legal-citation (v71 attempt)' },
  ];

  for (const { tx, skill } of recentPayments) {
    console.log(`\n=== Probing /api/run/confirm with ${skill} tx=${tx} ===`);
    const res = await fetch(`${STUDIO}/api/run/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        txHash: tx,
        paymentContract: '0xf8085B43a08e957Fea157394dbB0d3EB76A1cD6A',
        skillId: '0x6244e5bd1812eb26d3e1cf702b0edcdd51b172a3b4a28127b11038463a12e4b3',
        amount: '0.015000',
        creator: '0xaa954c33810029a3eFb0bf755FEF17863E8677Ce',
        creatorBps: 9000,
        treasuryBps: 1000,
      }),
    }).catch((e: Error) => ({ status: 0, error: e.message }));
    const status = (res as Response).status ?? 0;
    const text = (res as Response).text ? await (res as Response).text() : `(no body — fetch error: ${(res as any).error})`;
    console.log(`status: ${status}`);
    console.log(`body: ${text.slice(0, 2000)}`);
  }
}
main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
