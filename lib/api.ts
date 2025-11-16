import { getAuthServerBaseUrl, getCsrfHeaderName } from '@/auth/config';
import { loadSession } from '@/auth/storage';
import { Platform } from 'react-native';
import EventSource from 'react-native-sse';

type HttpMethod = 'GET' | 'POST';

async function withAuthHeaders(init?: RequestInit): Promise<RequestInit> {
  const sess = await loadSession();
  const headers: Record<string, string> = Object.assign({}, init?.headers as any);
  if (sess?.csrfToken) headers[getCsrfHeaderName()] = sess.csrfToken;
  if (Platform.OS !== 'web' && sess?.sid) headers['Cookie'] = `sid=${encodeURIComponent(sess.sid)}`;
  return {
    ...init,
    headers,
    credentials: Platform.OS === 'web' ? ('include' as RequestCredentials) : undefined,
  } as RequestInit;
}

export function apiUrlForMethod(methodPath: string) {
  const base = getAuthServerBaseUrl().replace(/\/$/, '');
  const path = methodPath.startsWith('/api/method/') ? methodPath : `/api/method/${methodPath}`;
  return base + path;
}

async function apiCall(methodPath: string, method: HttpMethod = 'GET', payload?: any) {
  const url = apiUrlForMethod(methodPath);
  const init: RequestInit = await withAuthHeaders({
    method,
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Request failed: ${res.status} ${res.statusText} - ${text}`);
  }
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function getAvailableAgents(): Promise<{ name: string; agent_name?: string; ai_model?: string }[]> {
  const resp = await apiCall('techmaju_ai.techmaju_ai.doctype.tm_ai_chat_agent.tm_ai_chat_agent.get_available_agents', 'GET');
  if (Array.isArray((resp as any)?.message)) return (resp as any).message;
  if (Array.isArray(resp)) return resp as any;
  return [];
}

export async function createNewChat(agent_name: string): Promise<string> {
  const resp = await apiCall('techmaju_ai.techmaju_ai.doctype.tm_ai_chat_agent.tm_ai_chat_agent.create_new_chat', 'POST', { agent_name });
  const id = (resp as any)?.message ?? (resp as any)?.name ?? (resp as any)?.chat_name;
  if (!id) throw new Error('Failed to create chat');
  return id as string;
}

export async function getChatConversation(chat_history_name: string): Promise<{ agent: string; messages: any[]; status: string } | null> {
  const resp = await apiCall('techmaju_ai.techmaju_ai.doctype.tm_ai_chat_agent.tm_ai_chat_agent.get_chat_conversation', 'POST', {
    chat_history_name,
  });
  return ((resp as any)?.message ?? resp) as any;
}

export async function sendMessage(args: {
  chat_history_name: string;
  message: string;
  realtime_event: string;
  doc_data?: { doctype: string; name: string }[];
  text_context?: { id?: string; label?: string; type?: string; content: string; metadata?: any }[];
}) {
  const resp = await apiCall('techmaju_ai.techmaju_ai.doctype.tm_ai_chat_agent.tm_ai_chat_agent.send_message', 'POST', args);
  return (resp as any)?.message ?? resp;
}

export type StreamFrame = {
  stream_status: 'RUNNING' | 'END' | 'ERROR';
  delta_content?: string;
  status?: string;
  error_message?: string;
  usage?: any;
  ai_guard?: any;
  chat_completed?: boolean;
  user_message_masked?: boolean;
  assistant_message_masked?: boolean;
  assistant_message_blocked?: boolean;
};

export async function sendMessageStreaming(
  args: {
    chat_history_name: string;
    message: string;
    doc_data?: { doctype: string; name: string }[];
    text_context?: { id?: string; label?: string; type?: string; content: string; metadata?: any }[];
  },
  handlers: {
    onFrame?: (frame: StreamFrame) => void;
    onError?: (err: any) => void;
    onEnd?: (finalFrame?: StreamFrame) => void;
  }
) {
  const sess = await loadSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sess?.csrfToken) headers[getCsrfHeaderName()] = sess.csrfToken;
  if (Platform.OS !== 'web' && sess?.sid) headers['Cookie'] = `sid=${encodeURIComponent(sess.sid)}`;

  const url = apiUrlForMethod('techmaju_ai.techmaju_ai.doctype.tm_ai_chat_agent.tm_ai_chat_agent.send_message_streaming_api');
  

  const es = new (EventSource as any)(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(args),
    // Allow self-signed if needed? Keep defaults.
  });

  let lastFrame: StreamFrame | undefined;

  

  es.addEventListener('message', (event: any) => {
    try {
      const raw = event?.data;
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      lastFrame = data;
      handlers?.onFrame?.(data);
      if (data?.stream_status === 'END') {
        handlers?.onEnd?.(data);
        es.close();
      } else if (data?.stream_status === 'ERROR') {
        handlers?.onError?.(data?.error_message ?? data);
        es.close();
      }
    } catch (e) {
      handlers?.onError?.(e);
      es.close();
    }
  });

  es.addEventListener('error', (err: any) => {
    handlers?.onError?.(err);
    try { es.close(); } catch {}
  });

  return () => {
    try { es.close(); } catch {}
    if (lastFrame && lastFrame.stream_status !== 'END') {
      handlers?.onError?.(new Error('Stream closed prematurely'));
    }
  };
}

export async function getSidebarData(): Promise<{
  projects: any[];
  conversations_with_projects: any[];
  conversations_without_projects: any[];
}> {
  const resp = await apiCall('techmaju_ai.techmaju_ai.doctype.tm_ai_chat_agent.tm_ai_chat_agent.get_chat_history_with_projects', 'GET');
  return ((resp as any)?.message ?? resp) as any;
}

export async function getProjectConversations(project_name: string) {
  const resp = await apiCall('techmaju_ai.techmaju_ai.doctype.tm_ai_chat_agent.tm_ai_chat_agent.get_project_conversations', 'POST', { project_name });
  return ((resp as any)?.message ?? resp) as any;
}

// Projects and conversation management helpers
export async function createProject(project_title: string, description?: string): Promise<{ name: string }> {
  const resp = await apiCall(
    'techmaju_ai.techmaju_ai.doctype.tm_ai_chat_agent.tm_ai_chat_agent.create_project',
    'POST',
    { project_title, description: description ?? '' }
  );
  const message = (resp as any)?.message ?? resp;
  const name = (message?.name ?? message?.project_name ?? message) as string;
  if (!name) throw new Error('Failed to create project');
  return { name };
}

export async function renameConversation(chat_history_name: string, new_name: string) {
  const resp = await apiCall(
    'techmaju_ai.techmaju_ai.doctype.tm_ai_chat_agent.tm_ai_chat_agent.rename_conversation',
    'POST',
    { chat_history_name, new_name }
  );
  return ((resp as any)?.message ?? resp) as any;
}

export async function assignToProject(chat_history_name: string, project_name: string) {
  const resp = await apiCall(
    'techmaju_ai.techmaju_ai.doctype.tm_ai_chat_agent.tm_ai_chat_agent.assign_to_project',
    'POST',
    { chat_history_name, project_name }
  );
  return ((resp as any)?.message ?? resp) as any;
}

export async function archiveConversation(chat_history_name: string) {
  const resp = await apiCall(
    'techmaju_ai.techmaju_ai.doctype.tm_ai_chat_agent.tm_ai_chat_agent.archive_conversation',
    'POST',
    { chat_history_name }
  );
  return ((resp as any)?.message ?? resp) as any;
}

export async function convertUrlsForChat(urls: string[], export_format: 'markdown' | 'text' | 'json' = 'markdown', options?: any) {
  const resp = await apiCall('techmaju_ai.utils.document_utils.convert_urls_for_chat', 'POST', {
    urls,
    export_format,
    options: options ?? {},
  });
  return ((resp as any)?.message ?? resp) as any;
}
