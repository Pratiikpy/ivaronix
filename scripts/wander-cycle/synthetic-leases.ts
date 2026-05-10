/**
 * Synthetic-lease document generator for the wander-cycle agent.
 *
 * Produces a different lease document every cycle so the receipt produced
 * is not a duplicate of a prior receipt's content. Variations rotate
 * across rent amounts, security deposits, term lengths, and a small set
 * of red-flag clauses (waiver of jury trial, non-refundable deposit,
 * landlord-entry-without-notice, auto-renewal cooldown asymmetry, etc.).
 *
 * Output stays plausibly real but is clearly synthetic — the property
 * address is "123 Test Street" and the parties are "ACME Holdings" and
 * "Tenant" — so a judge running `ivaronix receipt verify <id>` and
 * inspecting the receipt body sees a clean test fixture, not a leaked
 * real document.
 */

const PROPERTY_TYPES = ['1BR apartment', '2BR townhouse', 'studio loft', 'commercial office suite'] as const;
const RENT_RANGES: ReadonlyArray<readonly [number, number]> = [
  [1800, 2400],
  [2400, 3500],
  [1200, 1800],
  [4000, 8000],
];
const TERMS = ['12 months', '24 months', '6 months month-to-month after', '36 months auto-renewing'] as const;
const RED_FLAGS = [
  'Tenant waives the right to a jury trial; all disputes go to binding arbitration in a venue chosen by Landlord.',
  'Security deposit is non-refundable regardless of property condition at move-out.',
  'Landlord may enter the unit at any time without prior notice for any reason deemed necessary.',
  'Late fees: 10% of monthly rent per day after the 5th of the month, compounding.',
  'Tenant agrees to indemnify Landlord against any and all claims arising from Tenant occupancy, including those resulting from Landlord negligence.',
  'Subletting requires Landlord written approval; unauthorised sublets are grounds for immediate termination and forfeiture of deposit.',
  'Termination notice: 90 days written notice required from Tenant; Landlord may terminate with 30 days notice for any reason.',
  'Tenant is responsible for all repairs regardless of cause, including those resulting from Landlord negligence.',
  'This lease auto-renews for 24-month terms unless Tenant provides written notice 120 days before the renewal date.',
  'Pets, overnight guests, and use of common areas after 9pm are prohibited; violations may result in immediate eviction without cure period.',
] as const;

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function pickN<T>(arr: readonly T[], n: number, rng: () => number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(idx, 1)[0]!);
  }
  return out;
}

/**
 * Deterministic-seeded PRNG so a given seed always produces the same
 * lease. Useful for debugging the cycle by replaying a specific run.
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GeneratedLease {
  filename: string;
  body: string;
  redFlagCount: number;
}

export function generateLease(seed: number = Date.now()): GeneratedLease {
  const rng = mulberry32(seed);
  const propType = pick(PROPERTY_TYPES, rng);
  const propIdx = PROPERTY_TYPES.indexOf(propType);
  const [low, high] = RENT_RANGES[propIdx]!;
  const rent = Math.round(low + rng() * (high - low));
  const deposit = Math.round(rent * (1 + rng() * 1.5));
  const term = pick(TERMS, rng);
  const flagCount = 4 + Math.floor(rng() * 3); // 4-6 red flags
  const flags = pickN(RED_FLAGS, flagCount, rng);

  const ts = new Date().toISOString().slice(0, 10);
  const body = `RESIDENTIAL LEASE AGREEMENT (synthetic · ${ts})

Property:    123 Test Street, Unit ${100 + Math.floor(rng() * 900)} · ${propType}
Landlord:    ACME Holdings LLC
Tenant:      [Tenant Name]
Term:        ${term}
Monthly rent: $${rent.toLocaleString()}
Security deposit: $${deposit.toLocaleString()}

CLAUSES:

${flags.map((f, i) => `${i + 1}. ${f}`).join('\n\n')}

[End of synthetic lease · seed=${seed}]
`;

  const filename = `synthetic-lease-${seed}.txt`;
  return { filename, body, redFlagCount: flagCount };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  // CLI: `tsx synthetic-leases.ts [seed]` prints one lease.
  const seed = process.argv[2] ? Number(process.argv[2]) : Date.now();
  const lease = generateLease(seed);
  console.log(`# ${lease.filename}\n`);
  console.log(lease.body);
}
