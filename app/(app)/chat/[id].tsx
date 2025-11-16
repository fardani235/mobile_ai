import { getAvailableAgents, getChatConversation, sendMessageStreaming, StreamFrame } from '@/lib/api';
import { loadAgentsCache } from '@/lib/cache';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, ViewStyle } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { ActivityIndicator, IconButton, Text, TextInput, useTheme } from 'react-native-paper';

type Msg = { role: 'user' | 'assistant' | 'system'; content: string };

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conv, setConv] = useState<{ agent: string; messages: Msg[]; status: string } | null>(null);
  const [input, setInput] = useState('');
  
  const [agentInstructions, setAgentInstructions] = useState<string>('');
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  const chatId = Array.isArray(id) ? id[0] : id!;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const c = await getChatConversation(chatId);
        setConv(c);
      } catch {
        // noop
      } finally {
        setLoading(false);
      }
    })();
  }, [chatId]);

  // Load agent.user_instructions (if available) for empty-state display
  useEffect(() => {
    (async () => {
      const agentName = conv?.agent;
      if (!agentName) return;
      try {
        // Try cache first
        let agents = await loadAgentsCache();
        if (!agents || !Array.isArray(agents) || agents.length === 0) {
          try { agents = await getAvailableAgents() as any; } catch {}
        }
        const found = (agents || []).find((a: any) => a?.name === agentName || a?.agent_name === agentName);
        const ui = (found?.user_instructions ?? '').trim();
        setAgentInstructions(ui || '');
      } catch {
        setAgentInstructions('');
      }
    })();
  }, [conv?.agent]);

  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [conv?.messages?.length]);

  const canSend = input.trim().length > 0 && !sending && (conv?.status ?? 'Active') === 'Active';

  const onSend = async () => {
    if (!canSend) {
      return;
    }
    setSending(true);
    const userContent = input;
    setInput('');
    // Optimistically add user + assistant placeholder
    setConv((prev) => {
      const base = prev ?? { agent: '', messages: [], status: 'Active' };
      const msgs = [...(base.messages ?? []), { role: 'user', content: userContent } as Msg, { role: 'assistant', content: '' } as Msg];
      return { ...base, messages: msgs };
    });
    try {
      await sendMessageStreaming(
        {
          chat_history_name: chatId,
          message: userContent,
        },
        {
          onFrame: (frame: StreamFrame) => {
            if (frame?.delta_content) {
              setConv((prev) => {
                if (!prev) return prev;
                const msgs = [...prev.messages];
                // last message is assistant placeholder
                const lastIdx = msgs.length - 1;
                msgs[lastIdx] = { ...msgs[lastIdx], content: (msgs[lastIdx] as Msg).content + frame.delta_content } as Msg;
                return { ...prev, messages: msgs };
              });
            }
          },
          onError: (err) => {
            setSending(false);
          },
          onEnd: (final) => {
            setSending(false);
            if (final?.chat_completed) {
              setConv((prev) => (prev ? { ...prev, status: 'Completed' } : prev));
            }
            // attachments removed; nothing to clear
          },
        }
      );
      // Optionally keep reference to close if we add Stop button
    } catch {
      setSending(false);
    }
  };

  

  

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading conversation.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
                <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 12, paddingBottom: 96 }}>
          {(conv?.messages ?? []).map((m, idx) => {
            const isUser = m.role === 'user';
            const isAssistant = m.role === 'assistant';
            const isDark = (theme as any)?.dark ?? false;
            const userBg = isDark ? '#3f3f46' : '#e5e7eb'; // generic gray (dark/light)
            const textColor = isDark ? '#ffffff' : theme.colors.onSurface;

            if (isAssistant) {
              // AI response: no bubble, full width
              return (
                <View key={idx} style={{ marginBottom: 12, width: '100%' }}>
                  <Markdown style={{ body: { color: textColor } }}>{m.content || ''}</Markdown>
                </View>
              );
            }

            // Default (user/system): keep bubble for user, default for others
            const containerStyle: ViewStyle = {
              alignSelf: isUser ? 'flex-end' : 'flex-start',
              maxWidth: '90%',
              backgroundColor: isUser ? userBg : theme.colors.surfaceVariant,
              padding: 10,
              borderRadius: 16,
            };

            return (
              <View key={idx} style={[{ marginBottom: 12 }, containerStyle]}>
                <Markdown style={{ body: { color: textColor } }}>{m.content || ''}</Markdown>
              </View>
            );
          })}
        </ScrollView>
        {((conv?.messages ?? []).length === 0) ? (
          <View style={{ position: 'absolute', left: 12, right: 12, top: 12, bottom: 96, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
            <Text variant="titleLarge" style={{ textAlign: 'center', marginBottom: 6 }}>{conv?.agent}</Text>
            {!!agentInstructions && (
              <Text variant="bodyMedium" style={{ textAlign: 'center', opacity: 0.8 }}>{agentInstructions}</Text>
            )}
          </View>
        ) : null}
        
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 28, paddingHorizontal: 4, paddingVertical: 4, borderWidth: 1, borderColor: theme.colors.outlineVariant }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Type a message"
              mode="flat"
              multiline
              style={{ flex: 1, backgroundColor: 'transparent', marginLeft: 0 }}
              underlineColor={"transparent"}
              activeUnderlineColor={"transparent"}
            />
            <IconButton icon="arrow-up" mode="contained-tonal" size={24} onPress={onSend} disabled={!canSend} accessibilityLabel="Send" />
          </View>
        </View>
      </View>
      
    </KeyboardAvoidingView>
  );
}

