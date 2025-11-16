import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  agents: 'cache:agents:list',
  projects: 'cache:projects:list',
  recentChats: 'cache:recentChats:list',
  projectConversationsPrefix: 'cache:projectConversations:',
};

export async function saveAgentsCache(list: any[]) {
  try {
    await AsyncStorage.setItem(KEYS.agents, JSON.stringify({ t: Date.now(), list }));
  } catch {}
}

export async function loadAgentsCache(maxAgeMs = 1000 * 60 * 60 /* 1h */): Promise<any[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.agents);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.list) return null;
    if (Date.now() - (data.t ?? 0) > maxAgeMs) return null;
    return data.list as any[];
  } catch {
    return null;
  }
}

export async function clearAgentsCache() {
  try {
    await AsyncStorage.removeItem(KEYS.agents);
  } catch {}
}

export async function saveProjectsCache(list: any[]) {
  try {
    await AsyncStorage.setItem(KEYS.projects, JSON.stringify({ t: Date.now(), list }));
  } catch {}
}

export async function loadProjectsCache(maxAgeMs = 1000 * 60 * 60 /* 1h */): Promise<any[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.projects);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.list) return null;
    if (Date.now() - (data.t ?? 0) > maxAgeMs) return null;
    return data.list as any[];
  } catch {
    return null;
  }
}

export async function saveRecentChatsCache(list: any[]) {
  try {
    await AsyncStorage.setItem(KEYS.recentChats, JSON.stringify({ t: Date.now(), list }));
  } catch {}
}

export async function loadRecentChatsCache(maxAgeMs = 1000 * 60 * 60 /* 1h */): Promise<any[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.recentChats);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.list) return null;
    if (Date.now() - (data.t ?? 0) > maxAgeMs) return null;
    return data.list as any[];
  } catch {
    return null;
  }
}

export async function clearSidebarCaches() {
  try {
    await AsyncStorage.removeItem(KEYS.projects);
    await AsyncStorage.removeItem(KEYS.recentChats);
  } catch {}
}

export async function clearAllCaches() {
  await clearAgentsCache();
  await clearSidebarCaches();
}

// Fine-grained helpers
export async function clearProjectsCache() {
  try { await AsyncStorage.removeItem(KEYS.projects); } catch {}
}

export async function clearRecentChatsCache() {
  try { await AsyncStorage.removeItem(KEYS.recentChats); } catch {}
}

// Per-project conversations cache
function keyForProjectConversations(projectName: string) {
  return `${KEYS.projectConversationsPrefix}${projectName}`;
}

export async function saveProjectConversationsCache(projectName: string, data: any) {
  try { await AsyncStorage.setItem(keyForProjectConversations(projectName), JSON.stringify({ t: Date.now(), data })); } catch {}
}

export async function loadProjectConversationsCache(projectName: string, maxAgeMs = 1000 * 60 * 60 /* 1h */): Promise<any | null> {
  try {
    const raw = await AsyncStorage.getItem(keyForProjectConversations(projectName));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data) return null;
    if (Date.now() - (parsed.t ?? 0) > maxAgeMs) return null;
    return parsed.data;
  } catch { return null; }
}

export async function clearProjectConversationsCache(projectName: string) {
  try { await AsyncStorage.removeItem(keyForProjectConversations(projectName)); } catch {}
}
