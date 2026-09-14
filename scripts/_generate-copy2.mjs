import {readFileSync, writeFileSync} from 'node:fs';

const ROOT = '/Users/todd/Documents/orgs/SWS/repos/sws-storefront';
const cand = JSON.parse(readFileSync(`${ROOT}/data/copy-candidates-top35.json`, 'utf8'));
const byId = Object.fromEntries(cand.map((c) => [String(c.etsy_listing_id), c]));
const family1 = JSON.parse(readFileSync(`${ROOT}/data/_family1-results.json`, 'utf8'));

const results = [...family1];

// ---------- Family 2: StreamElements-only Chat and Goal widgets (Twitch, OBS, StreamElements) ----------

function family2Desc({intro, files, extraFaq = []}) {
  return `<p>${intro}</p>
<h3>What You Get</h3>
<ul>
${files.map((f) => `<li>${f}</li>`).join('\n')}
</ul>
<h3>Works With</h3>
<ul>
<li>Twitch</li>
<li>OBS Studio</li>
<li>StreamElements</li>
</ul>
<h3>Setup</h3>
<ol>
<li>Open your StreamElements overlay editor and add a custom widget</li>
<li>Paste in the chat and goal code files from your download</li>
<li>Resize and position each widget, then add the overlay link to OBS Studio as a Browser Source</li>
<li>Set your goal target and accent colour</li>
</ol>
<p>Typical setup time: about 10 to 15 minutes.</p>
<h3>Customizable</h3>
<ul>
<li>Accent colour</li>
<li>Show or hide pronouns</li>
<li>Show or hide badges</li>
<li>Chat message limit</li>
<li>Ignore specific users</li>
<li>Message alignment, top or bottom</li>
</ul>
<h3>FAQ</h3>
<p><strong>Does this widget read chat from more than Twitch?</strong></p>
<p>No, this is a StreamElements custom widget for Twitch chat only, run through OBS Studio as a Browser Source.</p>
<p><strong>What events show up in chat?</strong></p>
<p>Follower, subscriber, tip and cheer alerts are shown inline in the chat feed.</p>
<p><strong>What can I customize?</strong></p>
<p>The accent colour, pronoun and badge visibility, message limit, ignored users, and whether messages align to the top or bottom.</p>
<p><strong>What do I receive after purchase?</strong></p>
<p>The StreamElements chat and goal widget code files plus a written setup guide, delivered as an instant digital download.</p>
${extraFaq.map((f) => `<p><strong>${f.q}</strong></p>\n<p>${f.a}</p>`).join('\n')}`.trim();
}

