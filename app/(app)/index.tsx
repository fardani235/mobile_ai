import React, { useEffect, useMemo, useState } from 'react';
import { View, FlatList } from 'react-native';
import { ActivityIndicator, List, Searchbar, Text } from 'react-native-paper';
import { getAvailableAgents, createNewChat } from '@/lib/api';
import { loadAgentsCache, saveAgentsCache } from '@/lib/cache';
import { useRouter, useFocusEffect } from 'expo-router';

export default function AgentsLanding() {
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<{ name: string; agent_name?: string }[]>([]);
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const cached = await loadAgentsCache();
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setAgents(cached);
        setLoading(false);
        return;
      }
      try {
        const list = await getAvailableAgents();
        setAgents(list);
        await saveAgentsCache(list);
      } catch {
        // rely on cache if present
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        // If cache was cleared, refetch fresh list
        const cached = await loadAgentsCache();
        if (!cached || (Array.isArray(cached) && cached.length === 0)) {
          try {
            setLoading(true);
            const list = await getAvailableAgents();
            setAgents(list);
            await saveAgentsCache(list);
          } catch {}
          setLoading(false);
        }
      })();
      return () => {};
    }, [])
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) => a.name.toLowerCase().includes(q) || (a.agent_name ?? '').toLowerCase().includes(q));
  }, [agents, query]);

  const onSelectAgent = async (agentName: string) => {
    setLoading(true);
    try {
      const chatId = await createNewChat(agentName);
      router.push({ pathname: '/(app)/chat/[id]', params: { id: chatId } });
    } catch {
      // Could show toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <Searchbar placeholder="Search agents" value={query} onChangeText={setQuery} style={{ marginBottom: 8 }} />
      {loading && agents.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Loading agents…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.name}
          renderItem={({ item }) => (
            <List.Item title={item.name} onPress={() => onSelectAgent(item.name)} left={(props) => <List.Icon {...props} icon="robot" />} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 1, opacity: 0.1 }} />}
          ListEmptyComponent={<Text>No agents found</Text>}
        />
      )}
    </View>
  );
}
