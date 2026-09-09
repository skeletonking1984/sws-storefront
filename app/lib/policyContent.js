/**
 * Storefront-authored policy copy.
 *
 * The policies stored in Shopify Admin were inherited from a previous store:
 * the privacy policy names a different business ("spacelabs shop.com"), and the
 * refund policy is a physical-goods returns policy (30 day returns, "unworn or
 * unused, with tags, and in its original packaging", return shipping labels)
 * for a shop that only sells instant digital downloads. Both list an unrelated
 * contact address.
 *
 * Updating them at the source needs the `write_legal_policies` Admin API scope,
 * which this integration does not have, so these overrides render instead of
 * the Shopify copy. Same pattern as the contact/how-it-works/faq handling in
 * `pages.$handle.jsx`.
 *
 * IMPORTANT: this only fixes the storefront. Shopify's checkout links to its
 * own copy of these policies at checkout.shopify.com, so the old text is still
 * live there until someone pastes this copy into
 * Admin > Settings > Policies. Delete this file once that is done.
 */

export const SUPPORT_EMAIL = 'streamwidgetshop@gmail.com';

const LAST_UPDATED = '9 September 2026';

export const POLICY_OVERRIDES = {
  'privacy-policy': {
    handle: 'privacy-policy',
    title: 'Privacy Policy',
    updated: LAST_UPDATED,
    summary:
      'What we collect, why we collect it, and how to get it deleted. We do not sell your data.',
    body: `
<p>Stream Widget Shop sells animated chat, goal and overlay widgets for streamers as instant digital downloads. This policy explains what we collect, why we collect it, and what you can do about it. It covers streamwidgetshop.com.</p>

<h2>What we collect</h2>
<ul>
  <li><strong>Order information.</strong> Your name, email address, billing address, and the items you bought. We need this to take payment and get you your download.</li>
  <li><strong>Payment details.</strong> Handled entirely by our payment providers (Shopify Payments, Shop Pay, PayPal). Full card numbers never reach us and we cannot see them.</li>
  <li><strong>Your email address</strong>, if you sign up for our newsletter or a discount code.</li>
  <li><strong>Basic usage data.</strong> Pages visited, device and browser type, and how you found us, through Shopify's built in analytics and cookies.</li>
</ul>
<p>We do not ask for more than this. We will never ask you for your Twitch, YouTube, Kick or StreamElements password, and we will never email you to request one.</p>

<h2>How we use it</h2>
<ul>
  <li>To process your order and deliver your files.</li>
  <li>To send order confirmations, download links and receipts.</li>
  <li>To answer support questions and help you get a widget installed.</li>
  <li>To send marketing emails, but only if you opted in. Every one has a working unsubscribe link.</li>
  <li>To see which products and pages people actually use, so we can build better widgets.</li>
</ul>

<h2>Who we share it with</h2>
<p>We do not sell your personal information and we never have. We share it only with the services that make the shop run:</p>
<ul>
  <li><strong>Shopify</strong>, which hosts the store, processes orders and provides analytics.</li>
  <li><strong>Payment providers</strong> (Shopify Payments, Shop Pay, PayPal), to take payment and issue refunds.</li>
  <li><strong>Our email provider</strong>, to send order emails and any newsletter you asked for.</li>
</ul>
<p>We may also disclose information where the law requires it, or to protect our rights or someone's safety.</p>

<h2>Cookies</h2>
<p>The store uses cookies to keep your cart working, keep you signed in, and measure traffic. You can block or delete cookies in your browser settings, but the cart will not work properly if you do.</p>

<h2>Your rights</h2>
<p>Wherever you live, you can ask us to show you the personal information we hold about you, correct it, or delete it. In the EU and UK that is your right under GDPR. In California it is your right under the CCPA. Email us and we will do it. We will not make you jump through hoops.</p>

<h2>How long we keep it</h2>
<p>We keep order records as long as we need them for accounting and tax, and so that you can re-download something you already paid for. Marketing email addresses are kept until you unsubscribe.</p>

<h2>Children</h2>
<p>This shop is not intended for anyone under 13, and we do not knowingly collect information from them.</p>

<h2>Changes to this policy</h2>
<p>If we change this policy, we will update the date at the top of this page.</p>

<h2>Contact</h2>
<p>Questions about privacy, or want your data removed? Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> and a real person will reply.</p>
`.trim(),
  },

  'refund-policy': {
    handle: 'refund-policy',
    title: 'Refund Policy',
    updated: LAST_UPDATED,
    summary:
      'Everything here is an instant download, so nothing ships back. If a widget is broken or not as described, we fix it or refund you.',
    body: `
<p>Every product in this shop is an instant digital download. Nothing ships, so there is nothing to post back to us. That does not mean you are stuck with a file that does not work.</p>

<h2>The short version</h2>
<p>If a widget is broken, never arrived, or is not what the listing described, tell us and we will fix it or refund you. If you downloaded a working file and simply changed your mind, we cannot refund it, because a digital file cannot be returned once it is on your machine.</p>

<h2>We will refund you if</h2>
<ul>
  <li>Your download never arrived, or the link does not work and we cannot get you a working one.</li>
  <li>The files are corrupted or incomplete and we cannot replace them.</li>
  <li>The widget does not do what the listing said it does.</li>
  <li>You were charged twice, or bought the same product twice by mistake.</li>
  <li>We cannot get it running on a platform the listing says it supports.</li>
</ul>
<p>Ask within 30 days of purchase and the refund goes back to your original payment method.</p>

<h2>What we cannot refund</h2>
<ul>
  <li>A working file you downloaded and then changed your mind about.</li>
  <li>A purchase for a platform the listing does not claim to support. Every listing states which platforms it works with, so check first, and ask us if you are not sure.</li>
</ul>

<h2>Try us first, it is usually faster</h2>
<p>Most problems turn out to be one setup step, not a broken widget, and we can normally sort it out the same day. Send your order number and a screenshot or a short description of what you are seeing. Helping you get the widget running is part of what you paid for.</p>

<h2>How to ask</h2>
<p>Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> with your order number and what went wrong. We aim to reply within 4 hours. Once a refund is approved it goes back to your original payment method, and your bank can take a few more days to show it.</p>

<h2>Custom commissions</h2>
<p>Commissioned widgets are quoted and built for one customer, so their terms are agreed in writing when you commission the piece. Those terms take precedence over this page.</p>
`.trim(),
  },
};

/**
 * @param {string | undefined} handle
 * @returns {(typeof POLICY_OVERRIDES)[keyof typeof POLICY_OVERRIDES] | null}
 */
export function getPolicyOverride(handle) {
  if (!handle) return null;
  return POLICY_OVERRIDES[handle] ?? null;
}
