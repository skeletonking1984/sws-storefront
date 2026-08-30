import {parseFaqBody} from '~/lib/pageContent';

/**
 * @param {{html: string}}
 */
export function FaqAccordion({html}) {
  const items = parseFaqBody(html);

  return (
    <div className="faq-accordion">
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
