import Constants from 'expo-constants';

// Minimal config reader for Frappe session-cookie auth
// Values come from expo app.json -> expo.extra

type ExtraShape = {
  auth?: {
    serverBaseUrl?: string;
    csrf?: { headerName?: string; loginPath?: string };
    allowedOrigins?: string[];
  };
};

function getExtra(): ExtraShape {
  const expoConfig: any = (Constants as any).expoConfig ?? {};
  return (expoConfig.extra ?? {}) as ExtraShape;
}

export function getAuthServerBaseUrl(): string {
  return getExtra()?.auth?.serverBaseUrl ?? getExtraUrlFallback();
}

function getExtraUrlFallback(): string {
  // Fallback to baseUrls.api if present
  const expoConfig: any = (Constants as any).expoConfig ?? {};
  const extra: any = expoConfig.extra ?? {};
  return extra?.baseUrls?.api ?? '';
}

export function getCsrfHeaderName(): string {
  return getExtra()?.auth?.csrf?.headerName ?? 'X-Frappe-CSRF-Token';
}

export function getLoginEndpointPath(): string {
  return getExtra()?.auth?.csrf?.loginPath ?? '/api/method/login';
}

export function getAllowedOrigins(): string[] {
  const url = getAuthServerBaseUrl();
  const fromExtra = getExtra()?.auth?.allowedOrigins;
  if (Array.isArray(fromExtra) && fromExtra.length > 0) return fromExtra;
  return url ? [url] : [];
}

