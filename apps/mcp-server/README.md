# `@ivaronix/mcp-server`

> Model Context Protocol server that wires Ivaronix into Claude Desktop, Cursor, and any other MCP-capable host.

Exposes 4 tools to the host LLM:

| Tool             | What it does                                                                                |
|------------------|---------------------------------------------------------------------------------------------|
| `run_skill`      | Run a first-party skill against user-provided context. Anchors a real receipt on 0G Chain.  |
| `verify_receipt` | Verify a receipt by id, receiptRoot, or local file path — same checks as `ivaronix receipt verify`. |
| `list_passports` | List AgentPassportINFTs on the active network (mainnet or testnet).                          |
| `recall_memory`  | Read the operator's encrypted memory entries — gated by on-chain CapabilityRegistry grants. |

## Status

**Pre-publish.** The package is `private: true` and not yet on the public npm registry. To use it today, clone the monorepo, build the package, then point your MCP host at the built binary.

The home page disclosure reads "MCP server in Claude Desktop / Cursor — Server code shipped. Live demo capture needs an end-user UI session." This README is the operator-side setup story behind that disclosure.

## One-time setup

```bash
# 1. Clone + install + build the MCP server
git clone https://github.com/Pratiikpy/ivaronix
cd ivaronix
pnpm install
pnpm --filter @ivaronix/mcp-server build

# 2. Verify the binary exists
ls apps/mcp-server/dist/bin/server.js
```

## Wire into Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows) — replace `<PATH>` with the absolute path to your cloned ivaronix directory:

```json
{
  "mcpServers": {
    "ivaronix": {
      "command": "node",
      "args": ["<PATH>/apps/mcp-server/dist/bin/server.js"],
      "env": {
        "IVARONIX_NETWORK": "mainnet",
        "IVARONIX_SIGNER_KEY": "<your-wallet-private-key>"
      }
    }
  }
}
```

Restart Claude Desktop. The 4 tools above appear in any chat session — try:

```
> @ivaronix verify 66
> @ivaronix list_passports
> @ivaronix run_skill private-doc-review with this contract: …
```

## Wire into Cursor

Cursor reads MCP config from `~/.cursor/mcp.json` (or its equivalent on Windows). Same shape as the Claude Desktop config above.

## Environment

`IVARONIX_NETWORK` selects mainnet (`mainnet` · chainId 16661) or testnet (`testnet` · chainId 16602). `IVARONIX_SIGNER_KEY` is the private key for the wallet that signs receipts; any wallet works for read-only operations.

The MCP server inherits the same network resolution and receipt-anchoring code path as the `ivaronix` CLI, so a receipt anchored through MCP is byte-equal to one anchored through `pnpm ivaronix doc ask`.

## Tests

```bash
pnpm --filter @ivaronix/mcp-server typecheck
```

Runtime smoke test:

```bash
pnpm --filter @ivaronix/mcp-server dev
# In another terminal, run an MCP-compliant client against stdin/stdout.
```

## License

Apache-2.0 © Ivaronix contributors. See [LICENSE](../../LICENSE).
