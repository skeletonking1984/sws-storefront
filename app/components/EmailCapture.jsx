import {Form, useActionData, useNavigation} from 'react-router';

export const WELCOME_CODE = 'WELCOME10';

/**
 * "Get the next drop first" email capture.
 *
 * Submits to the homepage route's own server side `action` (see
 * `app/routes/_index.jsx`). It used to post client side with
 * `fetch(mode: 'no-cors')` to `streamwidgetshop.com/contact`, which has
 * returned 405 since the DNS cutover put the Hydrogen app on that domain. An
 * opaque no-cors response never rejects, so it reported success for every
 * dropped signup.
 *
 * Uses `Form` + `useActionData()` rather than a fetcher, for the same reason
 * `ContactPage` does: a fetcher's result only reaches the browser through the
 * client hydration stream, so the no-JS case renders no result at all.
 *
 * The 10% code is shown on the page rather than only promised by email. It is
 * a real, active, open ended discount, so showing it keeps the promise even
 * when the signup itself could not be recorded.
 */
export function EmailCapture() {
  const result = useActionData();
  const navigation = useNavigation();
  const sending = navigation.state !== 'idle';
  const isSignup = result?.intent === 'newsletter';
  const sent = isSignup && result.ok === true;
  const failed = isSignup && result.ok === false;

  return (
    <section className="email-capture" aria-labelledby="email-capture-heading">
      <div className="email-capture-inner sws-glass-card">
        <h2 id="email-capture-heading">Get the next drop first</h2>
        <p>
          New widget packs and seasonal themes, straight to your inbox. Sign
          up now and get 10% off your next order.
        </p>

        {sent ? (
          <div className="email-capture-success">
            <p>
              You&rsquo;re on the list. Use code{' '}
              <strong className="email-capture-code">{WELCOME_CODE}</strong> at
              checkout for 10% off.
            </p>
          </div>
        ) : (
          <Form className="email-capture-form" method="post">
            <input type="hidden" name="intent" value="newsletter" />
            <input
              type="email"
              name="email"
              required
              defaultValue={result?.values?.email}
              placeholder="you@example.com"
              aria-label="Email address"
            />
            <div className="contact-form-honeypot" aria-hidden="true">
              <label htmlFor="newsletter-company">Company</label>
              <input
                id="newsletter-company"
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
              {sending ? 'Sending...' : 'Get the code'}
            </button>
          </Form>
        )}

        {failed && result.reason === 'invalid' && (
          <p className="email-capture-error">Enter a valid email address.</p>
        )}

        {failed && result.reason !== 'invalid' && (
          <p className="email-capture-error">
            We could not add you to the list just now, so here is the code
            anyway: use{' '}
            <strong className="email-capture-code">{WELCOME_CODE}</strong> at
            checkout for 10% off.
          </p>
        )}
      </div>
    </section>
  );
}
