# 0G Testnet Notes

## Wallet

- Test wallet address: `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce`
- Latest checked 0G Galileo balance: `10.5 OG`
- `.env` contains the test wallet private key. Do not commit or share it.

## 0G Private Computer Testnet

- Testnet endpoint: `https://router-api-testnet.integratenetwork.work/v1/chat/completions`
- Base URL for OpenAI-compatible clients: `https://router-api-testnet.integratenetwork.work/v1`
- Tested model: `qwen/qwen-2.5-7b-instruct`
- Test request succeeded with response: `0G test OK`
- The response returned `x_0g_trace` with provider, request ID, and billing.

## Current Model Pricing

For `qwen/qwen-2.5-7b-instruct`:

- Input: `0.0500 OG` per `1,000,000` tokens
- Output: `0.1000 OG` per `1,000,000` tokens

Approximate usage:

- `0.1 OG` is enough for roughly `~1,250` small development calls of about `1,000` input tokens and `300` output tokens.
- `10 OG` is enough for roughly `~125,000` similar small development calls.
- Actual usage depends on prompt size, context length, output length, consensus fan-out, and retries.

## Practical Conclusion

The current `10.5 OG` testnet balance is plenty to test the full Nexus MVP flow on testnet:

1. 0G Chain receipt anchoring
2. 0G Storage memory/document/receipt flows
3. 0G Private Computer inference
4. Skill execution tests
5. Consensus tests, as long as prompts are kept reasonably short

Use short prompts during development and reserve long-context tests for final validation.
