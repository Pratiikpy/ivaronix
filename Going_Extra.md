# Going Extra

These are not random extra features.

They are small, high-value additions that make Ivaronix stronger after the core testnet product is working.

The rule:

> Add only what improves user value, proof, payments, or 0G-native strength.

## 1. Add 0GM As A First-Class Model Option

0G is launching its own model path.

Ivaronix should let users choose the 0G model directly when running a skill, document review, repo audit, or high-stakes AI action.

Why users care:

- They can run work on a model from the same ecosystem as the proof layer.
- They do not need to depend only on external AI APIs.
- It makes Ivaronix feel more native to 0G.
- It strengthens the trust story: model, compute, receipt, and chain proof can all live in one stack.

How it improves Ivaronix:

- Better 0G technical integration.
- Stronger demo for judges.
- Clearer reason to use Ivaronix inside the 0G ecosystem.
- Helps us say: "Run verified AI work on 0G-native models."

Cost level:

- Mostly code and configuration.
- Not a major money-heavy feature.

## 2. Add "Run Skill On 0G Model" To Receipts

Every receipt should show whether the skill/action used the 0G model.

Example receipt fields:

```text
model: 0GM
modelSource: 0G
computePath: 0G Private Compute
skillRunOn0GModel: true
```

Why users care:

- They can see exactly what model powered the result.
- They can prove the action was not just a normal external API call.
- Teams and judges can verify the trust level faster.

How it improves Ivaronix:

- Makes proof pages more valuable.
- Makes skill runs more transparent.
- Strengthens the "receipts not vibes" story.

Cost level:

- Cheap.
- Mostly receipt schema, UI display, and CLI output.

## 3. Add Paid Verified Skill Runs With 0G / USDC.e

After mainnet is stable, Ivaronix should let skill creators attach a price to a verified skill run.

Simple version:

- creator wallet
- skill price
- payment token: 0G or USDC.e
- payment status in receipt
- creator payout record

Why users care:

- Users can pay for useful AI work, not random prompts.
- Creators can earn from skills that actually run and produce receipts.
- Buyers can verify what they paid for.
- No fake reviews needed; reputation can come from real paid receipts.

How it improves Ivaronix:

- Adds a real business model.
- Makes the skill system more useful.
- Gives creators a reason to publish better skills.
- Lets Ivaronix become a marketplace later without forcing marketplace into MVP.

Cost level:

- Building the metadata is cheap.
- Real payment testing needs small 0G / USDC.e funds.
- Full marketplace can wait.

## 3.5 Add One Clean Paid-Skill Mock / Metadata Flow

Before building a full marketplace, Ivaronix should show one clean paid-skill flow.

This does not need to be a full production marketplace.

It should prove the idea clearly:

> A user runs a verified skill, the receipt shows who would get paid, what token is used, and what proof was created.

Simple flow:

1. Creator publishes or selects a skill.
2. Skill has a creator wallet.
3. Skill has a price.
4. Price token is `0G` or `USDC.e`.
5. User runs the skill.
6. Receipt includes payment metadata.
7. Proof page shows payment status honestly.

Payment metadata example:

```text
paymentMode: metadata-only
paymentToken: USDC.e
skillPrice: 0.10
creatorWallet: 0x...
protocolFeeBps: 100
creatorShareBps: 9900
paymentStatus: not-settled
settlementLayer: 0G
```

Important:

If the payment is only metadata or mock mode, the UI must say that clearly.

Do not show it as paid or settled unless a real payment happened.

Why users care:

- Buyers understand what a paid skill run will cost.
- Creators understand how they can earn later.
- Judges see a real economy path without needing full marketplace complexity.
- It makes receipts more valuable because they can prove both work and payment context.

How it improves Ivaronix:

- Shows that Ivaronix can become a verified skill economy.
- Helps compete with SkillMint, Agentra, and zer0Gig without losing the private workroom focus.
- Makes the roadmap feel practical, not vague.
- Adds PMF because useful skills need a reason for creators to publish and maintain them.

What this should not become yet:

- Not a full marketplace.
- Not Arc-first settlement.
- Not fake paid execution.
- Not a large tokenomics system.
- Not a distraction from the core receipt workflow.

### Verification Method For Paid-Skill Mock / Metadata Flow

