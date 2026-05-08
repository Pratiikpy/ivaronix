/**
 * Chrome / Brave / Edge native-messaging host registration.
 *
 * Lifted from the Trapezohe companion-cli pattern (Rust crate at
 * `CLI Open Source Project/Trapezohe/companion_service/crates/companion-cli/
 *  src/main.rs:NATIVE_HOST_NAMES`) and re-implemented in TypeScript for
 * cross-platform parity. Writes the manifest JSON Chromium-family browsers
 * use to discover and launch the local Ivaronix daemon, plus (on Windows)
 * the HKCU registry key that points the browser at the manifest.
 *
 * Per docs/PLAN_pass76.md S-4 — "Closes our daemon-UX gap vs Trapezohe."
 */

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
  chmodSync,
} from 'node:fs';
import { homedir, platform as osPlatform } from 'node:os';
import { dirname, resolve } from 'node:path';

/** Canonical native-host name. Matches the manifest filename + reverse-DNS id. */
export const NATIVE_HOST_NAME = 'com.ivaronix.daemon' as const;

export type SupportedBrowser = 'chrome' | 'brave' | 'edge';

/** Chromium-family manifest shape per developer.chrome.com/docs/extensions/develop/concepts/native-messaging */
export interface NativeHostManifest {
  name: string;
  description: string;
  path: string; // absolute path to the executable shim
  type: 'stdio';
  allowed_origins: string[]; // e.g. ["chrome-extension://abc.../"]
}

/**
 * Per-OS, per-browser directory where Chromium-family browsers look for
 * NativeMessagingHosts manifests. Returns the manifest file's absolute path.
 *
 * On Windows the manifest can live anywhere on disk; the registry key is the
 * actual discovery mechanism. We write it to a stable per-user location so
 * `unregister-host` can find it again.
 */
export function manifestPathFor(browser: SupportedBrowser): string {
  const home = homedir();
  const plat = osPlatform();

  if (plat === 'darwin') {
    const support = `${home}/Library/Application Support`;
    const browserDir = {
      chrome: `${support}/Google/Chrome/NativeMessagingHosts`,
      brave: `${support}/BraveSoftware/Brave-Browser/NativeMessagingHosts`,
      edge: `${support}/Microsoft Edge/NativeMessagingHosts`,
    }[browser];
    return resolve(browserDir, `${NATIVE_HOST_NAME}.json`);
  }

  if (plat === 'win32') {
    // Windows: manifest location is arbitrary, but we anchor in LOCALAPPDATA
    // so it's stable and discoverable by `host-info`. The registry key is
    // what the browser actually reads — see registryKeyFor / writeRegistryKey.
    const localAppData = process.env.LOCALAPPDATA ?? `${home}\\AppData\\Local`;
    return resolve(localAppData, 'Ivaronix', 'native-host', `${NATIVE_HOST_NAME}.json`);
  }

  // linux + everything else: XDG-style
  const config = process.env.XDG_CONFIG_HOME ?? `${home}/.config`;
  const browserDir = {
    chrome: `${config}/google-chrome/NativeMessagingHosts`,
    brave: `${config}/BraveSoftware/Brave-Browser/NativeMessagingHosts`,
    edge: `${config}/microsoft-edge/NativeMessagingHosts`,
  }[browser];
  return resolve(browserDir, `${NATIVE_HOST_NAME}.json`);
}

/** Path to the executable shim — what the browser actually launches. */
export function shimPathFor(): string {
  const plat = osPlatform();
  if (plat === 'win32') {
    const localAppData = process.env.LOCALAPPDATA ?? `${homedir()}\\AppData\\Local`;
    return resolve(localAppData, 'Ivaronix', 'native-host', 'ivaronix-host.cmd');
  }
  return resolve(homedir(), '.ivaronix', 'native-host', 'ivaronix-host.sh');
}

/**
 * Windows registry key under which Chromium-family browsers look up native
 * hosts by name. Returns the *full* key path (without the value name). The
 * value lives at the (Default) entry of this key and contains the absolute
 * manifest path. Per Chrome's native-messaging spec.
 */
