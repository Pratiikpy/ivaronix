# NVIDIA NIM — third-party compute provider for Ivaronix

> Lets users run inference on NVIDIA's hosted Build catalog (frontier models like Qwen-3.5-397B, Llama-3.1-405B) while keeping every other 0G primitive: receipts on `ReceiptRegistry`, AgentPassport reputation, MemoryAccessLog events, SkillRegistry manifest hashes.
>
> **TIER labelling** is explicit on every receipt:
> - **TIER 1 · 0G-TEE** — inference happened on the 0G Compute network with TEE attestation (today's default path).
> - **TIER 2 · EXTERNAL-SIGNED** — inference happened off-0G (NVIDIA NIM, OpenAI, Ollama, etc.). Receipt is still schema-validated, hash-bound, signed, and chain-anchored, but TEE attestation is **not** part of the receipt's evidence ladder.

The pitch:
> *"0G receipts are TEE-grade; external receipts are still tamper-evident, signed, and on-chain — better than `console.log`, weaker than a TEE."*

## Endpoint

- **Base URL:** `https://integrate.api.nvidia.com/v1`
- **Chat completions:** `POST /v1/chat/completions` (OpenAI-compatible JSON shape, supports `stream: true` SSE)
- **Auth:** `Authorization: Bearer <NVIDIA_API_KEY>` — keys start with `nvapi-…`
- **Models (top picks):**
  - `qwen/qwen3.5-397b-a17b` (frontier reasoning; supports `chat_template_kwargs.enable_thinking`)
  - `meta/llama-3.1-405b-instruct`
  - `mistralai/mixtral-8x22b-instruct-v0.1`
  - Full catalog: <https://build.nvidia.com>

## Env vars

```bash
NVIDIA_API_KEY=nvapi-…
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1   # optional, default
NVIDIA_DEFAULT_MODEL=qwen/qwen3.5-397b-a17b           # optional
```

## Reference snippets (canonical, kept here so we never lose them)

### TypeScript / Node — fetch

```ts
const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream', // omit for JSON
  },
  body: JSON.stringify({
    model: 'qwen/qwen3.5-397b-a17b',
    messages: [{ role: 'user', content: '...' }],
    max_tokens: 16384,
    temperature: 0.6,
    top_p: 0.95,
    top_k: 20,
    stream: true,
    chat_template_kwargs: { enable_thinking: true },
  }),
});
```

### TypeScript / Node — axios with SSE

```ts
import axios from 'axios';

const response = await axios.post(
  'https://integrate.api.nvidia.com/v1/chat/completions',
  {
    model: 'qwen/qwen3.5-397b-a17b',
    messages: [{ role: 'user', content: '...' }],
    stream: true,
    chat_template_kwargs: { enable_thinking: true },
  },
  {
    headers: {
      Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
      Accept: 'text/event-stream',
    },
    responseType: 'stream',
  },
);
response.data.on('data', (chunk) => console.log(chunk.toString()));
```

### Python — `requests` (streaming)

```python
import requests
headers = {
    "Authorization": f"Bearer {os.environ['NVIDIA_API_KEY']}",
    "Accept": "text/event-stream",
}
payload = {
    "model": "qwen/qwen3.5-397b-a17b",
    "messages": [{"role": "user", "content": "..."}],
    "stream": True,
    "chat_template_kwargs": {"enable_thinking": True},
}
r = requests.post("https://integrate.api.nvidia.com/v1/chat/completions",
                  headers=headers, json=payload, stream=True)
for line in r.iter_lines():
    if line:
        print(line.decode("utf-8"))
```

### Python — LangChain

```python
from langchain_nvidia_ai_endpoints import ChatNVIDIA
client = ChatNVIDIA(model="qwen/qwen3.5-397b-a17b",
                    api_key=os.environ["NVIDIA_API_KEY"],
                    temperature=0.6, top_p=0.95)
for chunk in client.stream(messages, chat_template_kwargs={"enable_thinking": True}):
    if "reasoning_content" in (chunk.additional_kwargs or {}):
        print(chunk.additional_kwargs["reasoning_content"], end="")
    print(chunk.content, end="")
```

### bash / curl

```bash
curl https://integrate.api.nvidia.com/v1/chat/completions \
  -H "Authorization: Bearer ${NVIDIA_API_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"model":"qwen/qwen3.5-397b-a17b","messages":[{"role":"user","content":"..."}],"stream":true}'
```

## How it slots into Ivaronix

Per surface:

| Surface | Flag / setting |
|---|---|
| `ivaronix chat` | `--provider nvidia` or in-chat `/provider nvidia` |
| `ivaronix doc ask` | `--provider nvidia` |
| `ivaronix plan` / `code` / `audit` / `swarm` / `watch` | `--provider nvidia` (defaults to `0g`) |
| Studio `/api/run` | `provider` field in body (`'0g'` default, `'nvidia'` opt-in) |
| MCP `ivaronix_ask` | `provider` argument |
| `ivaronix serve` `/v1/chat/completions` | `x-ivaronix-provider: nvidia` header |

Receipt impact:

- `routerTrace.providerKind` set to `'nvidia-nim'` (vs `'0g-router'` for default)
- `teeVerification.kind` set to `'external-signed'` (vs `'0g-tee'` for default)
- Studio + CLI receipt verifier renders a **TIER 2: EXTERNAL** chip — visually distinct from the green TIER 1 chip. The `/r/<id>` Public Proof URL labels them clearly so anyone reading it understands the trust delta.

## Design rationale

1. **PMF:** users want frontier models. 0G Compute today serves Qwen / Llama-8B; without NIM access users leave the moment they need a smarter model.
2. **0G still wins:** every NVIDIA call still anchors a receipt on 0G Chain, updates the AgentPassport, and goes through the SkillRegistry manifest scan. **More on-chain activity, not less.**
3. **Tradeoff is honest, not hidden:** we never claim a NIM receipt is TEE-attested. The public Proof URL surfaces the tier explicitly.
