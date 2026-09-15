import {handleNewsletterSignup} from '~/lib/newsletter.server';

/**
 * Newsletter signup endpoint for anything that is not the homepage form,
 * currently the first-visit offer popup, which can appear on any route and so
 * cannot post to the homepage's own index action.
 *
 * POST only. A GET returns 405 rather than rendering, same as /api/e.
 * @param {import('react-router').ActionFunctionArgs} args
 */
export async function action({request, context}) {
  if (request.method !== 'POST') {
    return Response.json({ok: false, reason: 'method'}, {status: 405});
  }
  const formData = await request.formData();
  const result = await handleNewsletterSignup({
    formData,
    env: context.env,
    origin: new URL(request.url).origin,
    source: (formData.get('source') || 'popup').toString().slice(0, 40),
  });
  // Always 200. The outcome lives in the body: a fetcher does not populate
  // `fetcher.data` for a non-2xx, so encoding "this email was rejected" as a
  // 400 silently loses the message the component needs to show the fallback
  // code. Verified 2026-09-14: the popup rendered nothing on a 400.
  return Response.json(result);
}

/** No GET rendering for a resource route. */
export async function loader() {
  return Response.json({ok: false, reason: 'method'}, {status: 405});
}
