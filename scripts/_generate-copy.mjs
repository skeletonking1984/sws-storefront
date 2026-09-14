import {readFileSync, writeFileSync} from 'node:fs';

const ROOT = '/Users/todd/Documents/orgs/SWS/repos/sws-storefront';
const cand = JSON.parse(readFileSync(`${ROOT}/data/copy-candidates-top35.json`, 'utf8'));
const source = JSON.parse(readFileSync(`${ROOT}/data/copy-source-2026-09-13.json`, 'utf8'));

const byId = Object.fromEntries(cand.map((c) => [String(c.etsy_listing_id), c]));

// Shared platform sets
const PLAT_FAMILY1 = ['Twitch', 'OBS', 'Streamlabs', 'StreamElements'];
const PLAT_FAMILY1_NOLABS = ['Twitch', 'OBS', 'StreamElements'];
const PLAT_FAMILY2 = ['Twitch', 'OBS', 'StreamElements'];

const filesUl = (files) => `<ul>\n${files.map((f) => `<li>${f}</li>`).join('\n')}\n</ul>`;
const worksWithUl = (plats) => `<ul>\n${plats.map((p) => `<li>${p}</li>`).join('\n')}\n</ul>`;

function family1Desc({intro, files, streamlabs, goalTypes, extraCustom = [], extraFaq = []}) {
  const platforms = streamlabs ? PLAT_FAMILY1 : PLAT_FAMILY1_NOLABS;
  const setupSteps = streamlabs
    ? [
        'Open the included code file for your service, StreamElements or Streamlabs',
        'Paste it into a new custom widget (StreamElements) or theme (Streamlabs)',
        'Add the widget as a Browser Source in OBS or Streamlabs',
        'Set your goal target and pick which events count toward it',
      ]
    : [
        'Create a custom widget in StreamElements and paste in the code file',
        'Add the widget as a Browser Source in OBS Studio',
        'Set your goal target and pick which events count toward it',
      ];
  const streamlabsFaq = streamlabs
    ? {
        q: 'Does this work with Streamlabs?',
        a: 'Yes, the download includes a Streamlabs-compatible version alongside the StreamElements code file. Add either as a Browser Source in OBS Studio or Streamlabs.',
      }
    : {
        q: 'Does this work with Streamlabs?',
        a: 'No, this widget ships as a StreamElements custom widget only. Add it in OBS Studio as a Browser Source through StreamElements.',
      };
  const html = `<p>${intro}</p>
<h3>What You Get</h3>
${filesUl(files)}
<h3>Works With</h3>
${worksWithUl(platforms)}
<h3>Setup</h3>
<ol>
${setupSteps.map((s) => `<li>${s}</li>`).join('\n')}
</ol>
<p>Typical setup time: about 10 to 15 minutes, done manually through StreamElements or Streamlabs.</p>
<h3>Customizable</h3>
<ul>
<li>Colour</li>
<li>Font</li>
<li>Font size</li>
${extraCustom.map((c) => `<li>${c}</li>`).join('\n')}
</ul>
<h3>FAQ</h3>
<p><strong>What events count toward the goal?</strong></p>
<p>${goalTypes}, set inside the StreamElements or Streamlabs widget editor.</p>
<p><strong>${streamlabsFaq.q}</strong></p>
<p>${streamlabsFaq.a}</p>
<p><strong>What can I customize?</strong></p>
<p>Colour, font and font size, edited directly in the widget code before you upload it, no coding needed beyond pasting the file.</p>
<p><strong>What do I receive after purchase?</strong></p>
<p>A video walkthrough plus the widget code file${files.some((f) => /\.pdf/i.test(f)) ? ' and a written setup guide' : ''}, delivered as an instant digital download.</p>
${extraFaq.map((f) => `<p><strong>${f.q}</strong></p>\n<p>${f.a}</p>`).join('\n')}`;
  return html.trim();
}

const goalTypesStd = 'Donations, followers, bit cheers and support events each add progress';

const items = [];

function push(obj) {
  items.push(obj);
}

// ---------- Family 1 (liquid filling / bar, Twitch+OBS+Streamlabs+StreamElements) ----------

