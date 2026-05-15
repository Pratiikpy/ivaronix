import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = "C:\\Users\\prate\\Downloads\\Ivaronix X Feature Posts";

type Variant = {
  file: string;
  theme: "paper" | "ink" | "receipt" | "system";
  eyebrow: string;
  headline: string;
  accent: string;
  subline: string;
  footer: string;
  caption: string;
};

const variants: Variant[] = [
  {
    file: "coming-soon-01-private-proof.png",
    theme: "paper",
    eyebrow: "coming soon · ivaronix",
    headline: "Private AI work",
    accent: "public proof",
    subline: "A verifiable workroom for sensitive AI tasks, paid skills, controlled memory, and receipts anyone can check.",
    footer: "run → verify → remember → pay → share",
    caption:
      "Coming soon: Ivaronix.\n\nPrivate AI work. Public proof.\n\nA verifiable workroom for sensitive tasks, paid skills, controlled memory, and receipts anyone can check.\n\n#BuildOn0G #0GHackathon @0G_labs @0g_CN @0g_Eco @HackQuest_",
  },
  {
    file: "coming-soon-02-receipts-not-vibes.png",
    theme: "ink",
    eyebrow: "receipt layer · soon",
    headline: "Receipts",
    accent: "not vibes",
    subline: "Every important AI action should leave a trail: model, skill, storage root, chain tx, cost, and verifier status.",
    footer: "the AI said so is not proof",
    caption:
      "We are building Ivaronix because “the AI said so” is not proof.\n\nEvery important AI action should leave a receipt: model, skill, storage root, chain tx, cost, and verifier status.\n\nComing soon.\n\n#BuildOn0G #0GHackathon",
  },
  {
    file: "coming-soon-03-workroom.png",
    theme: "system",
    eyebrow: "workroom · soon",
    headline: "Run. Verify.",
    accent: "share",
    subline: "A calm interface for high-stakes AI work, with hard proof underneath.",
    footer: "0G compute · storage · chain · agent id",
    caption:
      "Ivaronix is coming soon.\n\nRun private AI work. Verify the process. Share proof without exposing the source.\n\nA calm workroom for high-stakes AI, with hard proof underneath.\n\n#BuildOn0G #0GHackathon",
  },
  {
    file: "coming-soon-04-almost-live.png",
    theme: "receipt",
    eyebrow: "status · pre-launch",
    headline: "Almost",
    accent: "live",
    subline: "The next receipt should not be a screenshot. It should be something anyone can verify.",
    footer: "signed in private · shared in public",
    caption:
      "Almost live.\n\nThe next receipt should not be a screenshot. It should be something anyone can verify.\n\nIvaronix is coming soon.\n\n#BuildOn0G #0GHackathon",
  },
];

const css = `
* { box-sizing: border-box; }
body { margin: 0; background: #111; }
.card {
  width: 1080px;
  height: 1080px;
  position: relative;
  overflow: hidden;
  font-family: "Segoe UI", "Outfit", Arial, sans-serif;
}
.mono {
  font-family: "Cascadia Mono", "Consolas", monospace;
  letter-spacing: .22em;
  text-transform: uppercase;
}
.serif {
  font-family: Georgia, "Times New Roman", serif;
  font-style: italic;
  font-weight: 400;
}
.top {
  position: absolute;
  top: 70px;
  left: 74px;
  right: 74px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: #797970;
  z-index: 2;
}
.brand {
  position: absolute;
  left: 74px;
  bottom: 70px;
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 25px;
  font-weight: 760;
  letter-spacing: -0.035em;
  z-index: 3;
}
.brand svg { display: block; flex: none; }
.corner-note {
  position: absolute;
  right: 74px;
  bottom: 84px;
  font-size: 13px;
  color: #16a34a;
  z-index: 3;
}
.status-card {
  position: absolute;
  right: 78px;
  bottom: 210px;
  width: 345px;
  border: 1px solid rgba(10,10,10,.13);
  border-radius: 12px;
  background: rgba(255,255,255,.82);
  padding: 26px;
  z-index: 2;
}
.status-row {
  display: flex;
  justify-content: space-between;
  padding: 13px 0;
  border-bottom: 1px solid rgba(10,10,10,.08);
  font: 15px/1.2 "Cascadia Mono","Consolas",monospace;
}
.status-row:last-child { border-bottom: 0; }
.light {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border: 1px solid rgba(250,250,247,.16);
  border-radius: 14px;
  overflow: hidden;
}
.light > div {
  min-height: 150px;
  padding: 22px 18px;
  border-right: 1px solid rgba(250,250,247,.1);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.light > div:last-child { border-right: 0; }
.dot {
  width: 16px;
  height: 16px;
  border-radius: 99px;
  background: #16a34a;
  box-shadow: 0 0 0 7px rgba(22,163,74,.15);
}
`;

function mark(color: string) {
  return `
    <div class="brand">
      <svg width="38" height="38" viewBox="0 0 44 44" fill="none">
        <path d="M10 8 L4 8 L4 36 L10 36" stroke="${color}" stroke-width="4" stroke-linecap="square"/>
        <path d="M34 8 L40 8 L40 36 L34 36" stroke="${color}" stroke-width="4" stroke-linecap="square"/>
        <text x="22" y="32" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="34" fill="${color}">i</text>
        <circle cx="24" cy="10" r="3.4" fill="#16a34a"/>
      </svg>
      <span>Ivaronix</span>
    </div>`;
}

