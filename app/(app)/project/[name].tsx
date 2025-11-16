import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ActivityIndicator, Divider, IconButton, List, Menu, Modal, Text, TextInput, Button, useTheme } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { assignToProject as apiAssignToProject, archiveConversation as apiArchiveConversation, getProjectConversations, getSidebarData, renameConversation as apiRenameConversation } from '@/lib/api';
import { clearProjectConversationsCache, loadProjectConversationsCache, saveProjectConversationsCache, clearRecentChatsCache } from '@/lib/cache';

export default function ProjectScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any | null>(null);
  const router = useRouter();
  const projectName = Array.isArray(name) ? name[0] : name!;
  const theme = useTheme();

  // Conversation menu state
  const [convMenuFor, setConvMenuFor] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<any | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [assignProject, setAssignProject] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [showArchive, setShowArchive] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const cached = await loadProjectConversationsCache(projectName).catch(() => null);
        if (cached) {
          setData(cached);
          setLoading(false);
        }
      } catch {}

      try {
        const cached = await loadProjectConversationsCache(projectName).catch(() => null);
        if (!cached) {
          const d = await getProjectConversations(projectName);
          setData(d);
          await saveProjectConversationsCache(projectName, d);
        }
        const sidebar = await getSidebarData().catch(() => null);
        if (sidebar?.projects) setProjects(sidebar.projects);
      } catch {
        // noop
      } finally {
        setLoading(false);
      }
    })();
  }, [projectName]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading project…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <View style={{ marginBottom: 12 }}>
        <Text variant="titleLarge">
          {(data?.project?.project_title && String(data?.project?.project_title).trim().length > 0)
            ? data?.project?.project_title
            : (data?.project?.name ?? projectName)}
        </Text>
        {!!(data?.project?.description && String(data?.project?.description).trim().length > 0) && (
          <Text variant="bodySmall" style={{ marginTop: 4, opacity: 0.8 }}>
            {data?.project?.description}
          </Text>
        )}
      </View>
      <List.Section>
        {(data?.conversations ?? []).map((c: any) => {
          const title = (c?.display_name && String(c.display_name).trim().length > 0)
            ? c.display_name
            : ((c?.chat_agent && String(c.chat_agent).trim().length > 0) ? c.chat_agent : c?.name);
          return (
            <List.Item
              key={c.name}
              title={title}
              description={c.modified}
              onPress={() => router.push({ pathname: '/(app)/chat/[id]', params: { id: c.name } })}
              right={() => (
                <Menu
                  visible={convMenuFor === c.name}
                  onDismiss={() => setConvMenuFor(null)}
                  anchor={<IconButton icon="dots-vertical" onPress={() => { setConvMenuFor(c.name); setActiveConversation(c); }} accessibilityLabel="Conversation options" />}
                >
                  <Menu.Item title="Rename" leadingIcon="pencil" onPress={() => { setConvMenuFor(null); setActiveConversation(c); setRenameValue(title); setShowRename(true); }} />
                  <Menu.Item title="Add to Project" leadingIcon="folder-move" onPress={() => { setConvMenuFor(null); setActiveConversation(c); setAssignProject(null); setShowAssign(true); }} />
                  <Divider />
                  <Menu.Item title="Archive" leadingIcon="archive" onPress={() => { setConvMenuFor(null); setActiveConversation(c); setShowArchive(true); }} />
                </Menu>
              )}
            />
          );
        })}
      </List.Section>

      {/* Bottom-sheet: Rename */}
      <Modal visible={showRename} onDismiss={() => !actionBusy && setShowRename(false)} contentContainerStyle={{ marginTop: 'auto', marginHorizontal: 0 }}>
        <View style={{ padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: (theme as any).colors?.elevation?.level2 ?? theme.colors.background }}>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>Rename Conversation</Text>
          <TextInput label="New Name" value={renameValue} onChangeText={setRenameValue} mode="outlined" style={{ marginBottom: 12 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Button disabled={actionBusy} onPress={() => setShowRename(false)} style={{ marginRight: 8 }}>Cancel</Button>
            <Button mode="contained" loading={actionBusy} disabled={!renameValue.trim() || actionBusy} onPress={async () => {
              if (!activeConversation) return;
              try {
                setActionBusy(true);
                await apiRenameConversation(activeConversation.name, renameValue.trim());
                setData((prev: any) => {
                  if (!prev) return prev;
                  const list = (prev.conversations ?? []).map((r: any) => r.name === activeConversation.name ? { ...r, display_name: renameValue.trim() } : r);
                  return { ...prev, conversations: list };
                });
                await clearProjectConversationsCache(projectName);
                setShowRename(false);
              } catch (e) {
                console.warn('Rename failed', e);
              } finally { setActionBusy(false); }
            }}>Save</Button>
          </View>
        </View>
      </Modal>

      {/* Bottom-sheet: Assign to Project */}
      <Modal visible={showAssign} onDismiss={() => !actionBusy && setShowAssign(false)} contentContainerStyle={{ marginTop: 'auto', marginHorizontal: 0 }}>
        <View style={{ padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: (theme as any).colors?.elevation?.level2 ?? theme.colors.background }}>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>Add to Project</Text>
          <List.Section style={{ maxHeight: 240 }}>
            {(projects ?? []).map((p: any) => {
              const title = (p?.project_title && String(p.project_title).trim().length > 0) ? p.project_title : p?.name;
              const selected = assignProject === p.name;
              return (
                <List.Item key={p.name} title={title} left={(props) => <List.Icon {...props} icon={selected ? 'radiobox-marked' : 'radiobox-blank'} />} onPress={() => setAssignProject(p.name)} />
              );
            })}
          </List.Section>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Button disabled={actionBusy} onPress={() => setShowAssign(false)} style={{ marginRight: 8 }}>Cancel</Button>
            <Button mode="contained" loading={actionBusy} disabled={!assignProject || actionBusy} onPress={async () => {
              if (!activeConversation || !assignProject) return;
              try {
                setActionBusy(true);
                await apiAssignToProject(activeConversation.name, assignProject);
                // If moved to another project, remove from this list
                setData((prev: any) => {
                  if (!prev) return prev;
                  const list = (prev.conversations ?? []).filter((r: any) => r.name !== activeConversation.name);
                  return { ...prev, conversations: list };
                });
                await clearProjectConversationsCache(projectName);
                await clearProjectConversationsCache(assignProject);
                await clearRecentChatsCache();
                setShowAssign(false);
              } catch (e) {
                console.warn('Assign failed', e);
              } finally { setActionBusy(false); }
            }}>Add</Button>
          </View>
        </View>
      </Modal>

      {/* Bottom-sheet: Archive */}
      <Modal visible={showArchive} onDismiss={() => !actionBusy && setShowArchive(false)} contentContainerStyle={{ marginTop: 'auto', marginHorizontal: 0 }}>
        <View style={{ padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: (theme as any).colors?.elevation?.level2 ?? theme.colors.background }}>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>Archive this conversation?</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Button disabled={actionBusy} onPress={() => setShowArchive(false)} style={{ marginRight: 8 }}>No</Button>
            <Button mode="contained" loading={actionBusy} onPress={async () => {
              if (!activeConversation) return;
              try {
                setActionBusy(true);
                await apiArchiveConversation(activeConversation.name);
                setData((prev: any) => {
                  if (!prev) return prev;
                  const list = (prev.conversations ?? []).filter((r: any) => r.name !== activeConversation.name);
                  return { ...prev, conversations: list };
                });
                await clearProjectConversationsCache(projectName);
                await clearRecentChatsCache();
                setShowArchive(false);
              } catch (e) {
                console.warn('Archive failed', e);
              } finally { setActionBusy(false); }
            }}>Yes</Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}
