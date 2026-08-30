import {parseHowItWorksBody} from '~/lib/pageContent';

/**
 * @param {{html: string}}
 */
export function HowItWorksSteps({html}) {
  const {intro, steps, infoBlocks} = parseHowItWorksBody(html);

  return (
    <div className="how-it-works">
      {intro.map((p, i) => (
        <p key={i} className="how-it-works-intro">
          {p}
        </p>
      ))}

      <ol className="how-it-works-steps">
        {steps.map((step) => (
          <li key={step.number} className="how-it-works-step">
            <span className="how-it-works-step-number">{step.number}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="how-it-works-info-grid">
        {infoBlocks.map((block) => (
          <div key={block.title} className="how-it-works-info-block">
            <h4>{block.title}</h4>
            <p style={{whiteSpace: 'pre-line'}}>{block.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
