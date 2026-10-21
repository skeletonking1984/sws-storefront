import {useState} from 'react';
import {Link, useLoaderData, useRouteLoaderData} from 'react-router';
import {buildMeta, getOrigin} from '~/lib/seo';
import {getServiceStatus} from '~/lib/service-status.server';
import {parseWorksWith} from '~/lib/platforms';
import {subjectFromTitle} from '~/lib/productName';
import {
  CHECKS,
  COMING_SOON,
  DEFAULT_PICK,
  NOT_SUPPORTED_PLATFORMS,
  PICKER_PLATFORMS,
  PICKER_SOFTWARE,
  PLATFORM_NOTES,
  PLATFORM_STATUS,
  SOFTWARE_STATUS,
  STATUS,
  TYPES,
  answerFor,
  groupListed,
  isBeta,
  requirements,
  usedStatuses,
} from '~/lib/compatibility';

/**
 * "What works with what": one short page on what our products support and
 * what they do not, in plain customer language.
 *
 * All claims live in app/lib/compatibility.js and are ledgered in
 * docs/compatibility-claims.md. A claim with no source does not belong here.
 * To change a status, edit one line in that data file and update the ledger.
 *
 * The picker is plain React state and renders a Twitch plus OBS answer on the
 * server, so the page is useful with JavaScript off. The live status dots come
 * from the loader only; nothing about where the checks run reaches the browser.
 */

const PAGE_TITLE = 'What works with what';
const PAGE_DESCRIPTION =
  'Pick your platform and streaming app to see which of our chat widgets, goal widgets, alerts, overlay packs, free chat and music widget work for you.';
const REVIEWED = '2026-10-03';

export const meta = ({matches}) => {
  const origin = getOrigin(matches);
  return buildMeta({
    title: `${PAGE_TITLE} | Stream Widget Shop`,
    description: PAGE_DESCRIPTION,
    url: `${origin}/compatibility`,
  });
};

/** Never throws. A failed lookup just means no product names are listed. */
export async function loader({context}) {
  const [services, products] = await Promise.all([
    getServiceStatus({env: context.env}),
    context.storefront
      .query(LISTED_PRODUCTS_QUERY)
      .then((data) =>
        (data?.products?.nodes ?? []).map((node) => ({
          handle: node.handle,
          name: subjectFromTitle(node.title).split(',')[0].trim(),
          productType: node.productType,
          platforms: parseWorksWith(node.worksWith?.value) || [],
        })),
      )
      .catch(() => []),
  ]);
  return {services, listed: groupListed(products)};
}

/* ------------------------------------------------------------------ */

function Status({s, beta}) {
  const meta = STATUS[s];
  return (
    <span className={`compat-status compat-status-${s}`}>
      <span className="compat-icon" aria-hidden="true">
        {meta.icon}
      </span>
      {meta.label}
      {beta ? <span className="compat-beta-tag compat-beta-inline">Beta</span> : null}
    </span>
  );
}

/** What an untested combination shows instead of a status. */
function AskUs() {
  return (
    <a href="/discord" className="compat-ask-link">
      Ask us
    </a>
  );
}

function ProductLinks({products, fallbackHref, limit}) {
  if (!products?.length) {
    return (
      <Link to={fallbackHref} className="compat-inline-link">
        See the products
      </Link>
    );
  }
  const shown = limit ? products.slice(0, limit) : products;
  const more = products.length - shown.length;
  return (
    <>
      {shown.map((p, i) => (
        <span key={p.handle}>
          <Link to={`/products/${p.handle}`} className="compat-inline-link">
            {p.name}
          </Link>
          {i < shown.length - 1 ? ', ' : ''}
        </span>
      ))}
      {more > 0 ? (
        <>
          {' '}
          and {more} more. <a href="#compat-which">See them all</a>
        </>
      ) : null}
    </>
  );
}

/* ---------------------------- Picker ------------------------------- */

