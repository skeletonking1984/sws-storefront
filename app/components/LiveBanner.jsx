import {Link} from 'react-router';

/**
 * Slim "We're live" strip at the top of the home page. Data comes from the
 * `sws.live_banner` shop metafield via parseLiveBanner (null renders nothing).
 * @param {{banner: ReturnType<typeof import('~/lib/liveBanner').parseLiveBanner>}} props
 */
export function LiveBanner({banner}) {
  if (!banner) return null;
  const internal = banner.ctaUrl.startsWith('/');

  return (
    <section className="sws-live-banner" aria-label="Live stream">
      <p className="sws-live-banner-msg">
        <span className="sws-live-dot" aria-hidden="true" />
        <strong className="sws-live-tag">LIVE</strong>
        <span>{banner.message}</span>
      </p>
      <div className="sws-live-banner-actions">
        {banner.ctaUrl ? (
          internal ? (
            <Link
              to={banner.ctaUrl}
              className="sws-btn sws-btn-primary sws-live-cta"
            >
              {banner.ctaLabel}
            </Link>
          ) : (
            <a
              href={banner.ctaUrl}
              className="sws-btn sws-btn-primary sws-live-cta"
              target="_blank"
              rel="noopener noreferrer"
            >
              {banner.ctaLabel}
            </a>
          )
        ) : null}
        {banner.links.length ? (
          <ul className="sws-live-links" aria-label="Watch live on">
            {banner.links.map((l) => (
              <li key={l.url}>
                <a
                  href={l.url}
                  className="sws-live-pill"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