const family2Items = [
  {
    id: '4322607453',
    title: 'Moon Galaxy Chat and Goal Widget for Twitch | Butterfly Glass Theme',
    seoTitle: 'Moon Galaxy Chat and Goal Widget for Twitch',
    seoDesc: 'Starry butterfly galaxy chat and goal widget for Twitch, glassy transparent theme, runs on StreamElements and OBS Studio.',
    intro: 'A starry butterfly galaxy themed chat and goal widget for Twitch, glassy and transparent for VTubers and streamers who want a minimal celestial look.',
    files: ['chatandgoalcoad.zip, the StreamElements chat and goal widget code', 'OrnamentsMOV.zip, animated webcam ornament videos', 'ornamentsmov1.zip, additional animated ornament videos', 'chatboxandwebcamornaments.zip, chat box and webcam decoration files', 'manuallychatGoalWidgetTutorial.pdf, the setup guide'],
  },
  {
    id: '4310437865',
    title: 'Lotus Butterfly Chat and Goal Widget for Twitch | Glass Theme',
    seoTitle: 'Lotus Butterfly Chat and Goal Widget for Twitch',
    seoDesc: 'Lotus butterfly chat and goal widget for Twitch, glassy transparent theme, runs on StreamElements and OBS Studio.',
    intro: 'A lotus and butterfly themed chat and goal widget for Twitch, glassy and transparent for VTubers and streamers who want a minimal elegant look.',
    files: ['lotuschat.zip, the StreamElements chat widget code', 'ButterflyGoal.zip, the StreamElements goal widget code', 'PresentationOrnamentsVIdeo.zip, animated ornament decoration videos', 'manuallychatGoalWidgetTutorial.pdf, the setup guide'],
  },
  {
    id: '4315451056',
    title: 'Red Floral Chat and Goal Widget for Twitch | Mystical Starry Theme',
    seoTitle: 'Red Floral Chat and Goal Widget for Twitch',
    seoDesc: 'Classical red floral chat and goal widget for Twitch, mystical starry theme, runs on StreamElements and OBS Studio.',
    intro: 'A classical red floral chat and goal widget for Twitch with a mystical, starry autumn theme, for streamers who want a calm fall-themed chat box.',
    files: ['ChatandGoalCode.zip, the StreamElements chat and goal widget code', 'WebcamAndChatbox.zip, webcam frame and chat box decoration files', 'OrnamentsVideo.zip, animated ornament decoration video', 'manuallychatGoalWidgetTutorial.pdf, the setup guide'],
  },
  {
    id: '4328622333',
    title: 'Lotus Glass Chat and Goal Widget for Twitch | Floral Theme',
    seoTitle: 'Lotus Glass Chat and Goal Widget for Twitch',
    seoDesc: 'Dreamy lotus glass chat and goal widget for Twitch, floral glassy theme, runs on StreamElements and OBS Studio.',
    intro: 'A dreamy lotus themed chat and goal widget for Twitch, glassy and floral for VTubers and streamers who want a minimal elegant look.',
    files: ['ChatandGoalCode.zip, the StreamElements chat and goal widget code', 'WebcamandChatbox.zip, webcam frame and chat box decoration files', 'Ornaments.zip, decorative ornament files', 'manuallychatGoalWidgetTutorial.pdf, the setup guide'],
  },
  {
    id: '4333468758',
    title: 'Lunar Cat Chat and Goal Widget for Twitch | Purple Cosmic Theme',
    seoTitle: 'Lunar Cat Chat and Goal Widget for Twitch',
    seoDesc: 'Lunar cat chat and goal widget for Twitch, purple cosmic theme, runs on StreamElements and OBS Studio.',
    intro: 'A lunar cat themed chat and goal widget for Twitch with a light purple, celestial look, for kawaii and VTuber streamers.',
    files: ['Chatandgoalcode.zip, the StreamElements chat and goal widget code', 'Decoration.zip, decorative ornament files', 'WebcamandChatbox.zip, webcam frame and chat box decoration files', 'manuallychatGoalWidgetTutorial.pdf, the setup guide'],
  },
];

for (const it of family2Items) {
  const c = byId[it.id];
  results.push({
    handle: c.handle,
    etsy_listing_id: c.etsy_listing_id,
    etsy_units_45d: c.units_45d,
    current_title: c.shopify_title,
    title: it.title,
    descriptionHtml: family2Desc({intro: it.intro, files: it.files}),
    seo_title: it.seoTitle,
    seo_description: it.seoDesc,
    works_with: ['Twitch', 'OBS', 'StreamElements'],
    works_with_evidence: 'listing_body',
    notes: '',
  });
}

// ---------- Unique items ----------

