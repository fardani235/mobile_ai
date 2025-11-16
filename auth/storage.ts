import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getAuthServerBaseUrl } from './config';

export type SessionArtifacts = {
  sid: string;
  csrfToken?: string | null;
  username?: string | null;
};

export type LoginHints = {
  lastServerUrl?: string;
  lastUsername?: string;
};

function originFrom(url: string) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return url;
  }
}

function ns(key: string) {
  const origin = originFrom(getAuthServerBaseUrl());
  return `${origin}:${key}`;
}

const memory: Record<string, string | undefined> = {};

async function setItem(key: string, value: string) {
  try {
    await SecureStore.setItemAsync(key, value, { requireAuthentication: false });
  } catch {
    memory[key] = value;
  }
}

async function getItem(key: string) {
  try {
    const v = await SecureStore.getItemAsync(key);
    if (v == null && Platform.OS === 'web') return memory[key] ?? null;
    return v;
  } catch {
    return memory[key] ?? null;
  }
}

async function deleteItem(key: string) {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {}
  delete memory[key];
}

const KEYS = {
  session: () => ns('session'),
  hints: 'auth:hints',
};

export async function saveSession(session: SessionArtifacts) {
  const compact: SessionArtifacts = {
    sid: session.sid,
    csrfToken: session.csrfToken ?? null,
    username: session.username ?? null,
  };
  await setItem(KEYS.session(), JSON.stringify(compact));
}

export async function loadSession(): Promise<SessionArtifacts | null> {
  const raw = await getItem(KEYS.session());
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionArtifacts;
    if (!parsed?.sid) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearSession() {
  await deleteItem(KEYS.session());
}

export async function saveLoginHints(hints: LoginHints) {
  const current = await loadLoginHints();
  const merged = { ...(current ?? {}), ...hints };
  await setItem(KEYS.hints, JSON.stringify(merged));
}

export async function loadLoginHints(): Promise<LoginHints | null> {
  const raw = await getItem(KEYS.hints);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LoginHints;
  } catch {
    return null;
  }
}

