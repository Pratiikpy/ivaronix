import { JsonRpcProvider, Wallet, type Signer } from 'ethers';
import { NETWORKS, STALE_CHAIN_IDS, type Network, type NetworkConfig } from '@ivaronix/core';

export * from './contracts/ReceiptRegistry.js';
export * from './contracts/AgentPassportINFT.js';
export * from './deployments.js';

export interface ChainClientOptions {
  network: Network;
  privateKey?: string;
  rpcUrl?: string;
}

export class ChainClient {
  readonly config: NetworkConfig;
  readonly provider: JsonRpcProvider;
  readonly signer?: Wallet;

  constructor(opts: ChainClientOptions) {
    this.config = NETWORKS[opts.network];
    if (!this.config) throw new Error(`Unknown network: ${opts.network}`);

    const rpcUrl = opts.rpcUrl ?? this.config.rpcUrl;
    this.provider = new JsonRpcProvider(rpcUrl, {
      chainId: this.config.chainId,
      name: this.config.name,
    });

    if (opts.privateKey) {
      this.signer = new Wallet(opts.privateKey, this.provider);
    }
  }

  /** Verify the connected RPC reports the expected chain ID. Reject stale IDs. */
  async verifyChainId(): Promise<{ ok: true } | { ok: false; reason: string }> {
    const network = await this.provider.getNetwork();
    const reported = Number(network.chainId);

    if (STALE_CHAIN_IDS.has(reported)) {
      return {
        ok: false,
        reason: `RPC reports stale chain ID ${reported}. Expected ${this.config.chainId} (${this.config.name}).`,
      };
    }

    if (reported !== this.config.chainId) {
      return {
        ok: false,
        reason: `RPC reports chain ID ${reported}, expected ${this.config.chainId} (${this.config.name}).`,
      };
    }

    return { ok: true };
  }

  async getBalanceOg(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    // 0G uses 18 decimals like ETH
    const og = Number(balance) / 1e18;
    return og.toFixed(6);
  }

  async getSignerAddress(): Promise<string> {
    if (!this.signer) throw new Error('No signer configured (missing OG_PRIVATE_KEY).');
    return this.signer.getAddress();
  }
}

export function createChainClient(opts: ChainClientOptions): ChainClient {
  return new ChainClient(opts);
}

export type { Signer };
