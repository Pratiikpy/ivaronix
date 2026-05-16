import {
  runPipeline as runPipelineCore,
  type PipelineInput as CorePipelineInput,
  type PipelineOutput as CorePipelineOutput,
  type PipelineLogger,
} from '@ivaronix/runtime';
import { ui } from './ui.js';

/**
 * CLI-side thin wrapper around the shared @ivaronix/runtime pipeline. Wires the
 * runtime's logger interface to the colorized CLI ui so plan / code / audit /
 * swarm / watch all render rows the same way. Studio uses the same runtime
 * with a capture-logger so its API route can return logs as JSON.
 */

const cliLogger: PipelineLogger = {
  info: (label: string, detail?: string) => ui.info(label, detail),
  pass: (label: string, detail?: string) => ui.pass(label, detail),
  fail: (label: string, detail?: string) => ui.fail(label, detail),
};

export type PipelineInput = Omit<CorePipelineInput, 'logger'>;
export type PipelineOutput = CorePipelineOutput;

export async function runPipeline(input: PipelineInput): Promise<PipelineOutput> {
  // Default to '0g' (TIER 1 · TEE-attested) for every CLI run. A skill
  // with `compute_tee_required: true` should never silently fall through
  // to NVIDIA NIM just because a stale OG_PROVIDER=nvidia is sitting in
  // the operator's env from an older test session.
  //
  // To opt INTO TIER 2 (NVIDIA NIM), the operator must either:
  //   - pass `--provider nvidia` inline on the command, or
  //   - set IVARONIX_TIER2_OPTIN=1 explicitly so the legacy OG_PROVIDER
  //     env var resolves; without the opt-in flag, OG_PROVIDER is
  //     ignored on the CLI so demo paths cannot land TIER 2 by mistake.
  const tier2OptIn = process.env.IVARONIX_TIER2_OPTIN === '1';
  const legacyProvider = tier2OptIn ? (process.env.OG_PROVIDER as '0g' | 'nvidia' | undefined) : undefined;
  const provider: '0g' | 'nvidia' = input.provider ?? legacyProvider ?? '0g';
  return runPipelineCore({ ...input, provider, logger: cliLogger });
}