function Picker({listed}) {
  const [platform, setPlatform] = useState(DEFAULT_PICK.platform);
  const [software, setSoftware] = useState(DEFAULT_PICK.software);
  const other = software === 'Other';

  return (
    <section className="compat-section" aria-labelledby="compat-picker">
      <h2 id="compat-picker">Check your setup</h2>
      <div className="compat-selects">
        <label>
          <span>I stream on</span>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {PICKER_PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>using</span>
          <select value={software} onChange={(e) => setSoftware(e.target.value)}>
            {PICKER_SOFTWARE.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="compat-answer" aria-live="polite">
        {other ? (
          <p className="compat-other">
            Ask us and we&rsquo;ll check.{' '}
            <a href="/discord">Ask in our Discord</a>
          </p>
        ) : (
          <ul className="compat-list">
            {TYPES.map((type) => {
              const a = answerFor(platform, software, type);
              return (
                <li key={type.id}>
                  <div className="compat-list-text">
                    <strong>
                      <Link to={type.href} className="compat-inline-link">
                        {type.name}
                      </Link>
                    </strong>
                    {a.lines.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                    {a.listed ? (
                      <span>
                        Only on products that list {platform}:{' '}
                        <ProductLinks
                          products={listed?.[platform]?.[type.id]}
                          fallbackHref={type.href}
                          limit={4}
                        />
                      </span>
                    ) : null}
                  </div>
                  {a.ask ? <AskUs /> : <Status s={a.status} beta={a.beta} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ----------------------------- Grid -------------------------------- */

const GRID_TYPES = TYPES.filter((t) => t.grid);

function Matrix({caption, rows}) {
  return (
    <table className="compat-table">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">
            <span className="sr-only">Name</span>
          </th>
          {GRID_TYPES.map((t) => (
            <th scope="col" key={t.id}>
              {t.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) =>
          r.span ? (
            <tr key={r.name}>
              <th scope="row">{r.name}</th>
              <td colSpan={GRID_TYPES.length} className="compat-span">
                <Status s={r.s} />
                <span className="compat-note">{r.detail}</span>
              </td>
            </tr>
          ) : (
            <tr key={r.name}>
              <th scope="row">{r.name}</th>
              {GRID_TYPES.map((t) => (
                <td key={t.id} data-label={t.name}>
                  {r.cells[t.id] === 'untested' ? (
                    <AskUs />
                  ) : (
                    <Status s={r.cells[t.id]} beta={isBeta(t.id, r.name)} />
                  )}
                  {r.cells[t.id] !== 'untested' && r.notes?.[t.id] ? (
                    <span className="compat-note">{r.notes[t.id]}</span>
                  ) : null}
                </td>
              ))}
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}

const SOFTWARE_ROWS = Object.entries(SOFTWARE_STATUS).map(([name, cells]) => ({
  name,
  cells,
}));

const PLATFORM_ROWS = [
  ...PICKER_PLATFORMS.map((name) => ({
    name,
    cells: PLATFORM_STATUS[name],
    notes: PLATFORM_NOTES[name],
  })),
  ...NOT_SUPPORTED_PLATFORMS.map((name) => ({
    name,
    cells: Object.fromEntries(GRID_TYPES.map((t) => [t.id, 'no'])),
  })),
  {name: COMING_SOON.name, span: true, s: 'soon', detail: COMING_SOON.detail},
];

function gridStatuses() {
  const used = [];
  for (const r of [...SOFTWARE_ROWS, ...PLATFORM_ROWS]) {
    if (r.span) used.push(r.s);
    else for (const t of GRID_TYPES) used.push(r.cells[t.id]);
  }
  return used;
}

function Grid({listed}) {
  const legend = usedStatuses(gridStatuses());
  const listedPlatforms = ['Kick', 'YouTube', 'TikTok'];
  return (
    <section className="compat-section" aria-labelledby="compat-grid">
      <h2 id="compat-grid">The full grid</h2>
      <ul className="compat-key" aria-label="Key">
        {legend.map((s) => (
          <li key={s}>
            <Status s={s} />
          </li>
        ))}
      </ul>

      <h3 className="compat-h3">Streaming apps</h3>
      <Matrix caption="Which streaming apps each product type works with" rows={SOFTWARE_ROWS} />
      <p className="compat-foot">
        Using something not listed? <a href="/discord">Ask us and we&rsquo;ll test it.</a>
      </p>

      <h3 className="compat-h3">Platforms</h3>
      <Matrix caption="Which platforms each product type works with" rows={PLATFORM_ROWS} />

      <h3 className="compat-h3" id="compat-which">
        Which products list Kick, YouTube or TikTok?
      </h3>
      <div className="compat-details">
        {listedPlatforms.map((platform) => (
          <details key={platform}>
            <summary>Products that list {platform}</summary>
            {['chat', 'goal', 'packs'].map((id) => {
              const type = TYPES.find((t) => t.id === id);
              const products = listed?.[platform]?.[id] ?? [];
              if (!products.length) return null;
              return (
                <p key={id}>
                  <strong>{type.name}: </strong>
                  <ProductLinks products={products} fallbackHref={type.href} />
                </p>
              );
            })}
          </details>
        ))}
      </div>
    </section>
  );
}

/* ----------------------- Requirements and checks ------------------- */

function Requirements() {
  return (
    <section className="compat-section" aria-labelledby="compat-req">
      <h2 id="compat-req">Good to know</h2>
      <ul className="compat-plain">
        {requirements().map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

function BeforeYouAsk() {
  return (
    <section className="compat-section" aria-labelledby="compat-checks">
      <h2 id="compat-checks">Before you ask</h2>
      <p className="compat-lede">Four quick checks fix most problems.</p>
      <ol className="compat-plain">
        {CHECKS.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
    </section>
  );
}

/* ----------------------------- Live status ------------------------- */

/** Features that carry a visible Beta tag in the live status list. */
const BETA_FEATURES = ['Now Playing music widget'];

const SERVICE_STATE = {
  up: {label: 'Running', dot: 'up'},
  slow: {label: 'Slow', dot: 'slow'},
  down: {label: 'Down', dot: 'down'},
  unknown: {label: 'Status unavailable', dot: 'unknown'},
};

function ServiceStatus({services}) {
  const stamps = services
    .map((service) => Date.parse(service.checkedAt))
    .filter((t) => Number.isFinite(t));
  const latest = stamps.length ? new Date(Math.max(...stamps)) : null;
  const allUnknown = services.every((s) => s.state === 'unknown');
  return (
    <section className="compat-section" aria-labelledby="compat-live">
      <h2 id="compat-live">Live status</h2>
      <p className="compat-lede">
        These dots cover the parts of the shop we run ourselves. Green means
        our side is answering; it does not cover Twitch, Kick or other
        platforms having an outage.
      </p>
      <ul className="compat-services">
        {services.map((service) => {
          const meta = SERVICE_STATE[service.state] || SERVICE_STATE.unknown;
          return (
            <li key={service.feature}>
              <span className={`compat-dot compat-dot-${meta.dot}`} aria-hidden="true" />
              <span className="compat-service-name">
                {service.feature}
                {BETA_FEATURES.includes(service.feature) ? (
                  <span className="compat-beta-tag">Beta</span>
                ) : null}
              </span>
              <span className="compat-service-state">{meta.label}</span>
            </li>
          );
        })}
      </ul>
      <p className="compat-checked">
        {latest && !allUnknown
          ? `Checked ${latest.toISOString().slice(11, 16)} UTC`
          : 'Status could not be checked just now.'}
      </p>
    </section>
  );
}

/* ------------------------------ Page ------------------------------- */

export default function Compatibility() {
  const {services, listed} = useLoaderData();
  const root = useRouteLoaderData('root');
  const origin = root?.origin || 'https://streamwidgetshop.com';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${origin}/compatibility`,
    dateModified: REVIEWED,
    isPartOf: {'@type': 'WebSite', name: 'Stream Widget Shop', url: origin},
  };

  return (
    <div className="compat-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <CompatStyles />

      <h1>{PAGE_TITLE}</h1>
      <p className="compat-lede">
        Pick your platform and your streaming app to see what works. Last
        reviewed <span className="compat-nowrap">{REVIEWED}</span>.
      </p>

      <Picker listed={listed} />
      <Grid listed={listed} />
      <Requirements />
      <BeforeYouAsk />
      <ServiceStatus services={services} />

      <section className="compat-section compat-ask" aria-labelledby="compat-help">
        <h2 id="compat-help">Need a hand?</h2>
        <p className="compat-lede">
          Ask us in Discord. If a widget is broken, we fix it first. If we
          cannot fix it, we refund you. Ask within 30 days. Details in our{' '}
          <Link to="/policies/refund-policy">refund policy</Link>.
        </p>
        <a className="sws-btn sws-btn-primary" href="/discord">
          Ask in our Discord
        </a>
      </section>
    </div>
  );
}

/**
 * Page styles, mobile first. Grid rows become stacked cards under 720px so
 * nothing scrolls sideways. Colours are brand tokens from app.css; the one
 * non-palette value is the amber used for the "Slow" dot, because the brand
 * palette has no yellow and a status light needs one.
 */
function CompatStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
      .compat-page { max-width: 960px; margin: 0 auto; padding: 2rem 1rem 4rem; color: var(--sws-text); }
      .compat-page th, .compat-page td, .compat-list-text, .compat-service-name, .compat-plain li { word-break: normal; overflow-wrap: break-word; hyphens: none; }
      .compat-page h1 { font-family: var(--font-display); font-size: clamp(1.8rem, 6vw, 2.6rem); margin: 0 0 0.75rem; }
      .compat-page h2 { font-family: var(--font-display); font-size: clamp(1.25rem, 4.5vw, 1.6rem); margin: 0 0 0.75rem; }
      .compat-h3 { font-family: var(--font-display); font-size: 1.1rem; margin: 1.5rem 0 0.6rem; }
      .compat-lede { font-size: 1rem; line-height: 1.6; max-width: 640px; margin: 0 0 1.25rem; color: var(--sws-text); }
      .compat-foot { font-size: 0.95rem; line-height: 1.5; margin: 0.9rem 0 0; }
      .compat-page a:not(.sws-btn) { color: var(--sws-accent-2); text-decoration: underline; }
      .compat-page .sws-btn { text-decoration: none; }
      .compat-section { margin: 2.25rem 0 0; }
      .compat-nowrap { white-space: nowrap; }
      .compat-key { display: flex; flex-wrap: wrap; gap: 0.5rem; list-style: none; margin: 0 0 0.5rem; padding: 0; }
      .compat-status { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0.65rem; border-radius: 999px; border: 1px solid var(--sws-border-strong); background: var(--sws-card-solid); font-size: 0.85rem; font-weight: 700; line-height: 1.2; color: var(--sws-text); white-space: nowrap; }
      .compat-icon { font-size: 0.95rem; }
      .compat-status-works { border-color: var(--sws-holo-5); }
      .compat-status-works .compat-icon { color: var(--sws-holo-5); }
      .compat-status-beta { border-color: var(--sws-holo-2); }
      .compat-status-beta .compat-icon { color: var(--sws-holo-2); }
      .compat-status-some { border-color: var(--sws-holo-1); }
      .compat-status-some .compat-icon { color: var(--sws-holo-1); }
      .compat-ask-link { font-weight: 700; font-size: 0.85rem; white-space: nowrap; }
      .compat-beta-inline { margin-left: 0.25rem; padding: 0.05rem 0.4rem; font-size: 0.62rem; }
      .compat-status-soon { border-color: var(--sws-holo-3); }
      .compat-status-soon .compat-icon { color: var(--sws-holo-3); }
      .compat-status-no { border-color: var(--sws-holo-4); }
      .compat-status-no .compat-icon { color: var(--sws-holo-4); }
      .compat-note { display: block; font-size: 0.8rem; color: var(--sws-sub); margin-top: 0.25rem; }

      .compat-selects { display: grid; gap: 0.75rem; margin: 0 0 1rem; }
      .compat-selects label { display: grid; gap: 0.3rem; font-weight: 700; font-size: 0.9rem; }
      .compat-selects select { font: inherit; font-weight: 600; color: var(--sws-text); background: var(--sws-card-solid); border: 1px solid var(--sws-border-strong); border-radius: 10px; padding: 0.65rem 0.8rem; min-height: 44px; width: 100%; }
      @media (min-width: 560px) { .compat-selects { grid-template-columns: 1fr 1fr; max-width: 560px; } }
      .compat-other { background: var(--sws-card-solid); border: 1px solid var(--sws-border); border-radius: 14px; padding: 1rem; margin: 0; }

      .compat-table { width: 100%; border-collapse: collapse; display: block; }
      .compat-table thead { position: absolute; left: -9999px; }
      .compat-table tbody, .compat-table tr { display: block; }
      .compat-table tr { background: var(--sws-card-solid); border: 1px solid var(--sws-border); border-radius: 14px; padding: 0.85rem 1rem; margin: 0 0 0.75rem; }
      .compat-table th[scope="row"] { display: block; text-align: left; font-size: 1.05rem; margin: 0 0 0.5rem; }
      .compat-table td { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 0.75rem; padding: 0.4rem 0; border-top: 1px solid var(--sws-border); }
      .compat-table td::before { content: attr(data-label); font-size: 0.85rem; color: var(--sws-text); flex: 1 1 8rem; min-width: 0; }
      .compat-table td.compat-span::before { content: none; }
      .compat-table td > :not(.compat-note) { flex: 0 0 auto; }
      .compat-table td .compat-note { flex: 1 1 100%; text-align: right; }
      .compat-table td.compat-span .compat-note { text-align: left; }
      @media (min-width: 720px) {
        .compat-table { display: table; table-layout: fixed; border: 1px solid var(--sws-border); border-radius: 14px; overflow: hidden; background: var(--sws-card-solid); }
        .compat-table thead { position: static; display: table-header-group; }
        .compat-table tbody { display: table-row-group; }
        .compat-table tr { display: table-row; border: 0; border-radius: 0; padding: 0; margin: 0; background: none; }
        .compat-table thead th:first-child, .compat-table th[scope="row"] { width: 17%; min-width: 8rem; }
        .compat-table th, .compat-table td { display: table-cell; padding: 0.7rem 0.5rem; border-top: 1px solid var(--sws-border); vertical-align: top; text-align: left; }
        .compat-table thead th { font-size: 0.8rem; color: var(--sws-text); border-top: 0; background: var(--sws-bg-alt); }
        .compat-table th[scope="row"] { display: table-cell; font-size: 0.95rem; margin: 0; }
        .compat-table td::before { content: none; }
        .compat-table td .compat-note { text-align: left; }
        .compat-table td .compat-status { padding: 0.2rem 0.45rem; font-size: 0.78rem; }
        .compat-table td.compat-span { display: table-cell; }
        .compat-table td.compat-span > * { display: inline-block; vertical-align: middle; margin: 0 0.6rem 0 0; }
      }

      .compat-list, .compat-services { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem; }
      .compat-list li, .compat-services li { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem 0.75rem; background: var(--sws-card-solid); border: 1px solid var(--sws-border); border-radius: 14px; padding: 0.75rem 1rem; }
      .compat-list-text { display: grid; gap: 0.15rem; min-width: 0; flex: 1 1 14rem; }
      .compat-list-text span { font-size: 0.88rem; color: var(--sws-text); }
      .compat-inline-link { font-weight: 700; }
      .compat-list-text span .compat-inline-link { font-weight: 600; }
      .compat-plain { margin: 0; padding: 0 0 0 1.4rem; line-height: 1.5; max-width: 720px; list-style: disc; }
      ol.compat-plain { list-style: decimal; }
      .compat-plain li { margin: 0 0 0.6rem; padding-left: 0.2rem; }
      .compat-details { display: grid; gap: 0.5rem; }
      .compat-details details { background: var(--sws-card-solid); border: 1px solid var(--sws-border); border-radius: 12px; padding: 0.7rem 1rem; }
      .compat-details summary { cursor: pointer; font-weight: 700; min-height: 24px; }
      .compat-details p { margin: 0.6rem 0 0; font-size: 0.92rem; line-height: 1.5; }

      .compat-services li { justify-content: flex-start; flex-wrap: nowrap; }
      .compat-dot { flex: 0 0 auto; width: 0.85rem; height: 0.85rem; border-radius: 50%; border: 2px solid var(--sws-text); }
      .compat-dot-up { background: var(--sws-holo-5); }
      .compat-dot-slow { background: #e9b949; }
      .compat-dot-down { background: #d8432f; }
      .compat-dot-unknown { background: var(--sws-sub); }
      .compat-service-name { font-weight: 700; flex: 1 1 auto; min-width: 0; }
      .compat-service-name .compat-beta-tag { margin-left: 0.5rem; }
      .compat-service-state { font-size: 0.9rem; color: var(--sws-text); flex: 0 0 auto; }
      .compat-checked { font-size: 0.85rem; color: var(--sws-sub); margin: 0.75rem 0 0; }

      .compat-beta-tag { display: inline-block; vertical-align: middle; font-family: var(--font-body); font-size: 0.7rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sws-text); border: 1px solid var(--sws-holo-2); border-radius: 999px; padding: 0.15rem 0.55rem; }
      .compat-ask { background: var(--sws-card-solid); border: 1px solid var(--sws-border-strong); border-radius: 16px; padding: 1.5rem 1.25rem; }
    `,
      }}
    />
  );
}

const LISTED_PRODUCTS_QUERY = `#graphql
  query CompatibilityListedProducts {
    products(first: 250, sortKey: BEST_SELLING) {
      nodes {
        handle
        title
        productType
        worksWith: metafield(namespace: "custom", key: "works_with") {
          value
        }
      }
    }
  }
`;
