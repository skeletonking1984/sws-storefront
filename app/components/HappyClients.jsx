import {HAPPY_CLIENTS} from '~/data/happyClients';

/**
 * The streamers who bought SWS widgets, each linked to their own channel.
 *
 * The old theme rendered this as a Shopify image-gallery slider: twelve flat
 * circles on a visible scrollbar, with the section heading jammed in as the
 * first slide and no names on any face, so a visitor could not tell who they
 * were looking at or that the circles were even clickable.
 *
 * Here they are a wrapping grid, no scrollbar, each face carrying its own
 * handle and a holo ring that lights up on hover and keyboard focus. Two of
 * the links go to a Twitch clip rather than a channel, and those say so,
 * because a clip is the stronger proof and a visitor should know which kind
 * of link they are about to follow.
 *
 * Every name and face is real, read out of the old theme. Nothing here is
 * invented, and no testimonial text is put in anyone's mouth.
 */
export function HappyClients() {
  return (
    <section className="happy-clients" aria-labelledby="happy-clients-heading">
      <h2 id="happy-clients-heading">Happy clients</h2>
      <p className="happy-clients-sub">
        Every face here links to their own channel.
      </p>

      <ul className="happy-clients-grid">
        {HAPPY_CLIENTS.map((client) => (
          <li className="happy-clients-item" key={client.handle}>
            <a
              className="happy-clients-link"
              href={client.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="happy-clients-ring">
                <img
                  src={client.image}
                  alt={`${client.handle} on Twitch`}
                  width="96"
                  height="96"
                  loading="lazy"
                />
                {client.clip ? (
                  <span className="happy-clients-clip" aria-hidden="true">
                    ▶
                  </span>
                ) : null}
              </span>
              <span className="happy-clients-handle">{client.handle}</span>
              {client.clip ? (
                <span className="happy-clients-note">watch the clip</span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
