/**
 * BAT-172 batch 4, 2026-09-19. Generates ten description rewrites from a per
 * product spec and asserts them against the prepared batch BEFORE anything is
 * sent. Hand typing a filename into "What You Get" is a claim about what the
 * buyer receives and every live audit exits 0 on a wrong one, so the file set
 * is compared to the Etsy manifest as a SET, not eyeballed.
 *
 * Usage: node scripts/one-off/2026-09-19-batch4.mjs
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
 * browser source" and "there is a Streamlabs build in the download". Three of
 * these ship one and five do not, and saying it the same way for both would
 * be an overclaim on five products.
 */
const SPECS = [
  {
    handle: 'star-bottle-glass-goal-widget-cute-minimal-customizable-goal-widget-for-twitch-tiktok-studio-streamelements-streamlabs-obs',
    name: 'Star Bottle Glass Goal Widget',
    what: 'an animated liquid fill goal tracker shaped like a slim glass bottle of stars',
    suits: 'who want a clean, minimal overlay that still reads at a glance',
    goals: ['donation', 'follower', 'bits', 'support'],
    slBuild: false,
    files: [
      ['Starbottlegoalcode.zip', 'the widget code, uploaded as a custom widget'],
      ['HowToSetupGoalWidgetTutorial.pdf', 'the step by step setup guide'],
    ],
  },
  {
    handle: 'gothic-bottle-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
    name: 'Gothic Bottle Goal Widget',
    what: 'an animated liquid fill goal tracker shaped like a dark apothecary bottle',
    suits: 'running a gothic, witchy or horror channel',
    goals: ['donation', 'follower', 'bits', 'support'],
    slBuild: true,
    files: [
      ['ManuallySetupGoalWidgetTutorial.pdf', 'the step by step setup guide'],
      ['Streamelements.zip', 'the StreamElements build, uploaded as a custom widget'],
      ['Streamlabs.zip', 'the Streamlabs build'],
    ],
  },
  {
    handle: 'halloween-eye-potion-bottle-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
    name: 'Halloween Eye Potion Bottle Goal Widget',
    what: 'an animated liquid fill goal tracker shaped like a potion bottle with an eye floating in it',
    suits: 'building a Halloween or spooky season layout',
    goals: ['donation', 'follower', 'bits', 'support'],
    slBuild: true,
    files: [
      ['ManuallySetupGoalWidgetTutorial.pdf', 'the step by step setup guide'],
      ['EyePotionStreamelements.zip', 'the StreamElements build, uploaded as a custom widget'],
      ['EyePotionBottleStreamlabs.zip', 'the Streamlabs build'],
    ],
  },
  {
    handle: 'envelope-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-stream-elements',
    name: 'Envelope Goal Widget',
    what: 'an animated liquid fill goal tracker shaped like a glassy sealed envelope',
    suits: 'who want a soft, papery overlay for a cosy or just chatting scene',
    goals: ['donation', 'follower', 'bits', 'support'],
    slBuild: true,
    files: [
      ['ManuallySetupGoalWidgetTutorial.pdf', 'the step by step setup guide'],
      ['GlassyEnvelopStreamelements.zip', 'the StreamElements build, uploaded as a custom widget'],
      ['EnvelopGoalStreamlabs.zip', 'the Streamlabs build'],
    ],
  },
  {
    handle: 'cute-cow-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
    name: 'Cute Cow Goal Widget',
    what: 'an animated liquid fill goal tracker shaped like a round little cow',
    suits: 'who want a soft, farmcore overlay for support goals',
    goals: ['donation', 'follower', 'bits', 'support'],
    slBuild: true,
    files: [
      ['HowToSetupGoalWidgetTutorial.pdf', 'the step by step setup guide'],
      ['Streamelements.zip', 'the StreamElements build, uploaded as a custom widget'],
      ['Streamlabs.zip', 'the Streamlabs build'],
      ['Cowanothercolor-data.zip', 'a second colourway of the same cow'],
    ],
  },
  {
    handle: 'full-moon-bar-loading-goal-widget-is-fully-customisable-for-twitch-streamelements-and-obs-bar-goal-widget',
    name: 'Full Moon Bar Goal Widget',
    what: 'an animated bar style goal tracker that fills across a full moon',
    suits: 'who want a horizontal progress bar rather than a filling vessel',
    goals: ['donation', 'follower', 'bits', 'support'],
    slBuild: false,
    files: [
      ['BrokenMoonStreamElementscode.zip', 'the widget code, uploaded as a custom widget'],
      ['HowToSetupGoalWidgetTutorial.pdf', 'the step by step setup guide'],
    ],
  },
  {
    handle: 'cute-sea-horse-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
    name: 'Cute Sea Horse Goal Widget',
    what: 'an animated liquid fill goal tracker shaped like a little sea horse',
    suits: 'running an ocean, mermaid or pastel aquatic theme',
    goals: ['donation', 'follower', 'bits', 'support'],
    slBuild: false,
    files: [
      ['SeahorseGoalCode.zip', 'the widget code, uploaded as a custom widget'],
      ['HowToSetupGoalWidgetTutorial.pdf', 'the step by step setup guide'],
    ],
  },
  {
    handle: 'snowman-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
    name: 'Snowman Goal Widget',
    what: 'an animated liquid fill goal tracker shaped like a stacked snowman',
    suits: 'putting together a winter or holiday season layout',
    goals: ['donation', 'follower', 'bits', 'support'],
    slBuild: false,
    files: [
      ['SnowManUpdateFileforUpload.zip', 'the widget code, uploaded as a custom widget'],
      ['HowToSetupGoalWidgetTutorial.pdf', 'the step by step setup guide'],
    ],
  },
  {
    handle: 'game-machine-old-arcade-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
    name: 'Arcade Machine Goal Widget',
    what: 'an animated liquid fill goal tracker shaped like an old upright arcade cabinet',
    suits: 'on retro gaming and variety channels',
    goals: ['donation', 'follower', 'bits', 'sub'],
    slBuild: true,
    files: [
      ['HowToSetupGoalWidgetTutorial.pdf', 'the step by step setup guide'],
      ['StreamElementscode.zip', 'the StreamElements build, uploaded as a custom widget'],
      ['MachineStreamlab.zip', 'the Streamlabs build'],
    ],
  },
  {
    handle: 'sparkling-diamond-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
    name: 'Sparkling Diamond Goal Widget',
    what: 'an animated liquid fill goal tracker shaped like a cut sparkling diamond',
    suits: 'who want a bright, jewel toned overlay',
    goals: ['donation', 'follower', 'bits', 'support'],
    slBuild: true,
    files: [
      ['DiamondStreamlabCode.zip', 'the Streamlabs build'],
      ['DiamondStreamElementscode.zip', 'the StreamElements build, uploaded as a custom widget'],
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
fs.writeFileSync(OUT, JSON.stringify({generated_at: new Date().toISOString(), batch: 4, rows}, null, 2));
console.log(`OK: ${rows.length} description(s), all assertions passed. Wrote ${path.relative(ROOT, OUT)}`);
