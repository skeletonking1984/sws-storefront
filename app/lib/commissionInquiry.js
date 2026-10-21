/**
 * Custom widget commission inquiry: field definitions, validation, UTM
 * handling and the notification email body for /pages/custom-widgets.
 *
 * Plain module on purpose (no `.server.js`, no env, no secret): the route's
 * action validates with it, the page renders its option lists from it, and
 * app/lib/commissionInquiry.test.mjs runs it under plain node. Relative
 * imports only, for the same reason.
 *
 * Copy rule for this whole file and the page: no em or en dashes.
 */

import {isValidEmail} from './freeChatValidation.js';

/** Platforms we have actually shipped for. Do not add one we have not. */
export const PLATFORM_OPTIONS = [
  {value: 'twitch', label: 'Twitch'},
  {value: 'kick', label: 'Kick'},
  {value: 'youtube', label: 'YouTube'},
  {value: 'several', label: 'More than one of these'},
  {value: 'unsure', label: 'Not sure yet'},
];

export const BUDGET_OPTIONS = [
  {value: '300-500', label: '$300 to $500'},
  {value: '500-plus', label: '$500 or more'},
  {value: 'unsure', label: 'Not sure yet'},
];

export const FIELD_LIMITS = {
  name: 100,
  email: 254,
  message: 4000,
  deadline: 120,
  utm: 100,
  oppref: 200,
};

/** The UTM keys captured from the landing URL, in the order they are reported. */
export const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
];

/**
 * UTM values are marketing labels (`chatgpt`, `commissions-test`, `a`). Anything
 * else in the query string is not ours to carry. Restricting the character set
 * keeps a crafted URL from smuggling markup or header text into the email, or
 * a junk dimension into GA4.
 * @param {unknown} value
 * @returns {string}
 */
export function cleanUtmValue(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .slice(0, FIELD_LIMITS.utm)
    .replace(/[^A-Za-z0-9._~+\-%: ]/g, '');
}

/**
 * @param {URLSearchParams | {get: (k: string) => string | null}} source
 * @returns {Record<string, string>} only the UTM keys that are present
 */
export function pickUtm(source) {
  /** @type {Record<string, string>} */
  const utm = {};
  for (const key of UTM_KEYS) {
    const value = cleanUtmValue(source.get(key) ?? '');
    if (value) utm[key] = value;
  }
  return utm;
}

/**
 * OpenAI's click reference. Opaque, so only the length and a safe character
 * set are enforced. It is appended to the landing URL by ChatGPT ads and is
 * what lets a server side lead be matched to the ad click.
 * @param {unknown} value
 * @returns {string}
 */
export function cleanOppref(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .slice(0, FIELD_LIMITS.oppref)
    .replace(/[^A-Za-z0-9._~\-]/g, '');
}

const PLATFORM_VALUES = new Set(PLATFORM_OPTIONS.map((o) => o.value));
const BUDGET_VALUES = new Set(BUDGET_OPTIONS.map((o) => o.value));

const text = (formData, key) => (formData.get(key) ?? '').toString().trim();

/**
 * @param {{get: (k: string) => FormDataEntryValue | null}} formData
 * @returns {{
 *   honeypot: boolean,
 *   values: {name: string, email: string, platform: string, message: string, budget: string, deadline: string},
 *   fieldErrors: Record<string, string>,
 *   utm: Record<string, string>,
 *   oppref: string,
 * }}
 */
export function parseInquiry(formData) {
  const values = {
    name: text(formData, 'name').slice(0, FIELD_LIMITS.name),
    email: text(formData, 'email'),
    platform: text(formData, 'platform'),
    message: text(formData, 'message').slice(0, FIELD_LIMITS.message),
    budget: text(formData, 'budget'),
    deadline: text(formData, 'deadline').slice(0, FIELD_LIMITS.deadline),
  };

  const utm = pickUtm({get: (key) => text(formData, key) || null});
  const oppref = cleanOppref(text(formData, 'oppref'));

  /** @type {Record<string, string>} */
  const fieldErrors = {};
  if (!values.name) fieldErrors.name = 'Enter your name.';
  if (!values.email) {
    fieldErrors.email = 'Enter your email.';
  } else if (!isValidEmail(values.email)) {
    fieldErrors.email = 'Enter a valid email.';
  }
  if (!PLATFORM_VALUES.has(values.platform)) {
    fieldErrors.platform = 'Pick a platform.';
  }
  if (!values.message) {
    fieldErrors.message = 'Tell us what you want built.';
  } else if (values.message.length < 10) {
    fieldErrors.message = 'Add a little more detail so we can quote it.';
  }
  if (!BUDGET_VALUES.has(values.budget)) {
    fieldErrors.budget = 'Pick a budget range.';
  }

  return {
    // Bots fill every field, including the one a person cannot see.
    honeypot: text(formData, 'company') !== '',
    values,
    fieldErrors,
    utm,
    oppref,
  };
}

const labelFor = (options, value) =>
  options.find((o) => o.value === value)?.label ?? value;

/**
 * @param {{
 *   values: ReturnType<typeof parseInquiry>['values'],
 *   utm: Record<string, string>,
 *   pageUrl?: string,
 * }} args
 * @returns {{subject: string, text: string}}
 */
export function buildInquiryEmail({values, utm, pageUrl}) {
  const platform = labelFor(PLATFORM_OPTIONS, values.platform);
  const budget = labelFor(BUDGET_OPTIONS, values.budget);
  const utmLines = UTM_KEYS.filter((k) => utm[k]).map((k) => `${k}: ${utm[k]}`);

  const lines = [
    'New custom widget inquiry from /pages/custom-widgets',
    '',
    `Name: ${values.name}`,
    `Email: ${values.email}`,
    `Platform: ${platform}`,
    `Budget: ${budget}`,
    `Deadline: ${values.deadline || 'not given'}`,
    '',
    'What they want:',
    values.message,
    '',
    utmLines.length
      ? 'Campaign (from the landing URL):'
      : 'Campaign: none (direct or organic visit)',
    ...utmLines,
  ];
  if (pageUrl) lines.push('', `Page: ${pageUrl}`);
  lines.push('', 'Reply to this email to answer them directly.');

  // The subject becomes a mail header. notify.server.js strips line breaks,
  // and the name is clipped here so a long one cannot bury the budget.
  return {
    subject: `Commission inquiry (${budget}): ${values.name.slice(0, 40)}`,
    text: lines.join('\n'),
  };
}