| What To Verify | How To Test | Pass Condition |
|---|---|---|
| Skill has creator wallet | Open skill detail or CLI inspect. | Creator wallet is visible and valid-looking. |
| Skill has price | Open skill detail before run. | Price and token are visible before user runs it. |
| User understands payment mode | Read UI label. | UI clearly says `metadata-only`, `mock`, `pending`, or `settled`. |
| Receipt includes payment fields | Run paid-skill demo and open receipt. | Receipt shows token, price, creator wallet, fee split, and payment status. |
| Proof page is honest | Open public proof page in fresh browser. | It does not claim real settlement unless tx/payment exists. |
| CLI shows same payment metadata | Run `ivaronix receipt show <id>`. | CLI and UI show matching payment fields. |
| Payment metadata does not break verification | Run `ivaronix receipt verify <id>`. | Receipt still verifies successfully. |
| Wrong/missing creator wallet fails safely | Try invalid creator wallet in test mode. | UI/CLI rejects it or shows clear error. |
| Fake settlement is impossible | Try to mark settled without payment proof. | System keeps status pending/mock unless proof exists. |
| PMF is clear | Ask a tester what the paid skill means. | Tester understands that creators can earn from verified skill runs later. |

### Real Paid Skill Version Later

After the mock/metadata flow is solid, add real settlement.

Real paid version should add:

- real `0G` or `USDC.e` transfer
- payment transaction hash
- payer wallet
- creator payout wallet
- protocol fee wallet
- settlement status
- receipt link
- ChainScan/payment proof link

Verification method for real paid version:

| What To Verify | How To Test | Pass Condition |
|---|---|---|
| User pays before/after skill run | Run paid skill with wallet. | Wallet shows real transaction approval or payment flow. |
| Payment tx exists | Open tx in explorer. | Tx exists and matches token/amount/wallets. |
| Receipt links payment | Open receipt. | Receipt includes payment tx and payment status `settled`. |
| Creator payout recorded | Check creator wallet/history. | Creator receives correct share or pending claim is recorded. |
| Protocol fee recorded | Check fee wallet/history. | Fee matches configured bps. |
| Refund/failure is safe | Force failed skill or rejected tx. | Payment is not falsely marked successful. |

This flow is good because it adds economy without weakening the 0G story.

The center remains:

```text
verified skill run
-> 0G model / 0G Compute
-> 0G receipt
-> 0G proof page
-> optional 0G / USDC.e payment metadata
```

## 4. Add Circle Nanopayments Later

Circle is pushing agentic payments and tiny USDC payments.

Later, Ivaronix can use Circle Nanopayments for small pay-per-run skill payments.

Why users care:

- Users can pay tiny amounts for one AI action.
- Agents and apps can pay each other automatically.
- It works better for high-volume skill calls than normal card payments.

How it improves Ivaronix:

- Makes paid skill runs smoother.
- Makes Ivaronix more interesting for Circle grants.
- Opens the door to agent-to-agent payments.
- Helps creators get paid in stablecoin.

Cost level:

- Mostly integration work.
- Real payment testing may need USDC.
- This should come after Ivaronix mainnet receipts are working well.

## 5. Add Arc Settlement Later

Arc can become the settlement layer for larger USDC flows later.

This is not needed for the first version.

Why users care:

- Larger payments and creator payouts can settle through stablecoin rails.
- Teams and creators get a cleaner treasury/payment story.

How it improves Ivaronix:

- Makes the long-term economy story stronger.
- Helps if applying for Circle ecosystem support.
- Connects Ivaronix receipts with real stablecoin settlement.

Cost level:

- Later-stage integration.
- Not needed before core launch.

## What We Should Not Do

Do not turn Ivaronix into a generic payment marketplace first.

That would weaken the product.

The right order is:

```text
Private AI workroom
-> verified receipts
-> 0G-native model runs
-> paid verified skills
-> Circle/USDC settlement
-> full marketplace later
```

## Best Simple Story

Ivaronix helps users run important AI work and prove what happened.

0GM makes the AI side more 0G-native.

USDC.e and Circle make paid skill runs useful later.

Together, this creates real product value:

- users get proof
- creators can earn
- teams can trust outputs
- 0G gets a daily-use AI product
- payments become tied to verified work, not vague promises

## Final Decision

These additions are worth doing, but only in the right order.

Build first:

1. 0GM model option
2. receipt fields for 0G model runs
3. skill price/payment metadata

Build after mainnet:

4. paid verified skill runs with 0G / USDC.e
5. Circle Nanopayments
6. Arc settlement for larger payouts

This improves Ivaronix without distracting from the core product.
