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
  return runPipelineCore({ ...input, logger: cliLogger });
}
