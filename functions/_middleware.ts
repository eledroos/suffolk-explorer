/**
 * Cloudflare Pages middleware: simple password gate.
 *
 * Set APP_PASSWORD in the Pages project (Settings -> Environment variables,
 * both Production and Preview). If the variable is absent the site is open,
 * so local `vite` dev and unconfigured deploys keep working.
 *
 * The password never reaches the client: the browser stores only an HttpOnly
 * cookie holding a SHA-256 token derived from the password. Every request,
 * including the parquet, passes through this gate.
 */

interface Env {
  APP_PASSWORD?: string;
}

const COOKIE = 'sda_auth';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function tokenFor(password: string): Promise<string> {
  const data = new TextEncoder().encode('suffolk-explorer-v1:' + password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

function loginPage(error: boolean): Response {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Suffolk DA Explorer</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
         background:#f9f9f7; color:#0b0b0b; }
  @media (prefers-color-scheme: dark) { body { background:#0d0d0d; color:#fff; } }
  form { background:#fcfcfb; border:1px solid rgba(11,11,11,.1); border-radius:10px;
         padding:26px 28px; width:min(320px, 86vw); }
  @media (prefers-color-scheme: dark) { form { background:#1a1a19; border-color:rgba(255,255,255,.1); } }
  h1 { font-size:16px; margin:0 0 4px; }
  p { font-size:12.5px; color:#898781; margin:0 0 16px; }
  input { width:100%; box-sizing:border-box; font-size:14px; padding:8px 10px;
          border:1px solid #c3c2b7; border-radius:6px; background:transparent; color:inherit; }
  @media (prefers-color-scheme: dark) { input { border-color:#383835; } }
  button { margin-top:10px; width:100%; font-size:13.5px; font-weight:600; padding:8px 0;
           border:none; border-radius:6px; background:#2a78d6; color:#fff; cursor:pointer; }
  .err { color:#d03b3b; font-size:12px; margin:8px 0 0; }
</style></head><body>
<form method="POST">
  <h1>Suffolk DA Explorer</h1>
  <p>This preview is password protected.</p>
  <input type="password" name="password" autofocus autocomplete="current-password" aria-label="Password">
  ${error ? '<p class="err">That password is not right.</p>' : ''}
  <button type="submit">Enter</button>
</form></body></html>`;
  return new Response(html, {
    status: 401,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export const onRequest = async (context: {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}): Promise<Response> => {
  const { request, env, next } = context;
  const password = env.APP_PASSWORD;
  if (!password) return next(); // no password configured: site is open

  const expected = await tokenFor(password);
  if (getCookie(request, COOKIE) === expected) return next();

  if (request.method === 'POST') {
    let supplied = '';
    try {
      const form = await request.formData();
      supplied = String(form.get('password') ?? '');
    } catch {
      /* fall through to error page */
    }
    // compare digests, not raw strings
    if (supplied && (await tokenFor(supplied)) === expected) {
      return new Response(null, {
        status: 303,
        headers: {
          Location: new URL(request.url).pathname || '/',
          'Set-Cookie': `${COOKIE}=${expected}; Max-Age=${MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`,
          'Cache-Control': 'no-store',
        },
      });
    }
    return loginPage(true);
  }

  return loginPage(false);
};
