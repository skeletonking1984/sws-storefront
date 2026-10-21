import {redirect} from 'react-router';
import {LEGACY_BLOG_TAG_REDIRECT_TARGET} from '~/lib/legacyRedirects';

/**
 * Old theme URL shape: /blogs/news/tagged/<tag>. Verified 404 on production
 * 2026-09-28. This blog has no tag filtering in Hydrogen, so every tag
 * collapses to the blog index rather than 404ing.
 */
export function loader() {
  throw redirect(LEGACY_BLOG_TAG_REDIRECT_TARGET, 301);
}
