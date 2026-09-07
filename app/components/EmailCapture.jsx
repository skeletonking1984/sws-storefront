import {useState} from 'react';

// Same canonical custom domain as ContactPage.jsx — the myshopify.com
// subdomain silently drops submissions. form_type=customer creates/updates
// a Shopify customer record from just an email, no account required.
const STORE_DOMAIN = 'streamwidgetshop.com';

/**
 * "Get the next drop first" email capture, posted straight to Shopify's
 * customer form endpoint. Promises a 10% code (WELCOME10, created in
 * Admin) — see LAUNCH.md for whether that code exists yet.
 */
export function EmailCapture() {
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setStatus('sending');
    try {
      const body = new URLSearchParams();
      body.set('form_type', 'customer');
      body.set('utf8', '✓');
      body.set('contact[email]', data.get('email'));
      body.set('contact[tags]', 'newsletter');

      await fetch(`https://${STORE_DOMAIN}/contact#contact_form`, {
        method: 'POST',
        mode: 'no-cors',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body,
      });
      setStatus('sent');
      form.reset();
    } catch {
      setStatus('error');
    }
  }

  return (
    <section className="email-capture" aria-labelledby="email-capture-heading">
      <div className="email-capture-inner sws-glass-card">
        <h2 id="email-capture-heading">Get the next drop first</h2>
        <p>
          New widget packs and seasonal themes, straight to your inbox. Sign
          up now and get 10% off your next order (code WELCOME10).
        </p>
        {status === 'sent' ? (
          <p className="email-capture-success">
            You&rsquo;re on the list. Check your inbox for the code.
          </p>
        ) : (
          <form className="email-capture-form" onSubmit={handleSubmit}>
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              aria-label="Email address"
            />
            <button
              type="submit"
              className="sws-btn sws-btn-primary"
              disabled={status === 'sending'}
            >
              {status === 'sending' ? 'Sending...' : 'Get the code'}
            </button>
          </form>
        )}
        {status === 'error' && (
          <p className="email-capture-error">
            Something went wrong. Try again in a moment.
          </p>
        )}
      </div>
    </section>
  );
}
