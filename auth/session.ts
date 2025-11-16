import { Platform } from 'react-native';
import { getAuthServerBaseUrl, getLoginEndpointPath, getCsrfHeaderName, getAllowedOrigins } from './config';
import { saveSession, loadSession, saveLoginHints, clearSession } from './storage';

function assertHttpsAndAllowedOrigin(baseUrl: string) {
  const u = new URL(baseUrl);
  if (u.protocol !== 'https:') {
    throw new Error('Insecure endpoint blocked. Use HTTPS.');
  }
  const origin = `${u.protocol}//${u.host}`;
  if (!getAllowedOrigins().includes(origin)) {
    throw new Error('Origin not allowed by configuration');
  }
}

export async function refreshCsrfToken(): Promise<string | null> {
  const serverBase = getAuthServerBaseUrl();
  assertHttpsAndAllowedOrigin(serverBase);
  const sess = await loadSession();
  if (!sess?.sid) return null;
  const res = await fetch(serverBase.replace(/\/$/, '') + '/api/method/frappe.auth.get_logged_user', {
    method: 'GET',
    headers: Platform.OS === 'web' ? undefined : { Cookie: `sid=${encodeURIComponent(sess.sid)}` },
    credentials: Platform.OS === 'web' ? ('include' as RequestCredentials) : undefined,
  } as RequestInit);
  const csrf = res.headers.get(getCsrfHeaderName());
  if (csrf) {
    await saveSession({ ...sess, csrfToken: csrf });
  }
  return csrf;
}

export async function loginWithCredentials(args: { username: string; password: string }) {
  const serverBase = getAuthServerBaseUrl();
  assertHttpsAndAllowedOrigin(serverBase);
  const loginPath = getLoginEndpointPath();

  const body = new URLSearchParams();
  body.set('usr', args.username);
  body.set('pwd', args.password);

  const res = await fetch(serverBase.replace(/\/$/, '') + loginPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    credentials: Platform.OS === 'web' ? ('include' as RequestCredentials) : undefined,
    body: body.toString(),
  } as RequestInit);

  if (res.status === 401 || res.status === 403) {
    throw new Error('Invalid credentials');
  }

  let sid: string | null = null;
  if (Platform.OS !== 'web') {
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const m = setCookie.match(/sid=([^;]+)/i);
      if (m) sid = decodeURIComponent(m[1]);
    }
  } else {
    sid = 'browser-managed';
  }

  if (!sid) {
    try {
      const data = await res.clone().json();
      if (typeof (data as any)?.sid === 'string') sid = (data as any).sid;
    } catch {}
  }
  if (!sid) throw new Error('Missing session cookie from server');

  const csrf = res.headers.get(getCsrfHeaderName());
  await saveSession({ sid, csrfToken: csrf ?? null, username: args.username });
  try {
    await refreshCsrfToken();
  } catch {}
  await saveLoginHints({ lastServerUrl: serverBase, lastUsername: args.username });
}

export async function logout() {
  await clearSession();
}

