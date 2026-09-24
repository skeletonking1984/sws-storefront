/**
 * BAT-172 batch 6, 2026-09-23. Generates ten description rewrites from a per
 * product spec and asserts them against the prepared batch BEFORE anything is
 * sent. Hand typing a filename into "What You Get" is a claim about what the
 * buyer receives and every live audit exits 0 on a wrong one, so the file set
 * is compared to the Etsy manifest as a SET, not eyeballed.
 *
 * Usage: node scripts/one-off/2026-09-23-batch6.mjs
 * Writes data/description-batch-written.json for check + apply + verify.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const batch = JSON.parse(fs.readFileSync(`${ROOT}/data/description-batch.json`, 'utf8'));
const src = Object.fromEntries(batch.rows.map((r) => [r.handle, r]));

const REFUND =
  'Refunds within 30 days if the download never arrived, the files are corrupt or incomplete, the item is not what this listing described, you were charged twice, or we cannot get it running on a platform this listing claims. A working file you downloaded and then changed your mind about is not refundable. Full detail is on our Refund Policy page.';

/**
 * One spec per product. `files` is the manifest as this listing actually
 * ships it, each with the sentence that explains what the buyer does with it.
 * `slBuild` says whether a SEPARATE Streamlabs widget build is in the zip
 * list, which is the difference between "displayed in Streamlabs Desktop as a
 * browser source" and "there is a Streamlabs build in the download". Two of
 * these ship one and eight do not, and saying it the same way for both would
 * be an overclaim on five products.
 */
const SPECS = [
  {
    handle: 'water-fire-nature-cloud-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
    name: 'Water Fire Nature Cloud Goal Widget',
    what: 'a set of four animated liquid fill goal trackers, one each for water, fire, nature and cloud, that fill as the goal climbs',
    suits: 'who want to swap the element to match the game or the scene rather than keep one fixed shape',
    goals: ['donation', 'follower', 'bits', 'support'],
    slBuild: false,
    files: [
      ['Cloud_Fire_Nature_WaterCodes.zip', 'all four element builds, uploaded as custom widgets'],
      ['HowToSetupGoalWidgetTutorial.pdf', 'the step by step setup guide'],
    ],
  },
  {
    handle: 'cute-seal-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-stream-elements',
    name: 'Cute Seal Goal Widget',
    what: 'an animated liquid fill goal tracker shaped like a round little seal',
    suits: 'running an ocean, arctic or soft animal theme',
    goals: ['donation', 'follower', 'bits', 'support'],
    slBuild: false,
    files: [
      ['cutesealcode.zip', 'the widget code, uploaded as a custom widget'],
      ['HowToSetupGoalWidgetTutorial.pdf', 'the step by step setup guide'],
    ],
  },
  {
    handle: 'spooky-skull-moon-ghost-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
    name: 'Spooky Skull Moon Ghost Goal Widget',
    what: 'an animated liquid fill goal tracker shaped like a crescent moon with a skull and a small drifting ghost',
    suits: 'building a Halloween or dark celestial layout',
    goals: ['donation', 'follower', 'bits', 'support'],
    slBuild: false,
    files: [
      ['SkullmoonCodes.zip', 'the widget code, uploaded as a custom widget'],
      ['HowToSetupGoalWidgetTutorial.pdf', 'the step by step setup guide'],
    ],
  },
  {
    handle: 'thanks-giving-tot-bag-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
    name: 'Thanksgiving Tote Bag Goal Widget',
    what: 'an animated liquid fill goal tracker shaped like an autumn tote bag packed with harvest produce',
    suits: 'who want a warm autumn or Thanksgiving scene for the back half of the year',
    goals: ['donation', 'follower', 'bits', 'support'],
    slBuild: true,
    files: [
      ['StreamElementscode.zip', 'the StreamElements build, uploaded as a custom widget'],
      ['StreamlabCode.zip', 'the Streamlabs build'],
      ['HowToSetupGoalWidgetTutorial.pdf', 'the step by step setup guide'],
    ],
  },
  {
    handle: 'christmas-candy-cane-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
    name: 'Christmas Candy Cane Goal Widget',
    what: 'an animated liquid fill goal tracker shaped like a striped candy cane',
    suits: 'putting a holiday layout together for December',
    goals: ['donation', 'follower', 'bits', 'support'],
    slBuild: false,
    files: [
      ['tofeecode.zip', 'the widget code, uploaded as a custom widget'],
      ['HowToSetupGoalWidgetTutorial.pdf', 'the step by step setup guide'],
    ],
  },
  {
    handle: 'christmas-holly-leaves-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
    name: 'Christmas Holly Leaves Goal Widget',
    what: 'an animated liquid fill goal tracker shaped like a sprig of holly leaves and berries',
    suits: 'who want a festive accent that stays small and does not crowd the scene',
    goals: ['donation', 'follower', 'bits', 'support'],
    slBuild: false,
    files: [
      ['LeafVine.zip', 'the widget code, uploaded as a custom widget'],
      ['HowToSetupGoalWidgetTutorial.pdf', 'the step by step setup guide'],
    ],
  },
  {
    handle: 'santa-gloves-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
    name: 'Santa Gloves Goal Widget',
    what: 'an animated liquid fill goal tracker shaped like a pair of red and white Santa gloves',
    suits: 'running a holiday subathon or a December donation drive',
    goals: ['donation', 'follower', 'bits', 'support'],
    slBuild: false,
    files: [
      ['glovescode.zip', 'the widget code, uploaded as a custom widget'],
      ['HowToSetupGoalWidgetTutorial.pdf', 'the step by step setup guide'],
    ],
  },
  {
    handle: 'cute-santa-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
    name: 'Cute Santa Goal Widget',
    what: 'an animated liquid fill goal tracker shaped like a small round Santa',
    suits: 'who want the holiday theme to read instantly at overlay size',
    goals: ['donation', 'follower', 'bits', 'support'],
    slBuild: false,
    files: [
      ['santacode.zip', 'the widget code, uploaded as a custom widget'],
      ['HowToSetupGoalWidgetTutorial.pdf', 'the step by step setup guide'],
    ],
  },
  {
    handle: 'christmas-combo-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
    name: 'Christmas Combo Goal Widget',
    what: 'a set of four animated liquid fill goal trackers, a candy cane, a Santa, a holly sprig and a pair of gloves, so the whole December run can share one look',
    suits: 'who want to change the holiday shape week to week without buying four separate widgets',
    goals: ['donation', 'follower', 'bits', 'support'],
    slBuild: false,
    files: [
      ['Toffee.zip', 'the candy cane build, uploaded as a custom widget'],
      ['Santa.zip', 'the Santa build, uploaded as a custom widget'],
      ['LeafVine.zip', 'the holly build, uploaded as a custom widget'],
      ['Gloves.zip', 'the gloves build, uploaded as a custom widget'],
      ['HowToSetupGoalWidgetTutorial.pdf', 'the step by step setup guide'],
    ],
  },
  {
    handle: 'christmas-giftbox-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
    name: 'Christmas Giftbox Goal Widget',
    what: 'an animated liquid fill goal tracker shaped like a wrapped gift box with a ribbon',
    suits: 'running a gift or giveaway themed goal over the holidays',
    goals: ['donation', 'follower', 'bits', 'support'],
    slBuild: true,
    files: [
      ['StreamElementscode.zip', 'the StreamElements build, uploaded as a custom widget'],
      ['StreamlabCode.zip', 'the Streamlabs build'],
      ['HowToSetupGoalWidgetTutorial.pdf', 'the step by step setup guide'],
    ],
  },
];

