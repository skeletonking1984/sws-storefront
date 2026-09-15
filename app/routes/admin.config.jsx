import {useLoaderData, Form} from 'react-router';
import {CONFIG_GROUPS} from '~/lib/configRegistry';

/**
 * `/admin/config`: which of this app's environment variables are actually set
 * on THIS deployment, and what breaks where one is missing.
 *
 * Oxygen values cannot be read back once set, and every consumer in this app
 * is deliberately written to no-op rather than throw when its variable is
 * absent. Those two facts together mean a missing credential has no symptom
 * at all except a number that never moves. The X Conversion API sat half
 * wired for days that way.
 *
 * SECURITY, and it is the whole design:
 *
 * - **Values never leave the server.** The loader reduces every variable to
 *   {set, length} and the component cannot render a secret because it is
 *   never sent one. Do not "helpfully" add a masked preview; a prefix is
 *   enough to confirm a guess.
 * - **Fail closed.** With no `PRIVATE_ADMIN_PASSWORD` the route throws 404,
 *   so a deployment that forgets to configure it exposes nothing rather than
 *   everything. This deliberately does NOT reuse `PRIVATE_PREVIEW_PASSWORD`,
 *   whose own header says "never protect anything that matters with it".
 * - `noindex`, and the password is checked against a constant time compare.
 *
 * It is read only on purpose. Writing secrets from a web form would mean
 * storing them somewhere a request can reach, which is strictly worse than
 * an environment variable. The point here is visibility, not editing.
 */

const COOKIE = 'sws_admin';

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function tokenFor(password) {
  const data = new TextEncoder().encode(`sws-admin:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

export const meta = () => [
  {title: 'Config | Stream Widget Shop'},
  {name: 'robots', content: 'noindex, nofollow'},
];

/** @param {import('react-router').LoaderFunctionArgs} args */
export async function loader({request, context}) {
  const env = context.env || {};
  const password = env.PRIVATE_ADMIN_PASSWORD;
  if (!password) throw new Response('Not found', {status: 404});

  const expected = await tokenFor(password);
  const cookie = request.headers.get('cookie') || '';
  const present = cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);

  if (!present || !safeEqual(present, expected)) {
    return {authed: false, groups: []};
  }

  // The only place values are touched. Nothing below this line sees one.
  const groups = CONFIG_GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    note: group.note || null,
    vars: group.vars.map((v) => {
      const raw = env[v.key];
      return {
        key: v.key,
        required: Boolean(v.required),
        impact: v.impact,
        set: Boolean(raw),
        length: raw ? String(raw).length : 0,
      };
    }),
  }));

  return {authed: true, groups};
}

/** @param {import('react-router').ActionFunctionArgs} args */
export async function action({request, context}) {
  const env = context.env || {};
  const password = env.PRIVATE_ADMIN_PASSWORD;
  if (!password) throw new Response('Not found', {status: 404});

  const form = await request.formData();
  const supplied = String(form.get('password') || '');
  if (!safeEqual(supplied, password)) {
    return {error: 'Wrong password.'};
  }

  const token = await tokenFor(password);
  return new Response(null, {
    status: 302,
    headers: {
      location: '/admin/config',
      'set-cookie': `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`,
    },
  });
}

export default function AdminConfig() {
  const {authed, groups} = useLoaderData();

  if (!authed) {
    return (
      <div className="admin-config">
        <h1>Config</h1>
        <Form method="post" className="admin-config-login">
          <label htmlFor="admin-password">Password</label>
          <input id="admin-password" name="password" type="password" />
          <button type="submit" className="sws-btn sws-btn-primary">
            Open
          </button>
        </Form>
      </div>
    );
  }

  const all = groups.flatMap((g) => g.vars);
  const missingRequired = all.filter((v) => v.required && !v.set);
  const setCount = all.filter((v) => v.set).length;

  return (
    <div className="admin-config">
      <h1>Config</h1>
      <p className="admin-config-summary">
        {setCount} of {all.length} set on this deployment.{' '}
        {missingRequired.length === 0 ? (
          <strong>Nothing required is missing.</strong>
        ) : (
          <strong className="admin-config-bad">
            {missingRequired.length} required missing:{' '}
            {missingRequired.map((v) => v.key).join(', ')}
          </strong>
        )}
      </p>
      <p className="admin-config-note">
        Values are never sent to this page, only whether one is present and how
        long it is. Read only by design: a secret editable from a web form has
        to live somewhere a request can reach.
      </p>

      {groups.map((group) => (
        <section key={group.id} className="admin-config-group">
          <h2>{group.title}</h2>
          {group.note && <p className="admin-config-note">{group.note}</p>}
          <table className="admin-config-table">
            <thead>
              <tr>
                <th>Variable</th>
                <th>State</th>
                <th>What breaks without it</th>
              </tr>
            </thead>
            <tbody>
              {group.vars.map((v) => (
                <tr key={v.key} className={v.set ? '' : 'admin-config-unset'}>
                  <td>
                    <code>{v.key}</code>
                    {v.required && <span className="admin-config-req"> required</span>}
                  </td>
                  <td>
                    {v.set ? `set, ${v.length} chars` : 'not set'}
                  </td>
                  <td>{v.impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