// 1) Sakura Animated Twitch Chat Widget (has a real Works With section: StreamElements, OBS Studio; file manifest shows a goal widget file the prose omits)
{
  const id = '4505167275';
  const c = byId[id];
  const html = `<p>Soft falling petals and glassy pink chat bubbles for a cozy, dreamy Twitch stream. Built for cozy streamers, kawaii setups, VTubers and anyone who wants their chat to feel warm and intentional.</p>
<h3>What You Get</h3>
<ul>
<li>SakuraFloralChatHoraizontal.zip, the horizontal chat widget code</li>
<li>SakuraFloralChatVertical.zip, the vertical chat widget code</li>
<li>SakuraFloralGoalWidget.zip, the matching goal widget code</li>
<li>ManuallySetupGoalWidgetTutorial.pdf, the setup guide</li>
</ul>
<h3>Works With</h3>
<ul>
<li>Twitch</li>
<li>StreamElements</li>
<li>OBS Studio</li>
</ul>
<h3>Setup</h3>
<ol>
<li>Open your StreamElements overlay editor</li>
<li>Add a custom widget and paste in the chat or goal code from your download</li>
<li>Resize and position it in OBS Studio</li>
<li>Pick horizontal or vertical layout for the chat widget</li>
</ol>
<p>Typical setup time: about 5 minutes per widget.</p>
<h3>Customizable</h3>
<ul>
<li>Bubble colour</li>
<li>Username and message font and colour</li>
<li>Background transparency</li>
<li>Petal animation</li>
</ul>
<h3>FAQ</h3>
<p><strong>Is there a matching goal widget?</strong></p>
<p>Yes, a Sakura-themed goal widget code file is included alongside the chat widget.</p>
<p><strong>Can I choose a horizontal or vertical chat layout?</strong></p>
<p>Yes, both a horizontal and a vertical version of the chat widget are included in the download.</p>
<p><strong>Does this work with Kick or YouTube chat?</strong></p>
<p>No, this listing reads Twitch chat through StreamElements only.</p>
<p><strong>What can I customize?</strong></p>
<p>Bubble colour, username and message font and colour, background transparency, and the falling petal animation, all inside the StreamElements editor.</p>`;
  results.push({
    handle: c.handle,
    etsy_listing_id: c.etsy_listing_id,
    etsy_units_45d: c.units_45d,
    current_title: c.shopify_title,
    title: 'Sakura Chat and Goal Widget for Twitch | Cherry Blossom Glass Theme',
    descriptionHtml: html,
    seo_title: 'Sakura Chat and Goal Widget for Twitch',
    seo_description: 'Kawaii cherry blossom chat and goal widget for Twitch, glassy pink bubbles, works with StreamElements and OBS Studio.',
    works_with: ['Twitch', 'OBS', 'StreamElements'],
    works_with_evidence: 'listing_body',
    notes: 'Listing prose only mentions the chat widget; file manifest also shows SakuraFloralGoalWidget.zip, included in What You Get and title.',
  });
}

// 2) Waylay Cyberpunk chat and goal widget
{
  const id = '1904169495';
  const c = byId[id];
  const html = `<p>A futuristic cyberpunk neon chat and goal widget for Twitch, built for gamers, VTubers and creators who want a glowing, modern stream aesthetic.</p>
<h3>What You Get</h3>
<ul>
<li>WaylayChatStreamElementsCode.zip, the StreamElements chat widget code</li>
<li>WaylayGoalStreamElementsCode.zip, the StreamElements goal widget code</li>
<li>manuallychatGoalWidgetTutorial.pdf, the setup guide</li>
</ul>
<h3>Works With</h3>
<ul>
<li>Twitch</li>
<li>OBS Studio</li>
<li>StreamElements</li>
</ul>
<h3>Setup</h3>
<ol>
<li>Open your StreamElements overlay editor and add a custom widget</li>
<li>Paste in the chat and goal code files from your download</li>
<li>Add the overlay link to OBS Studio as a Browser Source</li>
<li>Set your accent colours and goal target</li>
</ol>
<p>Typical setup time: about 10 to 15 minutes.</p>
<h3>Customizable</h3>
<ul>
<li>Accent colours</li>
<li>Show or hide pronouns</li>
<li>Show or hide badges</li>
<li>Message limit</li>
<li>Ignore specific users</li>
<li>Top or bottom message alignment</li>
</ul>
<h3>FAQ</h3>
<p><strong>Does this widget read chat from more than Twitch?</strong></p>
<p>No, this is a StreamElements custom widget for Twitch chat only, run through OBS Studio as a Browser Source.</p>
<p><strong>Does it include a goal widget too?</strong></p>
<p>Yes, a matching cyberpunk goal widget code file is included alongside the chat widget.</p>
<p><strong>What can I customize?</strong></p>
<p>Accent colours, pronoun and badge visibility, message limit, ignored users, and message alignment.</p>
<p><strong>What do I receive after purchase?</strong></p>
<p>The StreamElements chat and goal widget code files plus a written setup guide, delivered as an instant digital download.</p>`;
  results.push({
    handle: c.handle,
    etsy_listing_id: c.etsy_listing_id,
    etsy_units_45d: c.units_45d,
    current_title: c.shopify_title,
    title: 'Cyberpunk Chat and Goal Widget for Twitch | Neon Gamer Theme',
    descriptionHtml: html,
    seo_title: 'Cyberpunk Chat and Goal Widget for Twitch',
    seo_description: 'Animated neon cyberpunk chat and goal widget for Twitch, works with StreamElements and OBS Studio. Built for gamers and VTubers.',
    works_with: ['Twitch', 'OBS', 'StreamElements'],
    works_with_evidence: 'listing_body',
    notes: '',
  });
}