const list = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' or ' + a.at(-1));
const andList = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a.at(-1));

function worksWithLines(works, slBuild) {
  const out = [];
  if (works.includes('Twitch'))
    out.push('Twitch, the platform this widget tracks activity for');
  if (works.includes('StreamElements'))
    out.push('StreamElements, the platform this widget is built and installed through');
  if (works.includes('Streamlabs'))
    out.push(
      slBuild
        ? 'Streamlabs, with its own build included in the download'
        : 'Streamlabs Desktop, where the widget can be displayed as a browser source',
    );
  if (works.includes('OBS')) out.push('OBS Studio, shown as a browser source');
  return out;
}

function render(spec, row) {
  const {name, what, suits, goals, slBuild, files} = spec;
  const works = row.works_with || [];
  const guide = files.find((f) => /\.pdf$/i.test(f[0]))[0];
  const goalList = list(goals);
  const hosts = works.includes('Streamlabs')
    ? 'OBS Studio or Streamlabs Desktop'
    : 'OBS Studio';

  const setup = [
    `Open the included setup guide (${guide}) for full instructions.`,
    slBuild
      ? 'Unzip the build for the platform you use and add it as a custom widget in StreamElements, or load the Streamlabs build in Streamlabs.'
      : 'Unzip the widget code and add it as a custom widget in StreamElements.',
    `Set the goal type (${goalList}), colour, font, and font size in the widget's custom fields.`,
    `Add the widget to your scene in ${hosts} as a browser source.`,
  ];

  const slAnswer = slBuild
    ? `Yes. The download includes a separate Streamlabs build alongside the StreamElements one, so you can use whichever platform you already run. Either way the overlay is shown in ${hosts} as a browser source.`
    : `The widget itself is built as a StreamElements custom widget. You can display it in Streamlabs Desktop or OBS Studio as a browser source, but the download does not include a separate Streamlabs widget build.`;

  return `<p>The ${name} is ${what}, built for Twitch streamers ${suits}.</p>

<h3>What You Get</h3>
<ul>
${files.map(([f, why]) => `<li>${f}, ${why}</li>`).join('\n')}
</ul>

<h3>Works With</h3>
<ul>
${worksWithLines(works, slBuild).map((l) => `<li>${l}</li>`).join('\n')}
</ul>

<h3>Setup</h3>
<ol>
${setup.map((s) => `<li>${s}</li>`).join('\n')}
</ol>
<p>Setup is manual and takes about 10 to 15 minutes.</p>

<h3>Customizable</h3>
<ul>
<li>Colour, to match your channel's branding</li>
<li>Font and font size</li>
<li>Goal type, choose between ${goalList}</li>
</ul>

<h3>FAQ</h3>
<p><strong>What software do I need to use the ${name}?</strong></p>
<p>You need a free StreamElements account to set up the widget and ${works.includes('Streamlabs') ? 'either OBS Studio or Streamlabs Desktop' : 'OBS Studio'} to show it on your Twitch stream as a browser source.</p>
<p><strong>Does this work with Streamlabs?</strong></p>
<p>${slAnswer}</p>
<p><strong>Can I change the colours and font?</strong></p>
<p>Yes. The ${name} colour, font, and font size are all customizable so it can match your channel's branding.</p>
<p><strong>What goal types can I track?</strong></p>
<p>The ${name} supports ${andList(goals)} goals, and you pick which one it tracks in the widget's settings.</p>
<p><strong>Is this a physical product?</strong></p>
<p>No. This is a digital download only. Nothing physical is shipped, and the files are for your own personal stream use, not for redistribution or resale.</p>

<h3>Good To Know</h3>
<p>This is a digital download only. No physical product is shipped, and the files are for your own personal stream use, not for redistribution or resale.</p>
<p>${REFUND}</p>`;
}

