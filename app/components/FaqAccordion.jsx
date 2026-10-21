import {parseFaqBody} from '~/lib/pageContent';
import {buildFaqJsonLd} from '~/lib/faqJsonLd';

/**
 * @param {{html: string}}
 */
export function FaqAccordion({html}) {
  const items = parseFaqBody(html);
  // Emitted from the same parse as the visible accordion, on both surfaces
  // that render it (the PDP and pages/faq), so the markup and the words a
  // buyer reads are the same words. See app/lib/faqJsonLd.js.
  const jsonLd = buildFaqJsonLd(html);

  return (
    <div className="faq-accordion">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
          }}
        />
      )}
      {items.map((item, i) =>
        item.type === 'category' ? (
          <h2 key={i} className="faq-category">
            {item.text}
          </h2>
        ) : (
          <details key={i} className="faq-item">
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ),
      )}
    </div>
  );
}
