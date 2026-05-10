import {
  RouterClient,
  type RouterCallOptions,
  type RouterCallResult,
  type RouterCredential,
  type ChatRichInput,
  type ChatRichResult,
} from './index.js';

/**
 * Multi-key rotation for Router calls per HLD §11.0.
 * Holds an ordered array of credentials; tries them in order, fails over on 402/429.
 *
 * Threat model (planning-003 §A.3.2 · WT 66):
 *   - Defends against: a single Router credential being depleted (402),
 *     rate-limited (429), or rejected (auth) mid-run. Rotation surfaces
 *     the failure to the next credential without the caller noticing.
 *   - Does NOT defend against: a malicious credential pretending to be
 *     a legitimate Router endpoint (the caller trusts every credential
 *     in the keyring equally — vetting is the operator's responsibility).
 *     Does NOT defend against the underlying Router service being
 *     compromised (the credentials still terminate at that service).
 *   - Assumed attacker capabilities: the attacker holds zero valid
 *     credentials and cannot inject one into the keyring. If the
 *     operator's `.env` is compromised, rotation cannot help.
 */
export class Keyring {
  private credentials: RouterCredential[];
  private clients: Map<string, RouterClient>;
  private depleted: Set<string>;

  constructor(credentials: RouterCredential[]) {
    if (credentials.length === 0) {
      throw new Error('Keyring requires at least one credential.');
    }
    this.credentials = credentials;
    this.clients = new Map(credentials.map((c) => [c.label, new RouterClient(c)]));
    this.depleted = new Set();
  }

  list(): { label: string; wallet: string; provider: string; depleted: boolean }[] {
    return this.credentials.map((c) => ({
      label: c.label,
      wallet: c.wallet,
      provider: c.providerAddress,
      depleted: this.depleted.has(c.label),
    }));
  }

  pickActive(): RouterCredential {
    for (const c of this.credentials) {
      if (!this.depleted.has(c.label)) return c;
    }
    throw new Error('All Router keys depleted — top up at least one wallet via 0g-compute-cli.');
  }

  invalidate(label: string, reason: '402' | '429' | 'auth'): void {
    if (reason === '402' || reason === 'auth') {
      this.depleted.add(label);
    }
    // 429 — not permanent; just rotate this turn
  }

  async chat(opts: RouterCallOptions): Promise<RouterCallResult> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < this.credentials.length; attempt++) {
      const cred = this.pickActive();
      const client = this.clients.get(cred.label);
      if (!client) throw new Error(`Internal: no client for ${cred.label}`);
      try {
        return await client.chat(opts);
      } catch (err: unknown) {
        lastErr = err;
        const status = (err as { status?: number }).status;
        if (status === 402) {
          this.invalidate(cred.label, '402');
          continue;
        }
        if (status === 429) {
          this.invalidate(cred.label, '429');
          continue;
        }
        if (status === 401 || status === 403) {
          this.invalidate(cred.label, 'auth');
          continue;
        }
        throw err;
      }
    }
    throw lastErr ?? new Error('All keyring credentials failed.');
  }

  async chatRich(input: ChatRichInput): Promise<ChatRichResult> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < this.credentials.length; attempt++) {
      const cred = this.pickActive();
      const client = this.clients.get(cred.label);
      if (!client) throw new Error(`Internal: no client for ${cred.label}`);
      try {
        return await client.chatRich(input);
      } catch (err: unknown) {
        lastErr = err;
        const status = (err as { status?: number }).status;
        if (status === 402) {
          this.invalidate(cred.label, '402');
          continue;
        }
        if (status === 429) {
          this.invalidate(cred.label, '429');
          continue;
        }
        if (status === 401 || status === 403) {
          this.invalidate(cred.label, 'auth');
          continue;
        }
        throw err;
      }
    }
    throw lastErr ?? new Error('All keyring credentials failed.');
  }
}

/**
 * Build a Keyring from environment variables.
 * Format: ZG_API_SECRET + ZG_SERVICE_URL + OG_COMPUTE_PROVIDER + EVM_WALLET_ADDRESS = primary key.
 * Future: add OG_KEYRING_PATH for multi-key JSON file (HLD §11.0).
 */
export function keyringFromEnv(env: NodeJS.ProcessEnv = process.env): Keyring | null {
  const credentials: RouterCredential[] = [];

  const primaryKey = env.ZG_API_SECRET;
  const primaryUrl = env.ZG_SERVICE_URL;
  const primaryProvider = env.OG_COMPUTE_PROVIDER;
  const primaryWallet = env.EVM_WALLET_ADDRESS;

  if (primaryKey && primaryUrl && primaryProvider && primaryWallet) {
    credentials.push({
      label: 'primary',
      apiKey: primaryKey,
      serviceUrl: primaryUrl,
      providerAddress: primaryProvider as `0x${string}`,
      wallet: primaryWallet as `0x${string}`,
    });
  }

  if (credentials.length === 0) return null;
  return new Keyring(credentials);
}
