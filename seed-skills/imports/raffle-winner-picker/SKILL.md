---
name: raffle-winner-picker
version: 0.1.0
description: "Picks random winners from lists, spreadsheets, or Google Sheets for giveaways, raffles, and contests. Ensures fair, unbiased selection with transparency."
license: "Apache-2.0"
metadata:
  openclaw:
    install:
      - kind: node
        package: "@ivaronix/cli"
        bins: ["ivaronix"]
        os: ["linux", "darwin", "win32"]
        label: "Install Ivaronix CLI to run this skill"
    requires:
      env: ["EVM_PRIVATE_KEY", "EVM_WALLET_ADDRESS", "ZG_API_SECRET"]
entrypoint: prompt.md

og:
  permissions:
    memory_access: none
    network_access: []
    wallet_access: false
    writes_files: false
    shell_access: none
    receipt_required: true
    compute_tee_required: true
    passport_min_trust: 0
  reputation:
    on_pass: { trustScore: 1, receiptCount: 1 }
    on_fail: { trustScore: -1, violationCount: 0 }
    on_violation: { trustScore: -5, locked: false }
  consensus:
    required: false
    default_tier: quick
  burn:
    auto_enable: false
  hooks:
    pre_consensus: ["redact_pii", "balance_check"]
    post_consensus: ["log_tokens"]
  creator:
    passport: "did:0g:passport:0xaa954c33810029a3eFb0bf755FEF17863E8677Ce:1"
---

# Raffle Winner Picker

This skill randomly selects winners from lists, spreadsheets, or Google Sheets for giveaways and contests.

## When to Use This Skill

- Running social media giveaways
- Picking raffle winners at events
- Randomly selecting participants for surveys or tests
- Choosing winners from contest submissions
- Fair distribution of limited spots or resources
- Random team assignments

## What This Skill Does

1. **Random Selection**: Uses cryptographically random selection
2. **Multiple Sources**: Works with CSV, Excel, Google Sheets, or plain lists
3. **Multiple Winners**: Can pick one or multiple winners
4. **Duplicate Prevention**: Ensures the same person can't win twice
5. **Transparent Results**: Shows the selection process clearly
6. **Winner Details**: Displays all relevant information about winners

## How to Use

### From Google Sheets

```
Pick a random row from this Google Sheet to select a winner 
for a giveaway: [Sheet URL]
```

### From Local File

```
Pick 3 random winners from entries.csv
```

### From List

```
Pick a random winner from this list:
- Alice (alice@email.com)
- Bob (bob@email.com)
- Carol (carol@email.com)
...
```

### Multiple Winners

```
Pick 5 random winners from contest-entries.xlsx, 
make sure no duplicates
```

## Example

**User**: "Pick a random row from this Google Sheet to select a winner for a giveaway."

**Output**:
```
Accessing Google Sheet...
Total entries found: 247

Randomly selecting winner...

🎉 WINNER SELECTED! 🎉

Row #142
Name: Sarah Johnson
Email: sarah.j@email.com
Entry Date: March 10, 2024
Comment: "Love your newsletter!"

Selection method: Cryptographically random
Timestamp: 2024-03-15 14:32:18 UTC

Would you like to:
- Pick another winner (excluding Sarah)?
- Export winner details?
- Pick runner-ups?
```

**Inspired by:** Lenny's use case - picking a Sora 2 giveaway winner from his subscriber Slack community

## Features

### Fair Selection
- Uses secure random number generation
- No bias or patterns
- Transparent process
- Repeatable with seed (for verification)

### Exclusions
```
Pick a random winner excluding previous winners: 
Alice, Bob, Carol
```

### Weighted Selection
```
Pick a winner with weighted probability based on 
the "entries" column (1 entry = 1 ticket)
```

### Runner-ups
```
Pick 1 winner and 3 runner-ups from the list
```

## Example Workflows

### Social Media Giveaway
1. Export entries from Google Form to Sheets
2. "Pick a random winner from [Sheet URL]"
3. Verify winner details
4. Announce publicly with timestamp

### Event Raffle
1. Create CSV of attendee names and emails
2. "Pick 10 random winners from attendees.csv"
3. Export winner list
4. Email winners directly

### Team Assignment
1. Have list of participants
2. "Randomly split this list into 4 equal teams"
3. Review assignments
4. Share team rosters

## Tips

- **Document the process**: Save the timestamp and method
- **Public announcement**: Share selection details for transparency
- **Check eligibility**: Verify winner meets contest rules
- **Have backups**: Pick runner-ups in case winner is ineligible
- **Export results**: Save winner list for records

## Privacy & Fairness

✓ Uses cryptographically secure randomness
✓ No manipulation possible
✓ Timestamp recorded for verification
✓ Can provide seed for third-party verification
✓ Respects data privacy

## Common Use Cases

- Newsletter subscriber giveaways
- Product launch raffles
- Conference ticket drawings
- Beta tester selection
- Focus group participant selection
- Random prize distribution at events