export function registryKeyFor(browser: SupportedBrowser): string {
  switch (browser) {
    case 'chrome':
      return `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`;
    case 'brave':
      return `HKCU\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`;
    case 'edge':
      return `HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`;
  }
}

export interface RegisterOptions {
  /** Extension origin allowed to message the host. Required by Chromium. */
  allowedOrigin: string;
  /** Where the resolved CLI entry-point lives. */
  cliEntryAbsolutePath: string;
}

/**
 * Build the manifest object for a given browser. Browser is unused today
 * (manifest contents are identical across Chromium-family) but the parameter
 * is kept so `register-host --browser brave` flows through cleanly when
 * Brave-specific overrides become useful.
 */
export function buildManifest(opts: RegisterOptions): NativeHostManifest {
  return {
    name: NATIVE_HOST_NAME,
    description: 'Ivaronix daemon · 0G Agent OS · native messaging bridge',
    path: shimPathFor(),
    type: 'stdio',
    allowed_origins: [opts.allowedOrigin],
  };
}

/**
 * Write the executable shim at `shimPathFor()`. The shim's job is to exec
 * the running Node + Ivaronix CLI in stdio-native-host mode, so when Chrome
 * spawns the host the framed JSON-RPC traffic flows through to our handler.
 *
 * The shim is intentionally tiny — pure forwarding. Real protocol handling
 * lives in the CLI's `daemon native-host-stdio` subcommand (added later).
 */
export function writeShim(cliEntryAbsolutePath: string): string {
  const shim = shimPathFor();
  mkdirSync(dirname(shim), { recursive: true });
  if (osPlatform() === 'win32') {
    // .cmd: forward all args + redirect stdin/stdout transparently
    const cmd = `@echo off\r\nnode "${cliEntryAbsolutePath}" daemon native-host-stdio %*\r\n`;
    writeFileSync(shim, cmd, { encoding: 'utf8' });
  } else {
    const sh = `#!/usr/bin/env bash\nexec node "${cliEntryAbsolutePath}" daemon native-host-stdio "$@"\n`;
    writeFileSync(shim, sh, { encoding: 'utf8' });
    chmodSync(shim, 0o755);
  }
  return shim;
}

/** Write the manifest JSON to disk (creates parent dirs as needed). */
export function writeManifest(manifest: NativeHostManifest, browser: SupportedBrowser): string {
  const path = manifestPathFor(browser);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8' });
  return path;
}

export function readManifest(browser: SupportedBrowser): NativeHostManifest | null {
  const path = manifestPathFor(browser);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as NativeHostManifest;
  } catch {
    return null;
  }
}

export function deleteManifest(browser: SupportedBrowser): boolean {
  const path = manifestPathFor(browser);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}

/**
 * Windows-only: write the HKCU registry key pointing the browser at the
 * manifest. Uses the bundled `reg.exe` so we don't need a third-party
 * registry library. Other platforms: no-op.
 */
export function writeRegistryKey(browser: SupportedBrowser, manifestPath: string): void {
  if (osPlatform() !== 'win32') return;
  const key = registryKeyFor(browser);
  // /ve = (Default) value, /t REG_SZ = string, /d = data, /f = force
  execFileSync('reg.exe', ['ADD', key, '/ve', '/t', 'REG_SZ', '/d', manifestPath, '/f'], {
    stdio: 'pipe',
  });
}

export function deleteRegistryKey(browser: SupportedBrowser): boolean {
  if (osPlatform() !== 'win32') return false;
  const key = registryKeyFor(browser);
  try {
    execFileSync('reg.exe', ['DELETE', key, '/f'], { stdio: 'pipe' });
    return true;
  } catch {
    return false; // key didn't exist
  }
}

export function readRegistryValue(browser: SupportedBrowser): string | null {
  if (osPlatform() !== 'win32') return null;
  const key = registryKeyFor(browser);
  try {
    const out = execFileSync('reg.exe', ['QUERY', key, '/ve'], { encoding: 'utf8', stdio: 'pipe' });
    // output looks like: "    (Default)    REG_SZ    C:\\path\\to\\manifest.json"
    const m = out.match(/REG_SZ\s+(.+)$/m);
    return m && m[1] ? m[1].trim() : null;
  } catch {
    return null;
  }
}