push({
  id: '1758361648',
  title: 'Pumpkin Goal Widget for Twitch | Liquid Fill Halloween Tracker',
  seoTitle: 'Pumpkin Goal Widget for Twitch, Halloween Tracker',
  seoDesc: 'Animated pumpkin liquid-fill goal widget for Twitch via StreamElements or Streamlabs. Halloween theme, customizable colour and font.',
  intro: 'A cute animated pumpkin that fills up as your stream goal progresses, built for Twitch streamers who want a Halloween-themed sub or donation tracker.',
  files: ['PumpkinCode.zip, the StreamElements widget code', 'OneClickInstallation.pdf, a one-click install guide', 'ManuallySetupGoalWidgetTutorial.pdf, the manual setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
});

push({
  id: '1888424656',
  title: 'Broken Star Bar Goal Widget for Twitch | OBS StreamElements',
  seoTitle: 'Broken Star Bar Goal Widget for Twitch, OBS',
  seoDesc: 'Customizable broken star bar goal widget for Twitch, runs on StreamElements and OBS Studio. Colour, font and font size editable.',
  intro: 'A broken star bar goal tracker for Twitch streamers, the bar fills and the star cracks open as your channel gets closer to its goal.',
  files: ['BrokenStarStreamElementscode.zip, the StreamElements widget code', 'HowToSetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: false,
  goalTypes: goalTypesStd,
});

push({
  id: '1902602881',
  title: 'Broken Heart Bar Goal Widget for Twitch | OBS StreamElements',
  seoTitle: 'Broken Heart Bar Goal Widget for Twitch, OBS',
  seoDesc: 'Customizable broken heart bar goal widget for Twitch, runs on StreamElements and OBS Studio. Colour, font and font size editable.',
  intro: 'A broken heart bar goal tracker for Twitch streamers, the bar fills and mends as your channel gets closer to its sub or donation goal.',
  files: ['BrokenHeartStreamElementscode.zip, the StreamElements widget code', 'HowToSetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: false,
  goalTypes: goalTypesStd,
});

push({
  id: '1785478023',
  title: 'Spooky Cauldron Goal Widget for Twitch | Halloween Liquid Fill',
  seoTitle: 'Spooky Cauldron Goal Widget for Twitch',
  seoDesc: 'Animated liquid-filling cauldron goal widget for Twitch, works with StreamElements, Streamlabs and OBS. Halloween theme.',
  intro: 'A bubbling cauldron goal widget for Twitch streamers running a Halloween-themed channel, the potion level rises as your goal fills.',
  files: ['couldrongoalwidgetcode1.zip, the widget code for StreamElements and Streamlabs', 'HowToSetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
});

push({
  id: '1792249804',
  title: 'Halloween Pumpkin Goal Widget for Twitch | Cat Pumpkin Liquid Fill',
  seoTitle: 'Halloween Pumpkin Goal Widget for Twitch',
  seoDesc: 'Animated cat pumpkin liquid-fill goal widget for Twitch, works with StreamElements, Streamlabs and OBS Studio.',
  intro: 'A Halloween cat-pumpkin goal widget for Twitch streamers, the pumpkin fills as followers, donations, bits and support come in.',
  files: ['CatPumpkinGoal.zip, the widget code for StreamElements and Streamlabs', 'HowToSetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
});

push({
  id: '1881347726',
  title: 'Charizard Goal Widget for Twitch | Fan Art Liquid Fill Tracker',
  seoTitle: 'Charizard Goal Widget for Twitch, Fan Art',
  seoDesc: 'Charizard-themed fan art liquid-fill goal widget for Twitch, works with StreamElements and Streamlabs. Colour and font editable.',
  intro: 'A Charizard fan-art goal widget for Twitch streamers, an animated liquid fill tracker themed around the character for VTubers and gaming channels.',
  files: ['CharizardGoalWidgetCodes.zip, the widget code for StreamElements and Streamlabs', 'HowToSetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
});

push({
  id: '1780969806',
  title: 'Devil and Angel Goal Widget for Twitch | Combo Liquid Fill',
  seoTitle: 'Devil and Angel Goal Widget for Twitch',
  seoDesc: 'Devil and angel combo liquid-fill goal widget for Twitch, works with StreamElements, Streamlabs and OBS Studio.',
  intro: 'A devil and angel combo goal widget for Twitch streamers, two animated liquid-fill trackers in one download for a good vs evil themed channel.',
  files: ['angeldevilcode-updated.zip, the widget code for StreamElements and Streamlabs', 'HowToSetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
});

push({
  id: '1771354232',
  title: 'Bulbasaur Goal Widget for Twitch | Fan Art Liquid Fill Tracker',
  seoTitle: 'Bulbasaur Goal Widget for Twitch, Fan Art',
  seoDesc: 'Bulbasaur-themed fan art liquid-fill goal widget for Twitch, works with StreamElements and Streamlabs. Tracks followers and donations.',
  intro: 'A Bulbasaur fan-art goal widget for Twitch streamers, an animated liquid fill tracker themed around the character for VTubers and gaming channels.',
  files: ['BulbasaurGoalReadyforUpload.zip, the widget code for StreamElements and Streamlabs', 'HowToSetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
});

push({
  id: '1728586845',
  title: 'Panda Moon Goal Widget for Twitch | 3 Style Combo Liquid Fill',
  seoTitle: 'Panda Moon Goal Widget for Twitch, 3 Styles',
  seoDesc: 'Panda-themed goal widget for Twitch with 3 code styles: sleeping panda, star panda, balloon panda. StreamElements and Streamlabs.',
  intro: 'A cute panda goal widget for Twitch streamers, delivered as three separate animated styles so you can pick the one that matches your channel.',
  files: ['SleepingPandaCode.zip, the sleeping panda widget style', 'PandaStarCode.zip, the star panda widget style', 'PandaBallonCode.zip, the balloon panda widget style', 'pandaoneclickinstallition.pdf, a one-click install guide', 'ManuallySetupGoalWidgetTutorial.pdf, the manual setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
  extraFaq: [{q: 'How many panda styles are included?', a: 'Three: a sleeping panda, a star panda and a balloon panda, each its own widget code file so you can install just the one you want.'}],
});

push({
  id: '1712229820',
  title: 'Boba Drink Goal Widget for Twitch | Cute Liquid Fill Tracker',
  seoTitle: 'Boba Drink Goal Widget for Twitch, Liquid Fill',
  seoDesc: 'Boba drink liquid-fill goal widget for Twitch, works with StreamElements and Streamlabs. Colour, font and font size editable.',
  intro: 'A boba drink goal widget for Twitch streamers, the cup fills with bubble tea as followers, donations, bits and support come in.',
  files: ['CodeBobaDrinks.zip, the widget code for StreamElements and Streamlabs', 'HowToSetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
});

push({
  id: '1775661417',
  title: 'Spooky Bat Goal Widget for Twitch | Halloween Liquid Fill',
  seoTitle: 'Spooky Bat Goal Widget for Twitch, Halloween',
  seoDesc: 'Animated bat liquid-fill goal widget for Twitch, ships with separate StreamElements and Streamlabs code files.',
  intro: 'A spooky bat goal widget for Twitch streamers running a Halloween theme, the bat jar fills as your channel gets closer to its goal.',
  files: ['Bat_StreamElementscode.zip, the StreamElements widget code', 'Bat_StreamlabCode.zip, the Streamlabs widget code', 'HowToSetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
});

push({
  id: '1881257942',
  title: 'Eevee Goal Widget for Twitch | Fan Art Liquid Fill Tracker',
  seoTitle: 'Eevee Goal Widget for Twitch, Fan Art',
  seoDesc: 'Eevee-themed fan art liquid-fill goal widget for Twitch, works with StreamElements and Streamlabs. Colour and font editable.',
  intro: 'An Eevee fan-art goal widget for Twitch streamers, an animated liquid fill tracker themed around the character for VTubers and gaming channels.',
  files: ['EeveeGoalCodeReadyforUpload.zip, the widget code for StreamElements and Streamlabs', 'HowToSetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
});

push({
  id: '1895254409',
  title: 'Sea Horse Goal Widget for Twitch | Cute Liquid Fill Tracker',
  seoTitle: 'Sea Horse Goal Widget for Twitch, Liquid Fill',
  seoDesc: 'Sea horse liquid-fill goal widget for Twitch, works with StreamElements and Streamlabs. Colour, font and font size editable.',
  intro: 'A sea horse goal widget for Twitch streamers, an animated liquid fill tracker for cozy or underwater-themed channels.',
  files: ['SeahorseGoalCode.zip, the widget code for StreamElements and Streamlabs', 'HowToSetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
});

push({
  id: '1849162325',
  title: 'Cat Paw Goal Widget for Twitch | Alert Liquid Fill Tracker',
  seoTitle: 'Cat Paw Goal Widget for Twitch, Alert Widget',
  seoDesc: 'Cat paw liquid-fill alert goal widget for Twitch, ships with separate StreamElements and Streamlabs code files.',
  intro: 'A cat paw goal and alert widget for Twitch streamers, the paw fills as followers, donations, bits and support come in.',
  files: ['CatPaw-data.zip, the widget artwork and data files', 'Streamlabscode.zip, the Streamlabs widget code', 'streamelementscode.zip, the StreamElements widget code', 'HowToSetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
});

push({
  id: '1742236253',
  title: 'Owl Goal Widget for Twitch | Cute Liquid Fill Tracker',
  seoTitle: 'Owl Goal Widget for Twitch, Liquid Fill',
  seoDesc: 'Owl liquid-fill goal widget for Twitch, works with StreamElements and Streamlabs. Colour, font and font size editable.',
  intro: 'An owl goal widget for Twitch streamers, an animated liquid fill tracker for cozy or nature-themed channels.',
  files: ['NewOwlGoalWidget.zip, the widget code for StreamElements and Streamlabs', 'HowToSetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
});

push({
  id: '1797937195',
  title: 'Pastel Rainbow Cloud Goal Widget for Twitch | Kawaii Tracker',
  seoTitle: 'Pastel Rainbow Cloud Goal Widget for Twitch',
  seoDesc: 'Pastel rainbow cloud goal widget for Twitch, kawaii theme, works with StreamElements and Streamlabs.',
  intro: 'A pastel rainbow cloud goal widget for Twitch streamers with a kawaii aesthetic, tracking donations and followers as the cloud fills.',
  files: ['gradientcloudcode.zip, the gradient cloud widget code', 'cloudcode.zip, the base cloud widget code', 'ManuallySetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
});

push({
  id: '1747633766',
  title: 'Goth Spell Book Goal Widget for Twitch | Spooky Tracker',
  seoTitle: 'Goth Spell Book Goal Widget for Twitch',
  seoDesc: 'Goth spell book goal widget for Twitch, spooky theme, works with StreamElements and Streamlabs. Colour and font editable.',
  intro: 'A goth spell book goal widget for Twitch streamers running a spooky or gothic themed channel, tracking donations and followers.',
  files: ['spellbookgoalcodes.zip, the widget code for StreamElements and Streamlabs', 'ManuallySetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
});

push({
  id: '1728594513',
  title: 'Celestial Moon Goal Widget for Twitch | Animated Tracker',
  seoTitle: 'Celestial Moon Goal Widget for Twitch',
  seoDesc: 'Celestial moon goal widget for Twitch, ships with separate StreamElements and Streamlabs code files.',
  intro: 'A celestial moon goal widget for Twitch streamers with a night sky theme, tracking donations and followers as the moon fills.',
  files: ['CelestialMoonGoalStreamelements.zip, the StreamElements widget code', 'CelestialMoonGoalStreamlabs.zip, the Streamlabs widget code', 'ManuallySetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
});

push({
  id: '1721971396',
  title: 'Heart Goal Widget for Twitch | Minimalist Liquid Fill Tracker',
  seoTitle: 'Heart Goal Widget for Twitch, Minimalist',
  seoDesc: 'Minimalist heart liquid-fill goal widget for Twitch, works with StreamElements and Streamlabs. Colour and font editable.',
  intro: 'A minimalist heart goal widget for Twitch streamers, a clean animated liquid fill tracker for donations, follows, bits and support.',
  files: ['minimalistheartupdtcode.zip, the widget code for StreamElements and Streamlabs', 'HowToSetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
});

push({
  id: '1810207793',
  title: 'Skull Ghost Goal Widget for Twitch | Spooky Liquid Fill',
  seoTitle: 'Skull Ghost Goal Widget for Twitch, Spooky',
  seoDesc: 'Spooky skull and ghost liquid-fill goal widget for Twitch, works with StreamElements and Streamlabs.',
  intro: 'A skull and ghost goal widget for Twitch streamers running a spooky themed channel, tracking donations and followers.',
  files: ['SkullBatCodes.zip, the widget code for StreamElements and Streamlabs', 'HowToSetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
});

push({
  id: '1858698516',
  title: 'Butterfly Vibe Goal Widget for Twitch | Combo Liquid Fill',
  seoTitle: 'Butterfly Vibe Goal Widget for Twitch',
  seoDesc: 'Butterfly combo liquid-fill goal widget for Twitch, works with StreamElements and Streamlabs. Colour and font editable.',
  intro: 'A butterfly-themed combo goal widget for Twitch streamers, an animated liquid fill tracker for donations, follows, bits and support.',
  files: ['ButterflyComboGoalCode.zip, the widget code for StreamElements and Streamlabs', 'HowToSetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
});

push({
  id: '1722104747',
  title: 'Casino Card Goal Widget for Twitch | 4 Suit Icon Tracker',
  seoTitle: 'Casino Card Goal Widget for Twitch, 4 Suits',
  seoDesc: 'Casino card suit goal widget for Twitch with heart, spade, club and diamond icon styles. StreamElements and Streamlabs.',
  intro: 'A casino card suit goal widget for Twitch streamers, delivered as four icon styles, heart, spade, club and diamond, so you can pick the one that matches your channel.',
  files: ['heartcode.zip, the heart suit widget code', 'spadegoal.zip, the spade suit widget code', 'clubcode.zip, the club suit widget code', 'diamondcode.zip, the diamond suit widget code', 'HowToSetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
  extraFaq: [{q: 'How many card suit styles are included?', a: 'Four: heart, spade, club and diamond, each its own widget code file so you can install just the one you want.'}],
});

push({
  id: '1834815562',
  title: 'Chicken Goal Widget for Twitch | Cute Liquid Fill Tracker',
  seoTitle: 'Chicken Goal Widget for Twitch, Liquid Fill',
  seoDesc: 'Animated chicken liquid-fill goal widget for Twitch, works with StreamElements and Streamlabs. Colour and font editable.',
  intro: 'A chicken goal widget for Twitch streamers, an animated liquid fill tracker for donations, follows, bits and support.',
  files: ['hencode.zip, the widget code for StreamElements and Streamlabs', 'HowToSetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
});

push({
  id: '1720725716',
  title: 'Star Bottle Goal Widget for Twitch | Sparkling Liquid Fill',
  seoTitle: 'Star Bottle Goal Widget for Twitch',
  seoDesc: 'Star bottle liquid-fill goal widget for Twitch, ships with separate StreamElements and Streamlabs code files.',
  intro: 'A star bottle goal widget for Twitch streamers, tracking donations and followers as the bottle fills with stars.',
  files: ['StreamElementscode.zip, the StreamElements widget code', 'StarBottleStreamlabcode.zip, the Streamlabs widget code', 'HowToSetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
});

push({
  id: '1805179619',
  title: 'Eye Potion Goal Widget for Twitch | Halloween Liquid Fill',
  seoTitle: 'Eye Potion Goal Widget for Twitch, Halloween',
  seoDesc: 'Halloween eye potion bottle goal widget for Twitch, ships with separate StreamElements and Streamlabs code files.',
  intro: 'A Halloween eye potion bottle goal widget for Twitch streamers, tracking donations and followers as the potion fills.',
  files: ['EyePotionStreamelements.zip, the StreamElements widget code', 'EyePotionBottleStreamlabs.zip, the Streamlabs widget code', 'ManuallySetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
});

push({
  id: '1790037076',
  title: 'Mushroom Goal Widget for Twitch | Cute Liquid Fill Tracker',
  seoTitle: 'Mushroom Goal Widget for Twitch, Liquid Fill',
  seoDesc: 'Mushroom liquid-fill goal widget for Twitch, works with StreamElements and Streamlabs. Colour and font editable.',
  intro: 'A mushroom goal widget for Twitch streamers, an animated liquid fill tracker for cozy or cottagecore-themed channels.',
  files: ['goalcode.zip, the widget code for StreamElements and Streamlabs', 'HowToSetupGoalWidgetTutorial.pdf, the setup guide'],
  streamlabs: true,
  goalTypes: goalTypesStd,
});

const family1Handles = new Set(items.map((i) => i.id));

const results = [];

for (const it of items) {
  const c = byId[it.id];
  const html = family1Desc({
    intro: it.intro,
    files: it.files,
    streamlabs: it.streamlabs,
    goalTypes: it.goalTypes,
    extraCustom: it.extraCustom,
    extraFaq: it.extraFaq,
  });
  results.push({
    handle: c.handle,
    etsy_listing_id: c.etsy_listing_id,
    etsy_units_45d: c.units_45d,
    current_title: c.shopify_title,
    title: it.title,
    descriptionHtml: html,
    seo_title: it.seoTitle,
    seo_description: it.seoDesc,
    works_with: it.streamlabs ? PLAT_FAMILY1 : PLAT_FAMILY1_NOLABS,
    works_with_evidence: 'listing_body',
    notes: it.notes || '',
  });
}

writeFileSync(`${ROOT}/data/_family1-results.json`, JSON.stringify(results, null, 2));
console.log('Family1 generated:', results.length);
