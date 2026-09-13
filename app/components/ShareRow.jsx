import {useEffect, useState} from 'react';
import {useLocation, useMatches} from 'react-router';
import {ICON_PATHS} from '~/components/SocialLinks';
import {getOrigin} from '~/lib/seo';

/**
 * Share row for a product page.
 *
 * What this does and does not do for SEO: share buttons are not a ranking
 * signal and nothing here changes what a crawler sees. The part that
 * actually decides whether a pasted link looks good is the page's own
 * Open Graph and Twitter Card tags, and those are already built in
 * `~/lib/seo` (`buildMeta`) with the product's own featured image. This
 * row exists so a visitor does not have to go hunting in the address bar,
 * and so the traffic a share produces is attributable instead of landing
 * in GA4 as direct.
 *
 * Every outbound URL carries its own `utm_source`, so "someone shared this
 * to Reddit and it worked" is a thing the analytics can actually say. That
 * is safe for SEO because the PDP's canonical tag is built from
 * `location.pathname` only and never carries a query string, so a
 * UTM-tagged copy of a product URL cannot fork into a second indexable
 * page. Do not start putting query params in that canonical.
 *
 * Discord is deliberately not a button. It has no share intent URL, so the
 * honest way to share into a server is Copy link.
 */

// Reddit mark from simple-icons (CC0), same source as the ICON_PATHS marks.
const REDDIT_PATH =
  'M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286A.72.72 0 001.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0zm4.388 3.199a1.999 1.999 0 11-1.947 2.46v.002a2.37 2.37 0 00-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363a2.802 2.802 0 114.575 2.63c.012.132.02.265.02.4 0 3.31-3.87 5.995-8.645 5.995s-8.644-2.686-8.644-5.996c0-.135.008-.267.02-.399a2.8 2.8 0 114.574-2.63c1.286-.796 2.91-1.296 4.687-1.363v-.006a3.075 3.075 0 012.707-3.05 2 2 0 011.999-1.754zm-3.987 8.117a1.2 1.2 0 00-1.195 1.253 1.2 1.2 0 101.195-1.253zm-4.801.001a1.2 1.2 0 10-.004 2.4 1.2 1.2 0 00.004-2.4zm.834 5.622a.408.408 0 00-.287.688c1.152 1.153 3.393 1.24 4.045 1.24.652 0 2.893-.086 4.045-1.24a.408.408 0 00-.287-.688.408.408 0 00-.291.12c-.729.729-2.266.988-3.467.988-1.199 0-2.734-.26-3.465-.988a.407.407 0 00-.293-.12z';

const LINK_PATH =
  'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z';

const SHARE_PATH =
  'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z';

/**
 * @param {{title: string}}
 */
export function ShareRow({title}) {
  const matches = useMatches();
  const location = useLocation();
  const [copied, setCopied] = useState(false);
  // navigator.share only exists on some clients, and checking for it during
  // render would make the server and the client disagree about how many
  // buttons there are. Deciding after mount keeps hydration stable.
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && !!navigator.share);
  }, []);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const canonical = `${getOrigin(matches)}${location.pathname}`;
  const tagged = (source) =>
    `${canonical}?utm_source=${source}&utm_medium=social&utm_campaign=product_share`;

  const shareText = `${title} - animated stream widget from Stream Widget Shop`;

  const onCopy = async () => {
    const url = tagged('copy_link');
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard API is blocked outside a secure context and in some
      // embedded webviews. Select-and-prompt is the honest fallback: it
      // still lets the person get the URL rather than silently failing.
      window.prompt('Copy this link', url);
    }
  };

  const onNativeShare = async () => {
    try {
      await navigator.share({
        title,
        text: shareText,
        url: tagged('native_share'),
      });
    } catch {
      // The share sheet throws on cancel. Nothing to recover from.
    }
  };

  return (
    <div className="share-row">
      <span className="share-row-label">Share</span>
      <div className="share-row-actions">
        <a
          className="share-btn"
          href={`https://x.com/intent/post?text=${encodeURIComponent(
            shareText,
          )}&url=${encodeURIComponent(tagged('x_share'))}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on X"
        >
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d={ICON_PATHS.X} />
          </svg>
        </a>
        <a
          className="share-btn"
          href={`https://www.reddit.com/submit?url=${encodeURIComponent(
            tagged('reddit_share'),
          )}&title=${encodeURIComponent(title)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on Reddit"
        >
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d={REDDIT_PATH} />
          </svg>
        </a>
        <button
          type="button"
          className="share-btn"
          onClick={onCopy}
          aria-label={copied ? 'Link copied' : 'Copy link'}
        >
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d={LINK_PATH} />
          </svg>
        </button>
        {canNativeShare ? (
          <button
            type="button"
            className="share-btn"
            onClick={onNativeShare}
            aria-label="Share"
          >
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d={SHARE_PATH} />
            </svg>
          </button>
        ) : null}
      </div>
      <span className="share-row-copied" role="status" aria-live="polite">
        {copied ? 'Link copied' : ''}
      </span>
    </div>
  );
}
