import {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router';

/**
 * "Full stream setups" showcase on /pages/custom-widgets.
 *
 * Six niche kits, each a 16:9 animated stage. Real SWS product art is used
 * where a product exists (Soul Blade v2 fire loop, Moonlight Gummy Jar,
 * Haunted Parlour). Everything else is drawn in CSS/SVG and captioned as a
 * custom concept. No AI imagery, no people, no game names or logos.
 *
 * WEIGHT. Nothing heavy on first paint: background art and the video poster
 * are only attached when a stage comes within 300px of the viewport, the
 * fire video only when a stage is 35% visible, and never under
 * prefers-reduced-motion or Save-Data. Animations pause offscreen.
 */

const CDN = 'https://cdn.shopify.com/s/files/1/0665/8972/0766/files';
const ART = {
  // Haunted Parlour pack, product media.
  parlour: `${CDN}/SingleScreen_00000.png?v=1791824657&width=1200`,
  alerts: `${CDN}/5alert.png?v=1791824656&width=1200`,
  // Moonlight Gummy Jar, product media.
  jar: `${CDN}/il_fullxfull.8701705260_33ns.jpg?v=1792365646&width=1000`,
  // Soul Blade v2, product featured image. Fallback if the loader query fails.
  bladePoster: `${CDN}/still-2-fire-closeup.jpg?v=1792298226&width=960`,
};

export const SETUP_HANDLES = {
  blade: 'soul-blade-sword-goal-widget-v2-fire-demo',
  jar: 'moonlight-gummy-jar-widget-for-streamelements-obs-animated-celestial-stream-goal-pastel-moon-and-star-overlay',
  parlour:
    'animated-halloween-ghost-stream-overlay-pack-purple-gothic-screens-alerts-borders-stinger-transition',
};

export const STREAM_SETUPS = [
  {
    id: 'samurai',
    label: 'Anime / samurai',
    name: 'Demon Blade',
    hook: 'Built for action RPG and anime streams. Every tip feeds the blade, and at the goal the whole sword catches fire.',
    pieces: ['Fire katana goal', 'Ink chat', 'Slash alert', 'Camera frame'],
    product: 'blade',
    productLink: 'See Soul Blade v2',
    note: 'The fire sword is a real product, Soul Blade v2. The chat, alert and camera frame are an example of what we can build around it.',
    aria: 'Example samurai stream: a katana goal bar burning with animated fire under a red moon, with a chat column, a new subscriber alert and an empty camera frame.',
  },
  {
    id: 'fps',
    label: 'FPS / tactical',
    name: 'Tactical HUD',
    hook: 'Built for tactical shooters. Reads like a heads-up display, not a sticker sheet.',
    pieces: [
      'HUD chat',
      'Kill feed alerts',
      'Segmented goal',
      'Radar',
      'Bracket cam frame',
    ],
    note: 'Custom concept: an example of what we can build, not a product for sale.',
    aria: 'Concept tactical stream layout in olive and lime: bracketed camera frame, kill feed style alerts, a segmented goal bar, a radar sweep and a HUD chat box.',
  },
  {
    id: 'cozy',
    label: 'Cozy / VTuber',
    name: 'Moonlit Cozy',
    hook: 'Built for cozy streams and VTubers. Soft pastels, a moon jar that fills with every tip, and a frame sized for your model.',
    pieces: ['Moon jar goal', 'Soft bubble chat', 'Follow pop', 'Model frame'],
    product: 'jar',
    productLink: 'See the Moonlight Gummy Jar',
    note: 'The moon jar is a real product, Moonlight Gummy Jar. The model frame, chat and alert are an example of what we can build.',
    aria: 'Example cozy pastel stream: an arched frame for a VTuber model, a candy filled moon jar goal, soft chat bubbles and a follow alert.',
  },
  {
    id: 'horror',
    label: 'Horror gaming',
    name: 'Haunted Parlour',
    hook: 'Built for horror games and late night scares. Fog rolls in, candles flicker, alerts glitch in like a ghost.',
    pieces: [
      'Parlour scene',
      'Flicker alerts',
      'Ghost chat',
      'Cobweb cam frame',
      'Fog',
    ],
    product: 'parlour',
    productLink: 'See Haunted Parlour',
    note: 'The room and the alert art are from Haunted Parlour, a real pack. The fog, chat and flicker are an example of what we can build.',
    aria: 'Example horror stream: a haunted parlour room with drifting fog, a flickering ghost subscriber alert, a chat column and an empty camera frame.',
  },
  {
    id: 'pixel',
    label: 'Sandbox / building games',
    name: 'Pixel Builder',
    hook: 'Built for sandbox and building games. Chunky pixel chat, a goal that fills block by block, and a level up alert.',
    pieces: [
      'Pixel chat',
      'Block fill goal',
      'Level up alert',
      'Plank cam frame',
    ],
    caption: 'Custom concept: blocky pixel world',
    note: 'A commission example drawn in code, not a product for sale.',
    aria: 'Concept blocky pixel world stream: pixel sky, clouds and blocks, a stone chat box, a goal bar that fills block by block and a pixel alert banner.',
  },
  {
    id: 'racing',
    label: 'Racing / sim',
    name: 'Pit Lane',
    hook: 'Built for racing and sim rigs. A tachometer that revs, a dash gauge goal and a speed line stinger between scenes.',
    pieces: [
      'Dash gauge goal',
      'Tachometer',
      'Timing tower chat',
      'Speed line stinger',
      'Cam frame',
    ],
    note: 'Custom concept: an example of what we can build, not a product for sale.',
    aria: 'Concept racing stream at sunset: a road rushing toward the horizon, a tachometer, a dash gauge goal, a timing tower chat and a speed line transition.',
  },
];

const SETUP_IDS = new Set(STREAM_SETUPS.map((s) => s.id));

export function cleanSetupId(value) {
  return value && SETUP_IDS.has(value) ? value : null;
}

/** Message text the quote form is prefilled with for a chosen setup. */
export function setupPrefill(id) {
  const setup = STREAM_SETUPS.find((s) => s.id === id);
  if (!setup) return '';
  // Lower-case the first letter mid-sentence, but keep acronyms like HUD.
  const pieces = setup.pieces
    .map((p) => (/^[A-Z]{2}/.test(p) ? p : p[0].toLowerCase() + p.slice(1)))
    .join(', ');
  return `I'd like a full stream setup like your ${setup.name} example (${setup.label}): ${pieces}. My channel and the games I play: `;
}

/**
 * @param {{
 *   products: {blade?: {handle: string, poster?: string, sd?: string, hd?: string} | null, jar?: string | null, parlour?: string | null},
 *   onRequest?: (id: string) => void,
 * }} props
 */
export function StreamSetups({products, onRequest}) {
  const gridRef = useRef(null);
  const [active, setActive] = useState(0);
  const [hasJs, setHasJs] = useState(false);

  // Carousel position for the dots and the "pop" on mobile. Harmless on
  // desktop, where the dots are hidden and every card is in view.
  useEffect(() => {
    setHasJs(true);
    const grid = gridRef.current;
    if (!grid || typeof IntersectionObserver === 'undefined') return;
    const cards = [...grid.children];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(cards.indexOf(e.target));
        }
      },
      {root: grid, threshold: 0.6},
    );
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  return (
    <section
      className="cw-section ss-section"
      id="setups"
      aria-labelledby="ss-h"
    >
      <style dangerouslySetInnerHTML={{__html: SETUP_STYLES}} />
      <h2 id="ss-h">Full stream setups</h2>
      <p className="cw-section-note">
        A whole stream built around one niche: chat, goal, alerts and a camera
        frame that belong together. These are examples of what we can build.
        Pick one as a starting point and we make it yours.
      </p>
      <ul
        ref={gridRef}
        className={hasJs ? 'ss-grid has-js' : 'ss-grid'}
        aria-label="Example stream setups"
      >
        {STREAM_SETUPS.map((setup, i) => {
          const product = setup.product ? products?.[setup.product] : null;
          const handle =
            typeof product === 'string' ? product : product?.handle || null;
          return (
            <li
              key={setup.id}
              className={[
                'ss-card',
                `ss-t-${setup.id}`,
                i === 0 ? 'is-lead' : '',
                i === active ? 'is-active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <SetupStage setup={setup} blade={products?.blade} />
              <div className="ss-body">
                <span className="ss-niche">{setup.label}</span>
                <h3>{setup.name}</h3>
                <p className="ss-hook">{setup.hook}</p>
                <ul className="ss-pieces" aria-label="What is in it">
                  {setup.pieces.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                {setup.caption && <p className="ss-caption">{setup.caption}</p>}
                <p className="ss-note">{setup.note}</p>
                <div className="ss-actions">
                  <a
                    className="sws-btn sws-btn-primary"
                    href={`?setup=${setup.id}#inquiry`}
                    onClick={(e) => {
                      if (!onRequest) return;
                      e.preventDefault();
                      onRequest(setup.id);
                    }}
                  >
                    Request this setup
                  </a>
                  {handle && (
                    <Link className="ss-link" to={`/products/${handle}`}>
                      {setup.productLink}
                    </Link>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="ss-dots" aria-hidden="true">
        {STREAM_SETUPS.map((s, i) => (
          <span key={s.id} className={i === active ? 'on' : ''} />
        ))}
      </div>
    </section>
  );
}

function SetupStage({setup, blade}) {
  const ref = useRef(null);
  const videoRef = useRef(null);
  const [near, setNear] = useState(false);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const nearIo = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setNear(true);
          nearIo.disconnect();
        }
      },
      {rootMargin: '300px'},
    );
    const liveIo = new IntersectionObserver(
      ([e]) => setLive(e.isIntersecting),
      {threshold: 0.35},
    );
    nearIo.observe(el);
    liveIo.observe(el);
    return () => {
      nearIo.disconnect();
      liveIo.disconnect();
    };
  }, []);

  // Fire loop: attached on first view, paused offscreen. Poster only for
  // reduced motion or Save-Data.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !blade?.sd) return;
    if (!live) {
      v.pause();
      return;
    }
    const still =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      navigator.connection?.saveData === true;
    if (still) return;
    if (!v.getAttribute('src')) {
      const wide = (ref.current?.clientWidth || 0) > 560;
      v.src = wide && blade.hd ? blade.hd : blade.sd;
    }
    v.muted = true;
    v.play().catch(() => {});
  }, [live, blade]);

  const Scene = SCENES[setup.id];
  return (
    <div
      ref={ref}
      className={`ss-stage${live ? ' is-live' : ''}`}
      role="img"
      aria-label={setup.aria}
    >
      <Scene near={near} blade={blade} videoRef={videoRef} />
    </div>
  );
}

function Chat({className, lines}) {
  // Rendered twice so the scroll loops without a jump.
  const doubled = [
    ...lines.map((l) => ['a', ...l]),
    ...lines.map((l) => ['b', ...l]),
  ];
  return (
    <div className={`ss-chat ${className}`} aria-hidden="true">
      <ul>
        {doubled.map(([copy, name, text]) => (
          <li key={`${copy}-${name}`}>
            <b>{name}</b> {text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- 1. Anime / samurai: Soul Blade v2 fire loop ---------- */

function BladeScene({near, blade, videoRef}) {
  const poster = blade?.poster || ART.bladePoster;
  return (
    <>
      {blade?.sd ? (
        <video
          ref={videoRef}
          className="ss-fill bl-video"
          muted
          loop
          playsInline
          preload="none"
          disablePictureInPicture
          poster={near ? poster : undefined}
          aria-hidden="true"
          tabIndex={-1}
        />
      ) : (
        <div
          className="ss-fill bl-video"
          style={near ? {backgroundImage: `url("${poster}")`} : undefined}
        />
      )}
      <div className="ss-fill bl-shade" />
      <div className="bl-embers a" />
      <div className="bl-embers b" />
      <div className="bl-cam" aria-hidden="true">
        <span>CAM</span>
      </div>
      <div className="bl-alert" aria-hidden="true">
        <small>New sub</small>
        <b>Ronin_77</b>
        <em>+1 soul to the blade</em>
      </div>
      <Chat
        className="bl-chat"
        lines={[
          ['Kaito', 'the blade is almost lit'],
          ['moth_ink', 'one more tip'],
          ['Ronin_77', 'subbed for the fire'],
          ['ashfall', 'that glow tho'],
          ['Yuki_s', 'goal goal goal'],
          ['tanuki', 'first try boss?'],
        ]}
      />
    </>
  );
}

/* ---------- 2. FPS / tactical: all code ---------- */

function FpsScene() {
  return (
    <>
      <div className="ss-fill fp-bg" />
      <div className="fp-grid" />
      <svg className="fp-topo" viewBox="0 0 160 90" aria-hidden="true">
        {[10, 18, 26, 34, 42, 50].map((r) => (
          <ellipse key={r} cx="112" cy="40" rx={r * 1.5} ry={r} />
        ))}
        {[8, 15, 22].map((r) => (
          <ellipse key={`b${r}`} cx="28" cy="78" rx={r * 1.6} ry={r} />
        ))}
      </svg>
      <svg className="fp-cross" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="9" />
        <path d="M20 2v10M20 28v10M2 20h10M28 20h10" />
      </svg>
      <div className="fp-cam" aria-hidden="true">
        <span>
          <i /> CAM 01
        </span>
      </div>
      <div className="fp-feed" aria-hidden="true">
        <p>
          <b>VIPER_9</b>
          <svg viewBox="0 0 10 10">
            <circle cx="5" cy="5" r="3.2" />
            <path d="M5 0v3M5 7v3M0 5h3M7 5h3" />
          </svg>
          SUBSCRIBED
        </p>
        <p>
          <b>ECHO_ONE</b>
          <span>&#187;</span>
          500 BITS
        </p>
        <p>
          <b>GHOSTLINE</b>
          <span>+</span>
          RAID x24
        </p>
      </div>
      <div className="fp-radar" aria-hidden="true">
        <i />
      </div>
      <div className="fp-goal" aria-hidden="true">
        <div className="fp-goal-label">
          <span>SUB GOAL</span>
          <span>OBJECTIVE B</span>
        </div>
        <div className="fp-goal-bar">
          <div className="fp-goal-fill" />
        </div>
      </div>
      <Chat
        className="fp-chat"
        lines={[
          ['SGT_NOVA', 'push B, I got smoke'],
          ['echo_one', 'clutch incoming'],
          ['Viper_9', 'that flick was clean'],
          ['oldhammer', 'rotate rotate'],
          ['kilo_tea', 'GG next round'],
          ['mira', 'defuse it!!'],
        ]}
      />
      <div className="ss-fill fp-scan" />
    </>
  );
}

/* ---------- 3. Cozy / VTuber: Moonlight Gummy Jar ---------- */

function CozyScene({near}) {
  return (
    <>
      <div className="ss-fill cz-bg" />
      <div className="cz-clouds a" />
      <div className="cz-clouds b" />
      {[
        [8, 12, 'a'],
        [30, 6, 'b'],
        [62, 14, 'c'],
        [90, 40, 'a'],
        [70, 4, 'b'],
        [44, 44, 'c'],
      ].map(([x, y, k]) => (
        <span
          key={`${x}-${y}`}
          className={`cz-star ${k}`}
          style={{left: `${x}cqw`, top: `${y}cqw`}}
          aria-hidden="true"
        >
          &#10022;
        </span>
      ))}
      <div className="cz-model" aria-hidden="true">
        <span>your model here</span>
      </div>
      <div className="cz-jar" aria-hidden="true">
        <div
          className="cz-jar-art"
          style={near ? {backgroundImage: `url("${ART.jar}")`} : undefined}
        />
      </div>
      <div className="cz-alert" aria-hidden="true">
        <span>&#9825;</span> cozy_bean followed
      </div>
      <Chat
        className="cz-chat"
        lines={[
          ['mochi', 'good morning moon'],
          ['cozy_bean', 'tea and stream time'],
          ['pebble', 'the jar is so cute'],
          ['lune', 'two more stars!'],
          ['fern', 'love the new model'],
          ['sprout', 'cozy vibes only'],
        ]}
      />
    </>
  );
}

/* ---------- 4. Horror: Haunted Parlour ---------- */

function HorrorScene({near}) {
  return (
    <>
      <div
        className="hp-room"
        style={near ? {backgroundImage: `url("${ART.parlour}")`} : undefined}
      />
      <div className="ss-fill hp-grade" />
      <div className="hp-candle" />
      <div className="hp-fog a" />
      <div className="hp-fog b" />
      <div className="hp-cam" aria-hidden="true">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M20 0L0 20M20 0V20M20 0H0M20 7Q14 5 13 0M20 13Q8 10 7 0M14 20Q11 9 20 6" />
        </svg>
        <span>CAM</span>
      </div>
      <div
        className="hp-alert"
        style={near ? {backgroundImage: `url("${ART.alerts}")`} : undefined}
        aria-hidden="true"
      >
        <span>
          <b>Wraith_13</b> subscribed
        </span>
      </div>
      <Chat
        className="hp-chat"
        lines={[
          ['wraith_13', 'did the door just open'],
          ['candlewick', 'do NOT go upstairs'],
          ['m0rgue', 'jumpscare in 3 2 1'],
          ['hollow', 'turn the lights on'],
          ['bonesy', 'that whisper...'],
          ['ivy', 'I am hiding behind my cat'],
        ]}
      />
    </>
  );
}

/* ---------- 5. Blocky pixel world: original pixel art, code only ---------- */

function PixelScene() {
  return (
    <>
      <svg
        className="ss-fill px-world"
        viewBox="0 0 160 90"
        preserveAspectRatio="xMidYMid slice"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="px-dirt"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
          >
            <rect width="8" height="8" fill="#8a5a33" />
            <rect x="1" y="2" width="1" height="1" fill="#6e4426" />
            <rect x="5" y="1" width="1" height="1" fill="#a06c40" />
            <rect x="3" y="5" width="2" height="1" fill="#6e4426" />
            <rect x="6" y="6" width="1" height="1" fill="#a06c40" />
            <rect width="8" height="0.4" fill="#5d3920" />
            <rect width="0.4" height="8" fill="#5d3920" />
          </pattern>
          <pattern
            id="px-stone"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
          >
            <rect width="8" height="8" fill="#7d8087" />
            <rect x="2" y="1" width="2" height="1" fill="#6a6d73" />
            <rect x="5" y="4" width="2" height="1" fill="#93969c" />
            <rect x="1" y="6" width="1" height="1" fill="#6a6d73" />
            <rect width="8" height="0.4" fill="#5c5f65" />
            <rect width="0.4" height="8" fill="#5c5f65" />
          </pattern>
        </defs>
        <rect width="160" height="22" fill="#4aa8f5" />
        <rect y="22" width="160" height="18" fill="#63bdfb" />
        <rect y="40" width="160" height="14" fill="#86d0ff" />
        <rect y="54" width="160" height="36" fill="#b3e5ff" />
        <rect x="58" y="24" width="14" height="14" fill="#ffd23f" />
        <rect x="60" y="26" width="10" height="10" fill="#ffe066" />
        <g className="px-cloud a">
          <rect x="4" y="10" width="16" height="3" fill="#ffffff" />
          <rect x="0" y="13" width="26" height="3" fill="#ffffff" />
          <rect x="0" y="16" width="26" height="2" fill="#e3f2ff" />
        </g>
        <g className="px-cloud b">
          <rect x="74" y="24" width="10" height="2" fill="#ffffff" />
          <rect x="70" y="26" width="18" height="3" fill="#ffffff" />
          <rect x="70" y="29" width="18" height="1" fill="#e3f2ff" />
        </g>
        <g className="px-hills">
          <polygon
            fill="#7cc95c"
            points="0,62 12,62 12,56 24,56 24,50 40,50 40,56 52,56 52,60 70,60 70,54 86,54 86,48 100,48 100,54 116,54 116,58 132,58 132,52 148,52 148,58 160,58 160,72 0,72"
          />
        </g>
        <rect x="16" y="52" width="4" height="20" fill="#7a4a2a" />
        <rect x="17" y="52" width="1" height="20" fill="#8f5a34" />
        <rect x="8" y="36" width="20" height="16" fill="#3e9a32" />
        <rect x="10" y="38" width="4" height="4" fill="#58b448" />
        <rect x="20" y="42" width="4" height="4" fill="#2f7f26" />
        <rect x="14" y="46" width="4" height="3" fill="#58b448" />
        <g className="px-float">
          <rect x="86" y="44" width="8" height="8" fill="url(#px-dirt)" />
          <rect x="86" y="44" width="8" height="2" fill="#5bbf3a" />
          <rect x="86" y="46" width="8" height="1" fill="#4aa52e" />
        </g>
        <rect y="72" width="160" height="18" fill="url(#px-dirt)" />
        <rect y="72" width="160" height="3" fill="#5bbf3a" />
        <rect y="75" width="160" height="1" fill="#4aa52e" />
        {[6, 22, 38, 54, 86, 102, 134, 150].map((x) => (
          <rect key={x} x={x} y="75" width="2" height="2" fill="#5bbf3a" />
        ))}
        <rect x="120" y="64" width="8" height="8" fill="url(#px-stone)" />
        <rect x="128" y="64" width="8" height="8" fill="url(#px-stone)" />
        <rect x="124" y="56" width="8" height="8" fill="url(#px-stone)" />
      </svg>
      <div className="px-cam" aria-hidden="true">
        <span>CAM</span>
      </div>
      <div className="px-alert" aria-hidden="true">
        <svg viewBox="0 0 7 7" shapeRendering="crispEdges">
          <path d="M3 0h1v2h2v1h1v1H6v1H5v2H4V6H3v1H2V5H1V4H0V3h1V2h2z" />
        </svg>
        <span>
          LEVEL UP! <b>BRICK_7</b> SUBBED
        </span>
      </div>
      <div className="px-goal" aria-hidden="true">
        <span>SUB GOAL</span>
        <div className="px-goal-bar">
          <div className="px-goal-fill" />
        </div>
      </div>
      <Chat
        className="px-chat"
        lines={[
          ['DIGBY', 'found diamonds?!'],
          ['crafty_k', 'build a castle'],
          ['PIXELPIP', 'nice block placement'],
          ['moss', 'night is coming'],
          ['TOR', 'more torches pls'],
          ['bricky', 'GG'],
        ]}
      />
    </>
  );
}

/* ---------- 6. Racing / sim: all code ---------- */

function RacingScene() {
  // Tick marks for a 240 degree tachometer, 0 to 8.
  const ticks = Array.from({length: 9}, (_, i) => {
    const a = ((-210 + i * 30) * Math.PI) / 180;
    return {
      i,
      x1: 50 + Math.cos(a) * 34,
      y1: 50 + Math.sin(a) * 34,
      x2: 50 + Math.cos(a) * 41,
      y2: 50 + Math.sin(a) * 41,
      tx: 50 + Math.cos(a) * 26,
      ty: 50 + Math.sin(a) * 26,
    };
  });
  return (
    <>
      <div className="ss-fill rc-sky" />
      <div className="rc-sun" />
      <div className="rc-city" />
      <div className="rc-road" />
      <div className="rc-dash" />
      <div className="rc-side a" />
      <div className="rc-side b" />
      <div className="rc-cam" aria-hidden="true">
        <span>CAM</span>
      </div>
      <div className="rc-alert" aria-hidden="true">
        <small>FASTEST LAP</small>
        <span>
          <b>TurboTess</b> subscribed
        </span>
      </div>
      <Chat
        className="rc-chat"
        lines={[
          ['P1 APEX_R', 'send it into turn one'],
          ['P2 lowfuel', 'box box box'],
          ['P3 TurboTess', 'purple sector!'],
          ['P4 gridgirl', 'tyres are cooked'],
          ['P5 kerb', 'that overtake'],
          ['P6 slipstream', 'one more lap'],
        ]}
      />
      <svg className="rc-goal" viewBox="0 0 100 60" aria-hidden="true">
        <path className="rc-goal-track" d="M10 52 A40 40 0 0 1 90 52" />
        <path
          className="rc-goal-fill"
          d="M10 52 A40 40 0 0 1 90 52"
          pathLength="100"
        />
        <text x="50" y="42" className="rc-goal-pct">
          72%
        </text>
        <text x="50" y="55" className="rc-goal-label">
          SUB GOAL
        </text>
      </svg>
      <svg className="rc-tach" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="47" className="rc-tach-face" />
        <path className="rc-tach-hot" d="M 79.4 33 A 34 34 0 0 1 82.9 59" />
        {ticks.map((t) => (
          <g key={t.i}>
            <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
            <text x={t.tx} y={t.ty + 2.6}>
              {t.i}
            </text>
          </g>
        ))}
        <g className="rc-needle">
          <path d="M50 50 L50 13" />
        </g>
        <circle cx="50" cy="50" r="4" className="rc-hub" />
        <text x="50" y="76" className="rc-gear">
          4
        </text>
        <text x="50" y="86" className="rc-rpm">
          RPM x1000
        </text>
      </svg>
      <div className="rc-sting" aria-hidden="true" />
    </>
  );
}

const SCENES = {
  samurai: BladeScene,
  fps: FpsScene,
  cozy: CozyScene,
  horror: HorrorScene,
  pixel: PixelScene,
  racing: RacingScene,
};

const SETUP_STYLES = `
  .ss-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 1.1rem; }
  .ss-card { --ss-accent: #ffffff; --ss-glow: rgba(255, 255, 255, 0.2); grid-column: span 2; min-width: 0; display: flex; flex-direction: column; background: var(--sws-card-solid); border: 1px solid color-mix(in srgb, var(--ss-accent) 45%, transparent); border-radius: 18px; overflow: hidden; box-shadow: 0 24px 50px -30px var(--ss-glow); transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease; }
  .ss-card:hover { transform: translateY(-4px); box-shadow: 0 30px 60px -24px var(--ss-glow); }
  .ss-card:nth-child(n+5) { grid-column: span 3; }
  .ss-card.is-lead { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr); align-items: stretch; }
  .ss-card.is-lead .ss-stage { align-self: center; }
  .ss-t-samurai { --ss-accent: #ffb347; --ss-glow: rgba(255, 110, 30, 0.6); }
  .ss-t-fps { --ss-accent: #c6ff3d; --ss-glow: rgba(198, 255, 61, 0.4); }
  .ss-t-cozy { --ss-accent: #ffc6e0; --ss-glow: rgba(255, 198, 224, 0.45); }
  .ss-t-horror { --ss-accent: #a6ffcf; --ss-glow: rgba(166, 255, 207, 0.35); }
  .ss-t-pixel { --ss-accent: #7ddc4f; --ss-glow: rgba(125, 220, 79, 0.4); }
  .ss-t-racing { --ss-accent: #ff9a3c; --ss-glow: rgba(255, 138, 31, 0.45); }

  .ss-body { flex: 1; display: flex; flex-direction: column; gap: 0.55rem; padding: 1rem 1.1rem 1.2rem; }
  .ss-card.is-lead .ss-body { padding: 1.6rem 1.5rem; justify-content: center; }
  .ss-niche { align-self: flex-start; font-size: 0.76rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sws-ink); background: var(--ss-accent); border-radius: 999px; padding: 0.2rem 0.65rem; }
  .ss-body h3 { font-family: var(--font-display); font-weight: 800; font-size: 1.25rem; line-height: 1.15; margin: 0; }
  .ss-card.is-lead h3 { font-size: clamp(1.5rem, 2.6vw, 1.9rem); }
  .ss-hook { margin: 0; line-height: 1.5; }
  .ss-pieces { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .ss-pieces li { font-size: 0.8rem; font-weight: 700; border: 1px solid color-mix(in srgb, var(--ss-accent) 55%, transparent); border-radius: 999px; padding: 0.1rem 0.55rem; }
  .ss-caption { margin: 0; font-weight: 800; color: var(--ss-accent); }
  .ss-note { margin: 0; font-size: 0.88rem; line-height: 1.45; }
  .ss-actions { margin-top: auto; padding-top: 0.4rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1rem; }
  .ss-link { font-weight: 700; font-size: 0.92rem; }
  .ss-dots { display: none; }

  /* ---- Stage ---- */
  .ss-stage { position: relative; aspect-ratio: 16 / 9; overflow: hidden; container-type: inline-size; isolation: isolate; background: #07080a; font-family: var(--font-body, system-ui, sans-serif); }
  .ss-stage > * { position: absolute; }
  .ss-fill { inset: 0; width: 100%; height: 100%; }
  .ss-stage:not(.is-live) *, .ss-stage:not(.is-live) *::before, .ss-stage:not(.is-live) *::after { animation-play-state: paused !important; }
  .ss-chat { overflow: hidden; -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 22%); mask-image: linear-gradient(180deg, transparent 0, #000 22%); }
  .ss-chat ul { list-style: none; margin: 0; padding: 0; animation: ss-scroll 20s linear infinite; }
  .ss-chat li { margin: 0 0 1.1cqw; font-size: 2.2cqw; line-height: 1.3; }
  @keyframes ss-scroll { to { transform: translateY(-50%); } }
  @keyframes ss-alert { 0%, 46% { opacity: 0; transform: translateY(-1.5cqw) scale(0.92); } 52%, 86% { opacity: 1; transform: none; } 93%, 100% { opacity: 0; transform: translateY(-0.8cqw) scale(0.98); } }

  /* 1. Samurai */
  .bl-video { object-fit: cover; background: #0a0504 center / cover no-repeat; }
  .bl-shade { background: linear-gradient(90deg, rgba(0, 0, 0, 0.55) 0, transparent 30%, transparent 64%, rgba(0, 0, 0, 0.62) 100%); }
  .bl-embers { left: 0; right: 0; top: 0; height: 160%; pointer-events: none; }
  .bl-embers.a { background-image: radial-gradient(circle, rgba(255, 186, 90, 0.95) 0 0.22cqw, transparent 0.32cqw), radial-gradient(circle, rgba(255, 120, 40, 0.8) 0 0.16cqw, transparent 0.26cqw); background-size: 17cqw 22cqw, 23cqw 22cqw; background-position: 3cqw 4cqw, 11cqw 15cqw; animation: bl-rise-a 6s linear infinite; }
  .bl-embers.b { background-image: radial-gradient(circle, rgba(255, 200, 120, 0.7) 0 0.4cqw, transparent 0.7cqw); background-size: 29cqw 33cqw; background-position: 9cqw 20cqw; filter: blur(0.25cqw); animation: bl-rise-b 11s linear infinite; }
  @keyframes bl-rise-a { to { transform: translateY(-22cqw); } }
  @keyframes bl-rise-b { to { transform: translateY(-33cqw); } }
  .bl-cam { left: 3cqw; top: 3.5cqw; width: 25cqw; height: 14cqw; border: 0.3cqw solid #ffb347; border-radius: 0.6cqw; background: rgba(12, 6, 3, 0.45); box-shadow: 0 0 2.5cqw rgba(255, 120, 40, 0.45), inset 0 0 1.5cqw rgba(255, 120, 40, 0.25); display: grid; place-items: center; }
  .bl-cam::before, .bl-cam::after { content: ""; position: absolute; width: 4cqw; height: 4cqw; border: 0.55cqw solid #ffd08a; }
  .bl-cam::before { left: -0.9cqw; top: -0.9cqw; border-right: 0; border-bottom: 0; }
  .bl-cam::after { right: -0.9cqw; bottom: -0.9cqw; border-left: 0; border-top: 0; }
  .bl-cam span { font-size: 1.7cqw; font-weight: 800; letter-spacing: 0.3em; color: rgba(255, 208, 138, 0.75); }
  .bl-alert { left: 3cqw; top: 21cqw; display: flex; flex-direction: column; padding: 1.2cqw 2.2cqw 1.3cqw; background: linear-gradient(100deg, rgba(24, 8, 3, 0.94), rgba(24, 8, 3, 0.6)); border-left: 0.6cqw solid #ffb347; clip-path: polygon(0 0, 100% 0, 92% 100%, 0 100%); animation: ss-alert 8s ease-out infinite; }
  .bl-alert small { font-size: 1.5cqw; font-weight: 800; letter-spacing: 0.25em; text-transform: uppercase; color: #ffb347; }
  .bl-alert b { font-size: 3.2cqw; line-height: 1.1; color: #fff4e3; }
  .bl-alert em { font-style: normal; font-size: 1.7cqw; color: #ffd9a8; }
  .bl-chat { right: 3cqw; top: 4cqw; width: 27cqw; height: 34cqw; padding: 1.4cqw 1.6cqw; box-sizing: border-box; background: linear-gradient(180deg, rgba(14, 6, 3, 0.25), rgba(14, 6, 3, 0.72)); border-right: 0.35cqw solid #ffb347; }
  .bl-chat li { color: #f6ead8; text-shadow: 0 0.15cqw 0.4cqw #000; }
  .bl-chat b { color: #ffc36b; }

  /* 2. FPS */
  .fp-bg { background: radial-gradient(120% 90% at 70% 30%, #2b3520 0, #141a0f 55%, #080a06 100%); }
  .fp-grid { inset: -5cqw; background-image: linear-gradient(rgba(198, 255, 61, 0.08) 0.1cqw, transparent 0.1cqw), linear-gradient(90deg, rgba(198, 255, 61, 0.08) 0.1cqw, transparent 0.1cqw); background-size: 5cqw 5cqw; animation: fp-pan 14s linear infinite; }
  @keyframes fp-pan { to { transform: translate(5cqw, 5cqw); } }
  .fp-topo { inset: 0; width: 100%; height: 100%; fill: none; stroke: rgba(170, 190, 110, 0.22); stroke-width: 0.35; animation: fp-topo 18s ease-in-out infinite alternate; }
  @keyframes fp-topo { to { transform: translate(-3cqw, 1.5cqw) scale(1.04); } }
  .fp-cross { left: 50%; top: 46%; width: 7cqw; height: 7cqw; transform: translate(-50%, -50%); fill: none; stroke: rgba(198, 255, 61, 0.45); stroke-width: 1.4; }
  .fp-cam { left: 3cqw; top: 4cqw; width: 26cqw; height: 14.6cqw; background:
      linear-gradient(#c6ff3d, #c6ff3d) left top / 3.2cqw 0.4cqw no-repeat, linear-gradient(#c6ff3d, #c6ff3d) left top / 0.4cqw 3.2cqw no-repeat,
      linear-gradient(#c6ff3d, #c6ff3d) right top / 3.2cqw 0.4cqw no-repeat, linear-gradient(#c6ff3d, #c6ff3d) right top / 0.4cqw 3.2cqw no-repeat,
      linear-gradient(#c6ff3d, #c6ff3d) left bottom / 3.2cqw 0.4cqw no-repeat, linear-gradient(#c6ff3d, #c6ff3d) left bottom / 0.4cqw 3.2cqw no-repeat,
      linear-gradient(#c6ff3d, #c6ff3d) right bottom / 3.2cqw 0.4cqw no-repeat, linear-gradient(#c6ff3d, #c6ff3d) right bottom / 0.4cqw 3.2cqw no-repeat,
      rgba(8, 12, 6, 0.5); }
  .fp-cam span { position: absolute; left: 1.4cqw; top: 1.2cqw; display: flex; align-items: center; gap: 0.7cqw; font: 700 1.6cqw/1 ui-monospace, Menlo, monospace; letter-spacing: 0.15em; color: #c6ff3d; }
  .fp-cam i { width: 1.2cqw; height: 1.2cqw; border-radius: 50%; background: #ffb000; animation: fp-blink 1.2s steps(1) infinite; }
  @keyframes fp-blink { 50% { opacity: 0.15; } }
  .fp-feed { right: 3cqw; top: 4cqw; display: flex; flex-direction: column; align-items: flex-end; gap: 0.7cqw; }
  .fp-feed p { margin: 0; display: flex; align-items: center; gap: 0.9cqw; padding: 0.6cqw 1.2cqw; background: rgba(8, 10, 6, 0.8); border-right: 0.45cqw solid #c6ff3d; font: 700 1.7cqw/1 ui-monospace, Menlo, monospace; letter-spacing: 0.06em; color: #e8f5d0; animation: fp-feed 9s ease-out infinite; }
  .fp-feed p:nth-child(2) { animation-delay: 0.5s; }
  .fp-feed p:nth-child(3) { animation-delay: 1s; }
  .fp-feed b { color: #c6ff3d; }
  .fp-feed span { color: #ffb000; font-weight: 800; }
  .fp-feed svg { width: 1.8cqw; height: 1.8cqw; fill: none; stroke: #ffb000; stroke-width: 1.2; }
  @keyframes fp-feed { 0%, 4% { opacity: 0; transform: translateX(6cqw); } 9%, 70% { opacity: 1; transform: none; } 78%, 100% { opacity: 0; transform: translateX(2cqw); } }
  .fp-radar { left: 3cqw; bottom: 4cqw; width: 13cqw; height: 13cqw; border-radius: 50%; overflow: hidden; border: 0.25cqw solid rgba(198, 255, 61, 0.55); background: repeating-radial-gradient(circle, transparent 0 2.1cqw, rgba(198, 255, 61, 0.25) 2.1cqw 2.25cqw), rgba(8, 12, 6, 0.7); }
  .fp-radar::before { content: ""; position: absolute; inset: 0; background: conic-gradient(from 0deg, rgba(198, 255, 61, 0.6), transparent 26%); animation: fp-sweep 3.5s linear infinite; }
  .fp-radar i { position: absolute; left: 62%; top: 30%; width: 1cqw; height: 1cqw; border-radius: 50%; background: #ffb000; box-shadow: -4cqw 4.5cqw 0 -0.15cqw #ffb000; animation: fp-blink 1.75s steps(1) infinite; }
  @keyframes fp-sweep { to { transform: rotate(1turn); } }
  .fp-goal { left: 19cqw; bottom: 4.5cqw; width: 42cqw; }
  .fp-goal-label { display: flex; justify-content: space-between; margin-bottom: 0.7cqw; font: 700 1.6cqw/1 ui-monospace, Menlo, monospace; letter-spacing: 0.14em; color: #c6ff3d; }
  .fp-goal-label span + span { color: #ffb000; }
  .fp-goal-bar { position: relative; height: 2.6cqw; padding: 0.4cqw; border: 0.2cqw solid rgba(198, 255, 61, 0.6); background: repeating-linear-gradient(90deg, rgba(198, 255, 61, 0.12) 0 1.6cqw, transparent 1.6cqw 2.05cqw) 0.4cqw 0.4cqw / calc(100% - 0.8cqw) calc(100% - 0.8cqw) no-repeat; box-sizing: border-box; }
  .fp-goal-fill { height: 100%; width: 70%; background: repeating-linear-gradient(90deg, #c6ff3d 0 1.6cqw, transparent 1.6cqw 2.05cqw); filter: drop-shadow(0 0 0.6cqw rgba(198, 255, 61, 0.7)); animation: fp-fill 9s infinite; }
  @keyframes fp-fill { 0% { width: 10%; animation-timing-function: steps(16, end); } 75% { width: 100%; } 100% { width: 100%; } }
  .fp-chat { right: 3cqw; bottom: 4cqw; width: 31cqw; height: 27cqw; padding: 1.3cqw 1.5cqw; box-sizing: border-box; background: rgba(8, 10, 6, 0.72); border: 0.2cqw solid rgba(198, 255, 61, 0.4); clip-path: polygon(0 0, calc(100% - 3cqw) 0, 100% 3cqw, 100% 100%, 0 100%); }
  .fp-chat li { font: 600 1.9cqw/1.35 ui-monospace, Menlo, monospace; color: #e8f5d0; }
  .fp-chat b { color: #ffb000; }
  .fp-scan { background: repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.16) 0 0.2cqw, transparent 0.2cqw 0.5cqw); pointer-events: none; }

  /* 3. Cozy */
  .cz-bg { background: linear-gradient(160deg, #ffe0ee 0%, #fff0df 46%, #d6f4e8 100%); }
  .cz-clouds { left: 0; width: 200%; pointer-events: none; }
  .cz-clouds.a { top: 6cqw; height: 22cqw; background: radial-gradient(closest-side, rgba(255, 255, 255, 0.9), transparent) 0 0 / 30cqw 12cqw repeat-x; animation: cz-drift 40s linear infinite; }
  .cz-clouds.b { top: 30cqw; height: 26cqw; opacity: 0.7; background: radial-gradient(closest-side, rgba(255, 255, 255, 0.85), transparent) 12cqw 6cqw / 44cqw 16cqw repeat-x; animation: cz-drift 70s linear infinite; }
  @keyframes cz-drift { to { transform: translateX(-50%); } }
  .cz-star { font-size: 2.6cqw; line-height: 1; color: #f39cc4; animation: cz-twinkle 3.2s ease-in-out infinite; }
  .cz-star.b { color: #8fcff5; animation-delay: 1.1s; }
  .cz-star.c { color: #f5c76a; animation-delay: 2.2s; }
  @keyframes cz-twinkle { 50% { transform: scale(0.6) rotate(20deg); opacity: 0.45; } }
  .cz-model { left: 4cqw; bottom: 0; width: 29cqw; height: 46cqw; box-sizing: border-box; border: 0.45cqw dashed #e07fae; border-bottom: 0; border-radius: 14.5cqw 14.5cqw 0 0; background: radial-gradient(70% 55% at 50% 70%, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.3)); box-shadow: 0 0 4cqw rgba(255, 170, 210, 0.55); display: grid; place-items: center; }
  .cz-model span { font-size: 1.9cqw; font-weight: 700; color: #8a2f5c; letter-spacing: 0.04em; }
  .cz-jar { right: 5cqw; bottom: 5cqw; width: 20cqw; aspect-ratio: 0.62; padding: 0.6cqw; box-sizing: content-box; border-radius: 2.4cqw; background: #ffffff; box-shadow: 0 1.5cqw 4cqw rgba(214, 120, 170, 0.45); animation: cz-bob 5s ease-in-out infinite; }
  .cz-jar-art { position: absolute; inset: 0.6cqw; border-radius: 1.9cqw; background: #1b1838 no-repeat; background-size: 256.4% auto; background-position: 39.3% 73%; }
  @keyframes cz-bob { 50% { transform: translateY(-1.2cqw) rotate(-1.5deg); } }
  .cz-alert { right: 4cqw; top: 3.5cqw; padding: 1cqw 2.2cqw; border-radius: 999px; background: #ffffff; color: #a3346a; font-size: 2.1cqw; font-weight: 800; box-shadow: 0 1cqw 3cqw rgba(214, 120, 170, 0.4); animation: cz-pop 7s ease-out infinite; }
  .cz-alert span { color: #e0558f; }
  @keyframes cz-pop { 0%, 40% { opacity: 0; transform: scale(0.6); } 46% { opacity: 1; transform: scale(1.12); } 50%, 86% { opacity: 1; transform: scale(1); } 92%, 100% { opacity: 0; transform: scale(0.9); } }
  .cz-chat { left: 37cqw; top: 9cqw; width: 30cqw; height: 46cqw; }
  .cz-chat li { width: fit-content; max-width: 100%; box-sizing: border-box; padding: 0.8cqw 1.4cqw; border-radius: 2cqw 2cqw 2cqw 0.6cqw; background: rgba(255, 255, 255, 0.9); color: #3b2438; box-shadow: 0 0.5cqw 1.5cqw rgba(214, 120, 170, 0.18); }
  .cz-chat b { color: #b23f78; }
  .cz-chat li:nth-child(3n+2) b { color: #2d6f95; }
  .cz-chat li:nth-child(3n) b { color: #2f7a52; }

  /* 4. Horror */
  .hp-room { inset: -3cqw; background: #120d1c no-repeat; background-size: 110.3% auto; background-position: 50% 76%; animation: hp-drift 16s ease-in-out infinite alternate; }
  @keyframes hp-drift { to { transform: scale(1.05) translate(-1cqw, 0.6cqw); } }
  .hp-grade { background: radial-gradient(85% 75% at 50% 45%, transparent 35%, rgba(4, 10, 8, 0.8) 100%), linear-gradient(180deg, rgba(10, 50, 38, 0.2), rgba(6, 24, 20, 0.5)); }
  .hp-candle { left: 10cqw; top: 26cqw; width: 26cqw; height: 26cqw; border-radius: 50%; background: radial-gradient(closest-side, rgba(255, 214, 140, 0.4), transparent); mix-blend-mode: screen; animation: hp-flame 2.3s steps(1) infinite; }
  @keyframes hp-flame { 0% { opacity: 0.9; } 18% { opacity: 0.55; } 22% { opacity: 1; } 47% { opacity: 0.7; } 52% { opacity: 0.95; } 80% { opacity: 0.6; } }
  .hp-fog { left: 0; width: 220%; pointer-events: none; filter: blur(1.2cqw); }
  .hp-fog.a { bottom: -4cqw; height: 22cqw; background: radial-gradient(closest-side, rgba(200, 255, 230, 0.28), transparent) 0 0 / 40cqw 22cqw repeat-x; animation: hp-fog 26s linear infinite; }
  .hp-fog.b { bottom: 6cqw; height: 18cqw; opacity: 0.8; background: radial-gradient(closest-side, rgba(220, 240, 255, 0.2), transparent) 15cqw 0 / 60cqw 18cqw repeat-x; animation: hp-fog 44s linear infinite reverse; }
  @keyframes hp-fog { to { transform: translateX(-50%); } }
  .hp-cam { left: 3.5cqw; top: 4cqw; width: 24cqw; height: 13.5cqw; border: 0.3cqw solid #a6ffcf; border-radius: 0.5cqw; background: rgba(5, 10, 8, 0.6); box-shadow: 0 0 2cqw rgba(166, 255, 207, 0.45); display: grid; place-items: center; }
  .hp-cam svg { position: absolute; right: 0; top: 0; width: 6cqw; height: 6cqw; fill: none; stroke: rgba(230, 255, 245, 0.7); stroke-width: 0.6; }
  .hp-cam span { font-size: 1.6cqw; font-weight: 800; letter-spacing: 0.3em; color: rgba(166, 255, 207, 0.8); }
  .hp-alert { left: 50%; top: 4cqw; width: 34cqw; aspect-ratio: 663 / 232; margin-left: -17cqw; background: #0c0912 no-repeat; background-size: 239.5% auto; background-position: 8.1% 30.3%; border-radius: 1cqw; animation: hp-flicker 7s infinite; }
  .hp-alert span { position: absolute; left: 10%; right: 6%; top: 52%; text-align: center; font-size: 2cqw; color: #efe6ff; text-shadow: 0 0 1cqw rgba(183, 157, 242, 0.9); }
  .hp-alert b { color: #a6ffcf; }
  @keyframes hp-flicker { 0%, 40% { opacity: 0; } 41% { opacity: 0.9; } 42% { opacity: 0.15; } 43% { opacity: 1; } 46% { opacity: 0.35; } 47%, 70% { opacity: 1; } 71% { opacity: 0.4; } 72%, 86% { opacity: 1; } 90%, 100% { opacity: 0; } }
  .hp-chat { right: 3.5cqw; top: 4cqw; width: 25cqw; height: 47cqw; padding: 1.3cqw 1.5cqw; box-sizing: border-box; background: rgba(8, 6, 14, 0.66); border: 0.2cqw solid rgba(166, 255, 207, 0.4); border-radius: 0.8cqw; }
  .hp-chat li { color: #efe9f7; }
  .hp-chat b { color: #a6ffcf; }

  /* 5. Pixel */
  .px-world { image-rendering: pixelated; }
  .px-cloud.a { animation: px-cloud-a 34s linear infinite; }
  .px-cloud.b { animation: px-cloud-b 52s linear infinite; }
  @keyframes px-cloud-a { from { transform: translateX(-30px); } to { transform: translateX(170px); } }
  @keyframes px-cloud-b { from { transform: translateX(-100px); } to { transform: translateX(100px); } }
  .px-float { animation: px-bob 2.4s steps(2) infinite; }
  @keyframes px-bob { 50% { transform: translateY(-2px); } }
  .px-cam, .px-chat, .px-goal, .px-alert { font-family: ui-monospace, 'Courier New', monospace; font-weight: 800; text-transform: uppercase; }
  .px-cam { left: 3cqw; top: 4cqw; width: 24cqw; height: 13.5cqw; box-sizing: border-box; border: 0.9cqw solid #a0703f; background: rgba(18, 30, 44, 0.35); box-shadow: inset 0 0 0 0.45cqw #6b4423, 0 0 0 0.45cqw #4a2e16, 0.6cqw 0.6cqw 0 0.45cqw rgba(0, 0, 0, 0.3); display: grid; place-items: center; }
  .px-cam span { font-size: 1.8cqw; color: #fff; text-shadow: 0.25cqw 0.25cqw 0 #000; letter-spacing: 0.2em; }
  .px-chat { right: 3cqw; top: 4cqw; width: 31cqw; height: 29cqw; padding: 1.4cqw 1.6cqw; box-sizing: border-box; background: rgba(47, 50, 56, 0.92); border: 0.5cqw solid #1f2125; box-shadow: inset 0.5cqw 0.5cqw 0 #8d9198, inset -0.5cqw -0.5cqw 0 #4a4d53; -webkit-mask-image: none; mask-image: none; }
  .px-chat ul { animation-timing-function: steps(24); }
  .px-chat li { font-size: 1.85cqw; line-height: 1.35; color: #ffffff; text-shadow: 0.2cqw 0.2cqw 0 #000; }
  .px-chat b { color: #ffe066; }
  .px-chat li:nth-child(3n+2) b { color: #8af06a; }
  .px-chat li:nth-child(3n) b { color: #7fe6ff; }
  .px-alert { left: 30cqw; top: 4cqw; display: flex; align-items: center; gap: 1.2cqw; padding: 1cqw 1.8cqw; background: #ffcf3f; border: 0.55cqw solid #6b4300; box-shadow: inset 0 -0.6cqw 0 #e0a800, 0.7cqw 0.7cqw 0 rgba(0, 0, 0, 0.35); color: #3a2200; font-size: 1.9cqw; animation: px-alert 6s steps(1) infinite; }
  .px-alert b { color: #000; }
  .px-alert svg { width: 3cqw; height: 3cqw; fill: #fff6c2; animation: px-spin 0.8s steps(4) infinite; }
  @keyframes px-spin { to { transform: rotate(90deg); } }
  @keyframes px-alert { 0%, 38% { opacity: 0; transform: translateY(-2cqw); } 40% { opacity: 1; transform: translateY(-1cqw); } 42%, 82% { opacity: 1; transform: none; } 50% { transform: translateY(-0.6cqw); } 54% { transform: none; } 84%, 100% { opacity: 0; } }
  .px-goal { left: 30cqw; bottom: 13cqw; width: 32cqw; }
  .px-goal > span { display: block; margin-bottom: 0.7cqw; font-size: 1.8cqw; color: #fff; text-shadow: 0.25cqw 0.25cqw 0 #000; }
  .px-goal-bar { position: relative; height: 3.4cqw; background: repeating-linear-gradient(90deg, #3a3d42 0 3cqw, #1f2125 3cqw 3.4cqw); border: 0.4cqw solid #1f2125; }
  .px-goal-fill { height: 100%; width: 60%; background: repeating-linear-gradient(90deg, #ffcf3f 0 3cqw, #1f2125 3cqw 3.4cqw); box-shadow: inset 0 0.6cqw 0 rgba(255, 255, 255, 0.35); animation: px-fill 10s infinite; }
  @keyframes px-fill { 0% { width: 0; animation-timing-function: steps(10, end); } 80% { width: 100%; } 100% { width: 100%; } }

  /* 6. Racing */
  .rc-sky { background: linear-gradient(180deg, #0c1222 0%, #1d2547 28%, #7d3a78 43%, #ff7a3d 52%, #ffc070 58%, #0e1014 58%); }
  .rc-sun { left: 50%; top: 20.6cqw; width: 24cqw; height: 12cqw; margin-left: -12cqw; border-radius: 12cqw 12cqw 0 0; background: linear-gradient(180deg, #ffe08a, #ff8a1f 70%, #ff6a3d); -webkit-mask-image: linear-gradient(#000 0 45%, transparent 45%), repeating-linear-gradient(180deg, #000 0 1.3cqw, transparent 1.3cqw 1.8cqw); mask-image: linear-gradient(#000 0 45%, transparent 45%), repeating-linear-gradient(180deg, #000 0 1.3cqw, transparent 1.3cqw 1.8cqw); }
  .rc-city { left: 0; width: 200%; bottom: 42%; height: 8cqw; background: #0b0d14; clip-path: polygon(0 100%, 0 60%, 3% 60%, 3% 30%, 6% 30%, 6% 55%, 9% 55%, 9% 15%, 11% 15%, 11% 50%, 15% 50%, 15% 40%, 19% 40%, 19% 70%, 23% 70%, 23% 25%, 25% 25%, 25% 60%, 28% 60%, 28% 45%, 33% 45%, 33% 75%, 37% 75%, 37% 35%, 40% 35%, 40% 60%, 44% 60%, 44% 20%, 46% 20%, 46% 65%, 50% 65%, 50% 60%, 53% 60%, 53% 30%, 56% 30%, 56% 55%, 59% 55%, 59% 15%, 61% 15%, 61% 50%, 65% 50%, 65% 40%, 69% 40%, 69% 70%, 73% 70%, 73% 25%, 75% 25%, 75% 60%, 78% 60%, 78% 45%, 83% 45%, 83% 75%, 87% 75%, 87% 35%, 90% 35%, 90% 60%, 94% 60%, 94% 20%, 96% 20%, 96% 65%, 100% 65%, 100% 100%); animation: rc-city 30s linear infinite; }
  @keyframes rc-city { to { transform: translateX(-50%); } }
  .rc-road { left: 0; right: 0; bottom: 0; top: 58%; background: linear-gradient(180deg, #15171c, #2a2e36); clip-path: polygon(44% 0, 56% 0, 100% 100%, 0 100%); }
  .rc-road::before, .rc-road::after { content: ""; position: absolute; inset: 0; background: #ff8a1f; }
  .rc-road::before { clip-path: polygon(44% 0, 44.7% 0, 6% 100%, 0 100%); }
  .rc-road::after { clip-path: polygon(55.3% 0, 56% 0, 100% 100%, 94% 100%); }
  .rc-dash { left: 0; right: 0; bottom: 0; top: 58%; clip-path: polygon(49.7% 0, 50.3% 0, 51.6% 100%, 48.4% 100%); background: repeating-linear-gradient(180deg, #ffe9c2 0 2.6cqw, transparent 2.6cqw 6cqw); animation: rc-road 0.45s linear infinite; }
  @keyframes rc-road { to { background-position: 0 6cqw; } }
  .rc-side { left: 0; width: 100%; height: 0.3cqw; background: linear-gradient(90deg, transparent, rgba(0, 229, 255, 0.85), transparent); animation: rc-streak 1.4s linear infinite; }
  .rc-side.a { top: 70%; }
  .rc-side.b { top: 84%; animation-duration: 0.9s; animation-delay: 0.4s; }
  @keyframes rc-streak { from { transform: translateX(100%) scaleX(0.4); } to { transform: translateX(-100%) scaleX(1); } }
  .rc-cam { left: 3cqw; top: 4cqw; width: 25cqw; height: 13.5cqw; background: #ff8a1f; clip-path: polygon(7% 0, 100% 0, 93% 100%, 0 100%); display: grid; place-items: center; }
  .rc-cam::before { content: ""; position: absolute; inset: 0.45cqw 0.9cqw; background: rgba(10, 12, 16, 0.85); clip-path: polygon(7% 0, 100% 0, 93% 100%, 0 100%); }
  .rc-cam span { position: relative; font-size: 1.6cqw; font-weight: 800; letter-spacing: 0.3em; color: #00e5ff; }
  .rc-alert { right: 3cqw; top: 4cqw; display: flex; flex-direction: column; padding: 1cqw 2.6cqw 1.1cqw 3cqw; background: linear-gradient(90deg, #00e5ff, #6af3ff); color: #06222a; clip-path: polygon(6% 0, 100% 0, 94% 100%, 0 100%); animation: rc-alert 8s cubic-bezier(0.2, 0.9, 0.2, 1) infinite; }
  .rc-alert small { font-size: 1.4cqw; font-weight: 800; letter-spacing: 0.25em; }
  .rc-alert span { font-size: 2.4cqw; font-weight: 700; }
  @keyframes rc-alert { 0%, 30% { opacity: 0; transform: translateX(12cqw); } 34%, 78% { opacity: 1; transform: none; } 82%, 100% { opacity: 0; transform: translateX(-6cqw); } }
  .rc-chat { left: 3cqw; top: 21cqw; width: 30cqw; height: 18cqw; padding: 0.8cqw 1.2cqw; box-sizing: border-box; background: rgba(10, 12, 16, 0.82); border-left: 0.5cqw solid #ff8a1f; }
  .rc-chat li { font-size: 1.75cqw; color: #f2f4f7; }
  .rc-chat b { color: #ffb066; font-family: ui-monospace, Menlo, monospace; }
  .rc-goal { left: 3cqw; bottom: 2.5cqw; width: 22cqw; height: auto; overflow: visible; }
  .rc-goal-track, .rc-goal-fill { fill: none; stroke-width: 8; stroke-linecap: round; }
  .rc-goal-track { stroke: rgba(10, 12, 16, 0.85); stroke-width: 11; }
  .rc-goal-fill { stroke: #00e5ff; stroke-dasharray: 72 100; filter: drop-shadow(0 0 2px #00e5ff); animation: rc-goal 9s ease-in-out infinite; }
  @keyframes rc-goal { 0% { stroke-dasharray: 8 100; } 70%, 100% { stroke-dasharray: 72 100; } }
  .rc-goal-pct { font: 800 14px/1 ui-monospace, Menlo, monospace; fill: #ffffff; text-anchor: middle; paint-order: stroke; stroke: rgba(10, 12, 16, 0.9); stroke-width: 3px; }
  .rc-goal-label { font: 800 6.5px/1 system-ui, sans-serif; letter-spacing: 1px; fill: #00e5ff; text-anchor: middle; paint-order: stroke; stroke: rgba(10, 12, 16, 0.9); stroke-width: 2px; }
  .rc-tach { right: 3cqw; bottom: 3cqw; width: 21cqw; height: 21cqw; }
  .rc-tach-face { fill: rgba(10, 12, 16, 0.9); stroke: #ff8a1f; stroke-width: 1.5; }
  .rc-tach line { stroke: #f2f4f7; stroke-width: 1.6; }
  .rc-tach text { font: 700 7px/1 ui-monospace, Menlo, monospace; fill: #f2f4f7; text-anchor: middle; }
  .rc-tach-hot { fill: none; stroke: #ffb000; stroke-width: 4; }
  .rc-tach .rc-gear { font-size: 13px; fill: #00e5ff; }
  .rc-tach .rc-rpm { font-size: 4.5px; fill: #a9b0bb; letter-spacing: 0.5px; }
  .rc-needle { transform-origin: 50px 50px; transform: rotate(60deg); animation: rc-rev 6s ease-in-out infinite; }
  .rc-needle path { stroke: #ff8a1f; stroke-width: 2.4; stroke-linecap: round; }
  .rc-hub { fill: #f2f4f7; }
  @keyframes rc-rev { 0% { transform: rotate(-120deg); } 28% { transform: rotate(95deg); } 33% { transform: rotate(10deg); } 58% { transform: rotate(100deg); } 63% { transform: rotate(25deg); } 88% { transform: rotate(80deg); } 100% { transform: rotate(-120deg); } }
  .rc-sting { top: -10%; bottom: -10%; left: -20%; width: 140%; transform: translateX(-130%) skewX(-18deg); background: linear-gradient(90deg, transparent 0, #ff8a1f 6%, #ff8a1f 30%, #0d0f13 30%, #0d0f13 70%, #00e5ff 70%, #00e5ff 94%, transparent 100%); animation: rc-sting 9s cubic-bezier(0.7, 0, 0.3, 1) infinite; }
  .rc-sting::after { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(180deg, transparent 0 2cqw, rgba(255, 255, 255, 0.55) 2cqw 2.3cqw); }
  @keyframes rc-sting { 0%, 86% { transform: translateX(-130%) skewX(-18deg); } 100% { transform: translateX(130%) skewX(-18deg); } }

  @media (max-width: 760px) {
    .ss-grid { display: flex; gap: 0.85rem; overflow-x: auto; scroll-snap-type: x mandatory; margin: 0 -1.25rem; padding: 0.4rem 1.25rem 1rem; scroll-padding: 0 1.25rem; scrollbar-width: none; overscroll-behavior-x: contain; }
    .ss-grid::-webkit-scrollbar { display: none; }
    .ss-card, .ss-card.is-lead { flex: 0 0 86%; display: flex; scroll-snap-align: start; }
    .ss-card.is-lead .ss-stage { align-self: stretch; }
    .ss-card.is-lead .ss-body { padding: 1rem 1.1rem 1.2rem; justify-content: flex-start; }
    .ss-grid.has-js .ss-card:not(.is-active) { transform: scale(0.95); opacity: 0.7; }
    .ss-grid.has-js .ss-card.is-active { box-shadow: 0 20px 44px -18px var(--ss-glow); }
    .ss-card:hover { transform: none; }
    .ss-actions .sws-btn { width: 100%; }
    .ss-dots { display: flex; justify-content: center; gap: 0.45rem; margin-top: 0.2rem; }
    .ss-dots span { width: 0.5rem; height: 0.5rem; border-radius: 999px; background: var(--sws-border-strong); transition: width 0.2s ease, background 0.2s ease; }
    .ss-dots span.on { width: 1.4rem; background: var(--sws-holo-1); }
  }
  @media (prefers-reduced-motion: reduce) {
    .ss-stage *, .ss-stage *::before, .ss-stage *::after { animation: none !important; }
    .ss-card, .ss-dots span { transition: none; }
    .ss-card:hover { transform: none; }
    .ss-grid { scroll-behavior: auto; }
  }
`;
