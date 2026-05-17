import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createDaClient, DEFAULT_DA_ENDPOINT, MAX_BLOB_SIZE } from '@ivaronix/og-da';
import { ui } from '../lib/ui.js';
import { resolveUserPath } from '../lib/user-cwd.js';

/**
 * `ivaronix da …` — wraps 0G Data Availability via the local DA client.
 *
 * The DA stack has no public testnet endpoint; operators run a
 * 0g-da-client Docker container exposing gRPC on port 51001. These
 * commands talk to that container.
 */

export const daCommand = new Command('da').description('0G Data Availability — disperse and retrieve large blobs');

daCommand
  .command('preflight')
  .description('Check if a 0G DA client is reachable on the configured endpoint')
  .option('--endpoint <addr>', 'gRPC endpoint (default localhost:51001)', DEFAULT_DA_ENDPOINT)
  .action(async (opts: { endpoint: string }) => {
    ui.title('0G DA · preflight');
    ui.info(`endpoint             ${opts.endpoint}`);
    ui.divider();
    const client = createDaClient({ endpoint: opts.endpoint });
    try {
      const r = await client.ping();
      if (r.ok) {
        ui.pass(`endpoint reachable   ${opts.endpoint}`);
        ui.info(`max blob size        ${MAX_BLOB_SIZE.toLocaleString()} bytes (31,744 KiB)`);
        ui.divider();
        ui.pass('preflight ok — `ivaronix da disperse <file>` should work.');
      } else {
        ui.fail('endpoint unreachable', r.reason);
        ui.divider();
        ui.hint('No public testnet endpoint exists for 0G DA. To run a local client:');
        ui.hint('');
        ui.hint('  cp da.env.example da.env   # then fill in DA_PRIVATE_KEY (fund ~0.005 OG)');
        ui.hint('  docker compose up -d da-client');
        ui.hint('');
        ui.hint('Then re-run `ivaronix da preflight`. See `da.env.example` for the env');
        ui.hint('shape and `docker-compose.yml` for the container config.');
        process.exitCode = 1;
      }
    } finally {
      client.close();
    }
  });

daCommand
  .command('disperse <file>')
  .description('Disperse a blob and wait for finalization. Prints storage root + epoch + quorum.')
  .option('--endpoint <addr>', 'gRPC endpoint', DEFAULT_DA_ENDPOINT)
  .option('--poll-interval <ms>', 'status poll interval', '2000')
  .option('--poll-timeout <ms>', 'finalization timeout', '300000')
  .action(async (file: string, opts: { endpoint: string; pollInterval: string; pollTimeout: string }) => {
    const abs = resolveUserPath(file);
    if (!existsSync(abs)) {
      ui.fail(`file not found at ${file}`);
      process.exitCode = 1;
      return;
    }
    const data = readFileSync(abs);
    if (data.length > MAX_BLOB_SIZE) {
      ui.fail(`blob size ${data.length.toLocaleString()} exceeds MAX_BLOB_SIZE`);
      process.exitCode = 1;
      return;
    }
    const localSha256 = createHash('sha256').update(data).digest('hex');

    ui.title('0G DA · disperse');
    ui.info(`endpoint             ${opts.endpoint}`);
    ui.info(`file                 ${file} (${data.length.toLocaleString()} bytes)`);
    ui.info(`local sha256         ${localSha256}`);
    ui.divider();
    ui.pending('submitting blob to disperser ...');

    const client = createDaClient({ endpoint: opts.endpoint, timeoutMs: 60_000 });
    const start = Date.now();
    try {
      const result = await client.disperseAndFinalize(data, {
        pollIntervalMs: Number(opts.pollInterval),
        pollTimeoutMs: Number(opts.pollTimeout),
      });
      const ms = Date.now() - start;
      ui.pass(`finalized in         ${ms.toLocaleString()} ms`);
      ui.pass(`storage root         ${result.info.storageRoot}`);
      ui.pass(`epoch                ${result.info.epoch}`);
      ui.pass(`quorum id            ${result.info.quorumId}`);
    } catch (err) {
      ui.fail('disperse failed', (err as Error).message);
      process.exitCode = 1;
    } finally {
      client.close();
    }
  });

daCommand
  .command('retrieve <storageRoot> <epoch> <quorumId>')
  .description('Fetch a previously-dispersed blob by its (root, epoch, quorum) tuple')
  .option('--endpoint <addr>', 'gRPC endpoint', DEFAULT_DA_ENDPOINT)
  .option('--out <path>', 'output file (default stdout)')
  .action(async (storageRoot: string, epoch: string, quorumId: string, opts: { endpoint: string; out?: string }) => {
    if (!/^0x[0-9a-fA-F]+$/.test(storageRoot)) {
      ui.fail(`storageRoot must be 0x-hex, got ${storageRoot}`);
      process.exitCode = 1;
      return;
    }
    ui.title('0G DA · retrieve');
    ui.info(`endpoint             ${opts.endpoint}`);
    ui.info(`storage root         ${storageRoot}`);
    ui.info(`epoch · quorum       ${epoch} · ${quorumId}`);
    ui.divider();

    const client = createDaClient({ endpoint: opts.endpoint });
    try {
      const data = await client.retrieveBlob(storageRoot as `0x${string}`, BigInt(epoch), BigInt(quorumId));
      if (opts.out) {
        const outPath = resolveUserPath(opts.out);
        writeFileSync(outPath, data);
        const st = statSync(outPath);
        ui.pass(`wrote ${st.size.toLocaleString()} bytes to ${opts.out}`);
        ui.info(`sha256               ${createHash('sha256').update(data).digest('hex')}`);
      } else if (process.stdout.isTTY) {
        // HALF_BAKED §C closure · refuse to write binary to a TTY.
        // Writing raw blob bytes to a terminal can render control
        // characters that corrupt the cursor/state, and DA blobs are
        // routinely large (megabytes) so the scroll-back fills with
        // noise. Force the user to pick an explicit output path or
        // pipe the output downstream where binary is expected.
        ui.fail('stdout is a TTY; refusing to dump binary blob to terminal');
        ui.hint(`pass --out <path> to write the blob to a file, OR pipe stdout to a consumer (e.g. \`ivaronix da retrieve ... | sha256sum\` or \`> blob.bin\`)`);
        ui.info(`blob size            ${data.byteLength.toLocaleString()} bytes`);
        ui.info(`sha256               ${createHash('sha256').update(data).digest('hex')}`);
        process.exitCode = 1;
      } else {
        // Pipe target (file redirect, downstream command). Binary is
        // expected here; write through unchanged.
        process.stdout.write(data);
      }
    } catch (err) {
      ui.fail('retrieve failed', (err as Error).message);
      process.exitCode = 1;
    } finally {
      client.close();
    }
  });
