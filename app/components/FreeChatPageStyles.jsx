/**
 * Shared base styles for the Stream Chat Lite signup + confirm/setup pages
 * (app/routes/free-chat-widget.jsx and free-chat-widget_.confirm.jsx). Those
 * are two SEPARATE route modules (not nested, see the trailing underscore in
 * the confirm route's filename), so a `<style>` block written inside one
 * component is never present when the other renders. Shared rules live here
 * once; each route's own component still carries its own page-specific
 * rules in its own inline `<style>` tag.
 *
 * Brand tokens (--sws-*) come from app/styles/app.css, loaded globally.
 *
 * Contrast, computed against real sampled pixels of this page's actual
 * background gradient (design QA), not eyeballed: `.free-chat-lede`
 * uses `--sws-text`, not `--sws-sub`. `--sws-sub` measured as low as 3.59:1
 * against the darker part of the gradient this text sits on, below the
 * 4.5:1 floor for normal-size text. `--sws-text` measured 7.85-9.21:1 at
 * the same sampled points.
 */
export function FreeChatPageStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
      .free-chat-page { max-width: 960px; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; color: var(--sws-text); }
      .free-chat-page h1 { font-family: var(--font-display); font-size: clamp(1.8rem, 4vw, 2.6rem); margin: 0 0 0.75rem; }
      .free-chat-lede { color: var(--sws-text); font-size: 1.05rem; line-height: 1.6; max-width: 640px; margin: 0 0 1.75rem; }
      .free-chat-error { color: var(--sws-holo-4); }
    `,
      }}
    />
  );
}