function html(body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`;
}

function render(v: Variant) {
  if (v.theme === "ink") {
    return html(`
      <main class="card" style="background:#0a0a0a;color:#fafaf7">
        <div style="position:absolute;inset:0;background:radial-gradient(circle at 75% 25%,rgba(22,163,74,.18),transparent 28%),#0a0a0a"></div>
        <div class="top mono"><span>- ${v.eyebrow}</span><span style="color:#16a34a">pre-launch</span></div>
        <section style="position:absolute;left:74px;right:74px;top:190px;z-index:2">
          <div style="font-size:152px;line-height:.88;font-weight:800;letter-spacing:-.075em">${v.headline}</div>
          <div class="serif" style="font-size:158px;line-height:.82;color:#8c8c86">${v.accent}.</div>
          <p style="margin:62px 0 0;max-width:650px;font-size:30px;line-height:1.25;color:#c7c7c0">${v.subline}</p>
        </section>
        <div style="position:absolute;left:74px;right:74px;bottom:215px;z-index:2" class="light">
          ${["Storage", "Compute", "Chain", "Verify"].map((x) => `<div><span class="dot"></span><span class="mono" style="font-size:11px;color:#a4a49d">${x}</span></div>`).join("")}
        </div>
        ${mark("#fafaf7")}
        <div class="corner-note mono">${v.footer}</div>
      </main>`);
  }

  if (v.theme === "system") {
    return html(`
      <main class="card" style="background:#fafaf7;color:#0a0a0a">
        <div style="position:absolute;right:0;top:0;width:39%;height:100%;background:#0a0a0a"></div>
        <div class="top mono"><span>- ${v.eyebrow}</span><span style="color:#fafaf7">coming soon</span></div>
        <section style="position:absolute;left:74px;top:188px;width:525px">
          <div style="font-size:104px;line-height:.92;font-weight:800;letter-spacing:-.065em">Run.<br>Verify.</div>
          <div class="serif" style="font-size:122px;line-height:.86;color:#5f5f59">${v.accent}.</div>
          <p style="margin:44px 0 0;max-width:520px;font-size:30px;line-height:1.25;color:#5a5a54">${v.subline}</p>
        </section>
        <section style="position:absolute;right:72px;top:216px;width:300px;color:#fafaf7">
          <div class="mono" style="font-size:12px;color:#92928d">product loop</div>
          ${["Run", "Verify", "Remember", "Pay", "Share"].map((x, i) => `<div style="display:flex;gap:18px;align-items:center;margin-top:34px;font-size:28px;font-weight:650;letter-spacing:-.03em"><span class="mono" style="font-size:14px;color:#16a34a">0${i + 1}</span>${x}</div>`).join("")}
        </section>
        ${mark("#0a0a0a")}
        <div class="corner-note mono" style="color:#16a34a">${v.footer}</div>
      </main>`);
  }

  if (v.theme === "receipt") {
    return html(`
      <main class="card" style="background:#0a0a0a;color:#fafaf7">
        <div class="top mono"><span>- ${v.eyebrow}</span><span style="color:#16a34a">status green soon</span></div>
        <section style="position:absolute;left:74px;right:74px;top:185px">
          <div style="font-size:164px;line-height:.84;font-weight:800;letter-spacing:-.078em">${v.headline}</div>
          <div class="serif" style="font-size:184px;line-height:.78;color:#8f8f89">${v.accent}.</div>
        </section>
        <p style="position:absolute;left:80px;bottom:300px;max-width:560px;font-size:30px;line-height:1.26;color:#c4c4bd">${v.subline}</p>
        <div style="position:absolute;right:78px;bottom:235px;width:335px;border:1px solid rgba(250,250,247,.16);border-radius:12px;background:rgba(250,250,247,.05);padding:26px">
          ${[
            ["receipt", "queued"],
            ["model", "selected"],
            ["storage", "ready"],
            ["chain", "soon"],
          ].map(([a,b]) => `<div class="status-row" style="border-color:rgba(250,250,247,.11)"><b>${a}</b><span style="color:${b === "soon" ? "#16a34a" : "#fafaf7"}">${b}</span></div>`).join("")}
        </div>
        ${mark("#fafaf7")}
        <div class="corner-note mono">${v.footer}</div>
      </main>`);
  }

  return html(`
    <main class="card" style="background:#fafaf7;color:#0a0a0a">
      <div class="top mono"><span>- ${v.eyebrow}</span><span style="color:#16a34a">live soon</span></div>
      <section style="position:absolute;left:74px;right:74px;top:176px">
        <div style="font-size:128px;line-height:.9;font-weight:800;letter-spacing:-.07em">${v.headline}</div>
        <div class="serif" style="font-size:144px;line-height:.82;color:#5a5a54">${v.accent}.</div>
        <p style="margin:48px 0 0;max-width:650px;font-size:31px;line-height:1.25;color:#5a5a54">${v.subline}</p>
      </section>
      <div class="status-card">
        ${[
          ["Workroom", "private"],
          ["Receipt", "public"],
          ["Memory", "controlled"],
          ["Skills", "paid"],
        ].map(([a,b]) => `<div class="status-row"><b>${a}</b><span style="color:${b === "public" ? "#16a34a" : "#0a0a0a"}">${b}</span></div>`).join("")}
      </div>
      ${mark("#0a0a0a")}
      <div class="corner-note mono">${v.footer}</div>
    </main>`);
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });

  for (const variant of variants) {
    await page.setContent(render(variant), { waitUntil: "load" });
    await page.screenshot({ path: path.join(outDir, variant.file), type: "png", fullPage: false });
    console.log(`wrote ${variant.file}`);
  }

  const captionMd = [
    "# Ivaronix coming soon captions",
    "",
    ...variants.flatMap((variant) => [`## ${variant.file}`, variant.caption, ""]),
  ].join("\n");
  await fs.writeFile(path.join(outDir, "coming-soon-captions.md"), captionMd, "utf8");
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
