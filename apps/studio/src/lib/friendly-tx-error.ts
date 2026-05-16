/**
 * Turn raw viem/wagmi tx errors into one-line user-facing messages.
 *
 * Bug-26 (session 41 · real-MM screenshot inspection): /memory issueGrant
 * leaked the entire viem error trace to a judge mid-flow when the wallet
 * was on the wrong network. The block included:
 *   - "Current Chain ID: 1 Expected Chain ID: 16661 – undefined"
 *   - the full hex-encoded tx data
 *   - the ABI signature + raw args
 *   - the sender address
 *   - a viem docs URL
 *   - the viem version
 *
 * A judge reading that sees a developer-tool, not a product. This helper
 * extracts the canonical user-actionable line. The original error is
 * preserved for the dev console; only the user-facing surface is cleaned.
 *
 * Patterns matched (case-insensitive):
 *   - "user rejected" / "User denied" / "User rejected"
 *     -> "Cancelled in MetaMask."
 *   - "current chain of the wallet" / "chain mismatch" / "wrong network"
 *     -> "Wallet is on the wrong network — switch to OG <network>."
 *   - "insufficient funds" / "insufficient balance"
 *     -> "Wallet has insufficient OG to pay gas + value."
 *   - "nonce too low"
 *     -> "Wallet nonce desync — try resetting account in MetaMask Advanced settings."
 *   - "transaction underpriced"
 *     -> "Gas price too low for the network — try again."
 *   - "execution reverted"
 *     -> Extract the revert reason if present, otherwise generic.
 *   - default: first line of the error message, trimmed.
 *
 * For all cases the function returns the friendly text; the raw error is
 * still available via the caller's existing `console.error` or wherever
 * the original Error object flows.
 */
export function friendlyTxError(err: unknown, opts?: { network?: 'mainnet' | 'testnet' }): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const lower = msg.toLowerCase();

  if (lower.includes('user rejected') || lower.includes('user denied')) {
    return 'Cancelled in MetaMask.';
  }
  if (
    lower.includes('current chain of the wallet') ||
    lower.includes('chain mismatch') ||
    lower.includes('wrong network') ||
    lower.includes('chain id') && lower.includes('does not match')
  ) {
    const net = opts?.network === 'testnet' ? 'Galileo testnet' : 'Aristotle mainnet';
    return `Wallet is on the wrong network — switch to OG ${net} and try again.`;
  }
  if (lower.includes('insufficient funds') || lower.includes('insufficient balance')) {
    return 'Wallet has insufficient OG to cover gas + transaction value.';
  }
  if (lower.includes('nonce too low') || lower.includes('nonce has already been used')) {
    return 'Wallet nonce out of sync — reset the account from MetaMask Advanced settings.';
  }
  if (lower.includes('transaction underpriced') || lower.includes('gas price below minimum')) {
    return 'Gas price too low for the network. Try again.';
  }
  if (lower.includes('execution reverted')) {
    // Try to extract a revert reason — viem typically includes
    // "reverted with the following reason: <text>" or "execution reverted: <text>".
    const m1 = msg.match(/revert(?:ed)? (?:with the following )?reason:?\s*['"]?([^'"\n]+)['"]?/i);
    if (m1 && m1[1]) return `Transaction reverted: ${m1[1].trim()}`;
    return 'Transaction reverted on chain (the contract refused the call).';
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'Transaction timed out. The network may be congested; try again.';
  }
  // Default: take the first line, trim, and cap at ~140 chars so the
  // alert stays visually tidy. The raw error is preserved in the
  // browser dev console where the caller logs it.
  const firstLine = msg.split('\n')[0]?.trim() ?? '';
  if (firstLine.length === 0) return 'Transaction failed. See the browser console for details.';
  return firstLine.length > 140 ? `${firstLine.slice(0, 137)}…` : firstLine;
}