/* Assertions. Nothing is written unless every one of these holds. */
const errors = [];
const rows = [];
for (const spec of SPECS) {
  const row = src[spec.handle];
  if (!row) {
    errors.push(`${spec.handle}: not in the prepared batch`);
    continue;
  }
  // 1. the drafted file list is identical AS A SET to the Etsy manifest
  const manifest = new Set((row.etsy_files || []).map((f) => f.filename));
  const drafted = new Set(spec.files.map((f) => f[0]));
  const missing = [...manifest].filter((f) => !drafted.has(f));
  const invented = [...drafted].filter((f) => !manifest.has(f));
  if (missing.length || invented.length)
    errors.push(
      `${spec.handle}: file set mismatch. missing=${JSON.stringify(missing)} invented=${JSON.stringify(invented)}`,
    );
  // 2. slBuild must match the manifest, not the spec author's memory
  const manifestHasSL = [...manifest].some((f) => /streamlab/i.test(f));
  if (manifestHasSL !== spec.slBuild)
    errors.push(`${spec.handle}: slBuild=${spec.slBuild} but manifest Streamlabs artifact=${manifestHasSL}`);

  const html = render(spec, row);

  // 3. no en or em dash
  if (/[–—]/.test(html)) errors.push(`${spec.handle}: contains an en or em dash`);
  // 4. none of youtube / kick / tiktok
  for (const p of ['youtube', 'kick', 'tiktok']) {
    if (new RegExp(`\\b${p}\\b`, 'i').test(html.replace(/tik[\s-]?tok/gi, 'tiktok')))
      errors.push(`${spec.handle}: names ${p}`);
  }
  // 5. the refund paragraph is the approved wording, exactly
  if (!html.includes(REFUND)) errors.push(`${spec.handle}: refund paragraph not exact`);
  // 6. every platform the draft claims in Works With is in works_with
  for (const p of ['Streamlabs', 'StreamElements', 'OBS', 'Twitch']) {
    const inWorks = (row.works_with || []).some((w) => new RegExp(p, 'i').test(w));
    const claimed = new RegExp(`<li>${p}`, 'i').test(html);
    if (claimed && !inWorks) errors.push(`${spec.handle}: Works With claims ${p}, metafield does not`);
  }
  // 8. no repeated four word run. The first draft of this generator emitted
  //    "streamers who want streamers who want" because the spec fragment and
  //    the template both carried the lead in, and every other assertion here
  //    passed on it.
  {
    const words = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().split(' ');
    for (let i = 0; i + 8 <= words.length; i++) {
      const a = words.slice(i, i + 4).join(' ');
      const b = words.slice(i + 4, i + 8).join(' ');
      if (a === b) { errors.push(`${spec.handle}: repeated phrase "${a}"`); break; }
    }
  }
  // 7. it is not the old text again
  if (html.trim() === (row.current_description_html || '').trim())
    errors.push(`${spec.handle}: unchanged`);

  rows.push({handle: spec.handle, shopify_product_id: row.shopify_product_id, descriptionHtml: html});
}

if (errors.length) {
  console.error(`REFUSED, ${errors.length} assertion failure(s):`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}

const OUT = `${ROOT}/data/description-batch-written.json`;
fs.writeFileSync(OUT, JSON.stringify({generated_at: new Date().toISOString(), batch: 6, rows}, null, 2));
console.log(`OK: ${rows.length} description(s), all assertions passed. Wrote ${path.relative(ROOT, OUT)}`);