// 3) Pastel Glow chat widget (chat only, explicitly "StreamElements only")
{
  const id = '4341725255';
  const c = byId[id];
  const html = `<p>A minimal pastel chat bubble widget for Twitch, set up through StreamElements and OBS, for streamers who want a soft, clean chat overlay.</p>
<h3>What You Get</h3>
<ul>
<li>MultipleColorChatStreamElementsCode.zip, the StreamElements chat widget code</li>
<li>ManuallySetupchatWidgetTutorial.pdf, the setup guide</li>
</ul>
<h3>Works With</h3>
<ul>
<li>Twitch</li>
<li>OBS Studio</li>
<li>StreamElements</li>
</ul>
<h3>Setup</h3>
<ol>
<li>Open your StreamElements overlay editor and add a custom widget</li>
<li>Paste in the chat widget code from your download</li>
<li>Add the overlay link to OBS Studio as a Browser Source</li>
<li>Pick your accent colour</li>
</ol>
<p>Typical setup time: about 5 to 10 minutes.</p>
<h3>Customizable</h3>
<ul>
<li>Accent colour</li>
<li>Show or hide pronouns</li>
<li>Show or hide badges</li>
<li>Message limit</li>
<li>Ignore specific users</li>
<li>Top or bottom message alignment</li>
</ul>
<h3>FAQ</h3>
<p><strong>Does this widget read chat from more than Twitch?</strong></p>
<p>No, this listing is StreamElements only, reading Twitch chat and set up through OBS.</p>
<p><strong>Is there a matching goal widget?</strong></p>
<p>No, this listing is a chat widget only.</p>
<p><strong>What can I customize?</strong></p>
<p>Accent colour, pronoun and badge visibility, message limit, ignored users, and message alignment.</p>
<p><strong>What do I receive after purchase?</strong></p>
<p>The StreamElements chat widget code file plus a written setup guide, delivered as an instant digital download.</p>`;
  results.push({
    handle: c.handle,
    etsy_listing_id: c.etsy_listing_id,
    etsy_units_45d: c.units_45d,
    current_title: c.shopify_title,
    title: 'Pastel Glow Chat Widget for Twitch | Minimal Bubble Theme',
    descriptionHtml: html,
    seo_title: 'Pastel Glow Chat Widget for Twitch, Minimal',
    seo_description: 'Minimal pastel chat bubble widget for Twitch, StreamElements only, set up through OBS Studio. Colour and font editable.',
    works_with: ['Twitch', 'OBS', 'StreamElements'],
    works_with_evidence: 'listing_body',
    notes: 'File manifest has one chat code zip only, no goal file; kept as Chat Widget despite generic body bullet mentioning a goal widget.',
  });
}

