import {Form, Link, useActionData, useNavigation} from 'react-router';

const SUPPORT_EMAIL = 'streamwidgetshop@gmail.com';

/**
 * The Shopify "Contact" page has no body content configured, so this
 * renders a real, working contact experience instead of a blank page.
 * Submits to this route's own server side `action` (see
 * `app/routes/pages.$handle.jsx`) so the message actually gets sent.
 *
 * Uses `Form` + `useActionData()` rather than `useFetcher()`/`fetcher.Form`.
 * Verified with curl (a true no-JS client): a fetcher's result only reaches
 * the browser through the client-side hydration stream, so a no-JS POST
 * re-rendered the idle form with no success or error shown even though the
 * action ran correctly. `useActionData()` puts the result straight into the
 * server rendered HTML for the request that submitted it, so it actually
 * works without JS. `useNavigation()` still gives a real pending state once
 * JS is on.
 */
export function ContactPage() {
  const result = useActionData();
  const navigation = useNavigation();
  const sending = navigation.state !== 'idle';
  const sent = result?.ok === true;
  const values = result?.values || {};
  const fieldErrors = result?.fieldErrors || {};

  const mailtoHref =
    result?.ok === false &&
    (result.reason === 'not_configured' || result.reason === 'send_failed')
      ? buildMailtoHref(values)
      : null;

  return (
    <div className="contact-page">
      <p className="contact-intro">
        Have a question about setup, an order, or want something fully
        custom? We respond within 4 hours.
      </p>

      {sent ? (
        <div className="contact-form-success">
          <h3>Message sent!</h3>
          <p>
            Thanks for reaching out. We'll get back to you within 4 hours.
            You can also email us directly at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </div>
      ) : (
        <Form
          className="contact-form"
          method="post"
          toolname="contact_shop"
          tooldescription="Send a message to Stream Widget Shop, for support with a widget or to ask about a custom commission."
        >
          <div className="contact-form-row">
            <label htmlFor="contact-name">Name</label>
            <input
              id="contact-name"
              name="name"
              type="text"
              defaultValue={values.name}
              required
              toolparamdescription="The sender's name."
            />
            {fieldErrors.name && (
              <p className="contact-form-field-error">{fieldErrors.name}</p>
            )}
          </div>
          <div className="contact-form-row">
            <label htmlFor="contact-email">Email</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              defaultValue={values.email}
              required
              toolparamdescription="The sender's email address, used for the reply."
            />
            {fieldErrors.email && (
              <p className="contact-form-field-error">{fieldErrors.email}</p>
            )}
          </div>
          <div className="contact-form-row">
            <label htmlFor="contact-message">Message</label>
            <textarea
              id="contact-message"
              toolparamdescription="The message to send to the shop."
              name="message"
              rows={5}
              defaultValue={values.message}
              required
            />
            {fieldErrors.message && (
              <p className="contact-form-field-error">
                {fieldErrors.message}
              </p>
            )}
          </div>
          <div className="contact-form-honeypot" aria-hidden="true">
            <label htmlFor="contact-company">Company</label>
            <input
              id="contact-company"
              name="company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            className="sws-btn sws-btn-primary"
            disabled={sending}
          >
            {sending ? 'Sending...' : 'Send message'}
          </button>

          {result?.ok === false && result.reason !== 'invalid' && (
            <div className="contact-form-error">
              <p>
                We could not send that just now. Please try again, or send it
                straight from your own email app instead:
              </p>
              {mailtoHref && (
                <a
                  href={mailtoHref}
                  className="sws-btn sws-btn-primary contact-form-mailto-btn"
                >
                  Send it from your email app instead
                </a>
              )}
            </div>
          )}
        </Form>
      )}

      <p className="contact-alt-email">
        Prefer email? Reach us at{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>

      <div className="contact-links-grid">
        <Link to="/pages/faq-frequently-asked-questions" className="contact-link-card">
          <h3>Have a quick question?</h3>
          <p>Check the FAQ for setup, compatibility, orders, and refunds.</p>
        </Link>
        <Link to="/pages/how-it-works" className="contact-link-card">
          <h3>Need setup help?</h3>
          <p>Step-by-step guide to get any widget live in under a minute.</p>
        </Link>
        <Link to="/" className="contact-link-card">
          <h3>Premium Overlays + Widgets Custom Design</h3>
          <p>We build fully custom chat and goal widgets, starting at $300.</p>
        </Link>
      </div>
    </div>
  );
}

function buildMailtoHref(values) {
  const name = values?.name || '';
  const message = values?.message || '';
  const subject = `Question from ${name}`;
  // encodeURIComponent, not URLSearchParams: URLSearchParams encodes a space
  // as "+", and mail clients render that literally in a mailto subject or
  // body rather than as a space.
  const query = `subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(message)}`;
  return `mailto:${SUPPORT_EMAIL}?${query}`;
}
