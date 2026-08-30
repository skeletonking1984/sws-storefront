import {useState} from 'react';
import {Link} from 'react-router';

const SUPPORT_EMAIL = 'streamwidgetshop@gmail.com';

// Shopify's built-in contact-form endpoint, matched to the exact field
// names used by the live theme's own contact form (verified by inspecting
// the real form at streamwidgetshop.com/pages/contact) and posted to the
// canonical custom domain — the myshopify.com subdomain silently drops
// submissions. Posted via fetch(no-cors) so the visitor stays on our
// branded page instead of bouncing to another domain.
const STORE_DOMAIN = 'streamwidgetshop.com';

/**
 * The Shopify "Contact" page has no body content configured, so this
 * renders a real, working contact experience instead of a blank page.
 */
export function ContactPage() {
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setStatus('sending');
    try {
      const body = new URLSearchParams();
      body.set('form_type', 'contact');
      body.set('utf8', '✓');
      body.set('contact[First name]', data.get('name'));
      body.set('contact[email]', data.get('email'));
      body.set('contact[Phone number]', '');
      body.set('contact[Comment]', data.get('message'));

      // no-cors: we can't read the response, but the request still reaches
      // Shopify's server and gets processed — this is the standard pattern
      // for posting to Shopify's contact endpoint from off-domain.
      await fetch(`https://${STORE_DOMAIN}/contact`, {
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
    <div className="contact-page">
      <p className="contact-intro">
        Have a question about setup, an order, or want something fully
        custom? We respond within 4 hours.
      </p>

      {status === 'sent' ? (
        <div className="contact-form-success">
          <h3>Message sent!</h3>
          <p>
            Thanks for reaching out — we'll get back to you within 4 hours.
            You can also email us directly at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </div>
      ) : (
        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="contact-form-row">
            <label htmlFor="contact-name">Name</label>
            <input id="contact-name" name="name" type="text" required />
          </div>
          <div className="contact-form-row">
            <label htmlFor="contact-email">Email</label>
            <input id="contact-email" name="email" type="email" required />
          </div>
          <div className="contact-form-row">
            <label htmlFor="contact-message">Message</label>
            <textarea id="contact-message" name="message" rows={5} required />
          </div>
          <button
            type="submit"
            className="hero-cta"
            disabled={status === 'sending'}
          >
            {status === 'sending' ? 'Sending…' : 'Send message'}
          </button>
          {status === 'error' && (
            <p className="contact-form-error">
              Something went wrong — email us directly at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> instead.
            </p>
          )}
        </form>
      )}

      <p className="contact-alt-email">
        Prefer email? Reach us at{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>

      <div className="contact-links-grid">
        <Link to="/pages/faq-frequently-asked-questions" className="contact-link-card">
          <h3>Have a quick question?</h3>
          <p>Check the FAQ — setup, compatibility, orders, and refunds.</p>
        </Link>
        <Link to="/pages/how-it-works" className="contact-link-card">
          <h3>Need setup help?</h3>
          <p>Step-by-step guide to get any widget live in under a minute.</p>
        </Link>
        <Link to="/" className="contact-link-card">
          <h3>Premium Overlays + Widgets Custom Design</h3>
          <p>We build fully custom chat and goal widgets — starting at $300.</p>
        </Link>
      </div>
    </div>
  );
}