// 4) Spooky Halloween Stream Kit - genuine multistream, code-verified
{
  const id = '4570446087';
  const c = byId[id];
  const html = `<p>Eight animated Halloween overlays in one download: three chat widgets and five goal bars for Twitch, YouTube and Kick streamers who want to dress a whole channel for October at once.</p>
<h3>What You Get</h3>
<ul>
<li>Spooky-Stream-Kit.zip, containing all 8 widgets as StreamElements code files (HTML, CSS, JS, Fields, Data), Streamlabs versions where available, and an illustrated PDF setup guide for each widget</li>
</ul>
<h3>Works With</h3>
<ul>
<li>Twitch</li>
<li>YouTube</li>
<li>Kick</li>
<li>TikTok</li>
<li>OBS Studio</li>
<li>Streamlabs</li>
<li>StreamElements</li>
</ul>
<h3>Setup</h3>
<ol>
<li>Create a custom widget in StreamElements and paste in the code for each of the 8 widgets, one at a time</li>
<li>Drop each overlay link into OBS Studio or Streamlabs as a Browser Source</li>
<li>For the exclusive Spooky Multistream Chat Widget, connect only the platforms you use: Kick needs your channel name and chatroom ID, YouTube needs a free YouTube Data API key, TikTok uses the free TikFinity desktop app</li>
<li>Leave any platform blank on the multistream widget to ignore it</li>
</ol>
<p>Typical setup time: about 5 minutes per widget, every folder has the same shape.</p>
<h3>Customizable</h3>
<ul>
<li>Colour, Google Font, weight and size on every widget</li>
<li>Goal targets and labels</li>
<li>Alert colours</li>
<li>Message limit and alignment</li>
<li>Widget scale</li>
</ul>
<h3>FAQ</h3>
<p><strong>Which widget in the kit reads chat from Kick, YouTube and TikTok?</strong></p>
<p>Only the exclusive Spooky Multistream Chat Widget, not sold separately. The other two chat widgets and all five goal bars run on StreamElements and show whatever it is connected to, which is Twitch by default.</p>
<p><strong>Do I need to buy or set up separate software for Kick, YouTube or TikTok?</strong></p>
<p>No extra purchase. Kick needs your channel name and chatroom ID, YouTube needs a free YouTube Data API key, and TikTok uses the free TikFinity desktop app.</p>
<p><strong>How many widgets are in this kit, and can I buy the multistream one alone?</strong></p>
<p>Eight widgets total. The Spooky Multistream Chat Widget is exclusive to this kit and is not sold as a separate listing.</p>
<p><strong>What software do I need to run this?</strong></p>
<p>A free StreamElements account plus OBS Studio or Streamlabs. No paid software is required.</p>`;
  results.push({
    handle: c.handle,
    etsy_listing_id: c.etsy_listing_id,
    etsy_units_45d: c.units_45d,
    current_title: c.shopify_title,
    title: 'Spooky Halloween Stream Kit | 8 Widgets for Twitch, YouTube, Kick',
    descriptionHtml: html,
    seo_title: 'Spooky Halloween Stream Kit, 8 Widgets',
    seo_description: 'Halloween overlay kit: 8 animated chat and goal widgets for Twitch, YouTube, Kick and TikTok. StreamElements, OBS, Streamlabs.',
    works_with: ['Twitch', 'YouTube', 'Kick', 'TikTok', 'OBS', 'Streamlabs', 'StreamElements'],
    works_with_evidence: 'code',
    notes: 'Only bundle-level product with code-verified multistream (kick/youtube/tiktok/streamlabs all true in widget-code-signals.json for 4570446087).',
  });
}

writeFileSync(`${ROOT}/data/copy-proposal-2026-09-13.json`, JSON.stringify(results, null, 2) + '\n');
console.log('Total products:', results.length);
