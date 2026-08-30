import {Link} from 'react-router';

const SUPPORT_EMAIL = 'support@streamwidgetshop.com';

/**
 * The Shopify "Contact" page has no body content configured, so this
 * renders a real, working contact experience instead of a blank page.
 */
export function ContactPage() {
  return (
    <div className="contact-page">
      <p className="contact-intro">
        Have a question about setup, an order, or want something fully
        custom? We respond within 4 hours.
      </p>

      <a
        className="hero-cta contact-email-cta"
        href={`mailto:${SUPPORT_EMAIL}`}
      >
        Email {SUPPORT_EMAIL}
      </a>

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
          <h3>Want something custom?</h3>
          <p>We build fully custom chat and goal widgets — $85 flat.</p>
        </Link>
      </div>
    </div>
  );
}
