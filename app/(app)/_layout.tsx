import React, { useCallback, useMemo, useState } from 'react';
import { useRouter, Slot } from 'expo-router';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, Portal, Modal, Text, List, Divider, ActivityIndicator, useTheme, IconButton, Appbar, Searchbar, Button, TextInput } from 'react-native-paper';
import { AppThemeContext } from '@/app/_layout';
import { clearAllCaches, clearProjectsCache, clearProjectConversationsCache, clearRecentChatsCache, loadProjectsCache, loadRecentChatsCache, saveProjectsCache, saveRecentChatsCache } from '@/lib/cache';
import { getSidebarData, createProject, renameConversation as apiRenameConversation, assignToProject as apiAssignToProject, archiveConversation as apiArchiveConversation } from '@/lib/api';
import { logout } from '@/auth/session';

export default function AppLayout() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [loadingSidebar, setLoadingSidebar] = useState(false);
  const [sidebar, setSidebar] = useState<any | null>(null);
  const [query, setQuery] = useState('');
  // New Project sheet state
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  // Conversation action menu + sheets
  const [convMenuFor, setConvMenuFor] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<any | null>(null);
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [assignProject, setAssignProject] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const theme = useTheme();
  const { toggleTheme } = React.useContext(AppThemeContext);
  const router = useRouter();

  const openPanel = useCallback(async () => {
    setPanelVisible(true);
    setLoadingSidebar(true);
    try {
      const [cachedProjects, cachedRecent] = await Promise.all([
        loadProjectsCache().catch(() => null),
        loadRecentChatsCache().catch(() => null),
      ]);
      if ((cachedProjects && cachedProjects.length > 0) || (cachedRecent && cachedRecent.length > 0)) {
        setSidebar({
          projects: cachedProjects ?? [],
          conversations_with_projects: [],
          conversations_without_projects: cachedRecent ?? [],
        });
        setLoadingSidebar(false);
      }
    } catch {}

    try {
      // Fetch if any required cache is missing
      const [cachedProjects, cachedRecent] = await Promise.all([
        loadProjectsCache().catch(() => null),
        loadRecentChatsCache().catch(() => null),
      ]);
      const needsFetch = !(cachedProjects && cachedProjects.length > 0) || !(cachedRecent && cachedRecent.length > 0);
      if (needsFetch) {
        const data = await getSidebarData();
        setSidebar(data);
        try {
          await saveProjectsCache(data?.projects ?? []);
          await saveRecentChatsCache((data?.conversations_without_projects ?? []).slice(0, 100));
        } catch {}
      }
    } catch {
      // noop
    } finally {
      setLoadingSidebar(false);
    }
  }, []);

  const onRefreshCache = useCallback(async () => {
    await clearAllCaches();
    setMenuVisible(false);
  }, []);

  const onLogout = useCallback(async () => {
    await logout();
    setMenuVisible(false);
    router.replace('/login');
  }, [router]);

  const containerStyle = useMemo(() => [{ backgroundColor: theme.colors.background, margin: 0 }], [theme.colors.background]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const projects: any[] = sidebar?.projects ?? [];
    const recent: any[] = sidebar?.conversations_without_projects ?? [];
    if (!q) return { projects, recent };
    const fp = projects.filter((p: any) => {
      const title = (p?.project_title && String(p.project_title).trim().length > 0) ? String(p.project_title) : String(p?.name ?? '');
      return title.toLowerCase().includes(q);
    });
    const fr = recent.filter((c: any) => {
      const title = (c?.display_name && String(c.display_name).trim().length > 0)
        ? String(c.display_name)
        : ((c?.chat_agent && String(c.chat_agent).trim().length > 0) ? String(c.chat_agent) : String(c?.name ?? ''));
      return title.toLowerCase().includes(q);
    });
    return { projects: fp, recent: fr };
  }, [sidebar, query]);

  return (
    <View style={{ flex: 1 }}>
      <Portal>
        <Modal visible={panelVisible} onDismiss={() => setPanelVisible(false)} contentContainerStyle={[styles.panelContainer, containerStyle]}> 
          <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.panelHeader}>
            <Searchbar
              placeholder="Search"
              value={query}
              onChangeText={setQuery}
              style={{ flex: 1, marginRight: 8, borderRadius: 28 }}
            />
            <IconButton icon="close" onPress={() => setPanelVisible(false)} accessibilityLabel="Close menu" />
          </View>
          <List.Item
            title="New Chat"
            left={(props) => <List.Icon {...props} icon="pencil" />}
            onPress={() => { setPanelVisible(false); router.push('/(app)'); }}
          />
          {loadingSidebar ? (
            <View style={styles.centerRow}>
              <ActivityIndicator />
              <Text style={{ marginLeft: 8 }}>Loading…</Text>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <ScrollView>
                <List.Section>
                  <List.Subheader>Projects</List.Subheader>
                  <List.Item
                    title="New Project"
                    left={(props) => <List.Icon {...props} icon="folder-plus" />}
                    onPress={() => { setShowNewProject(true); setConvMenuFor(null); }}
                  />
                  {(filtered.projects ?? []).map((p: any) => {
                    const title = (p?.project_title && String(p.project_title).trim().length > 0) ? p.project_title : p?.name;
                    return (
                      <List.Item key={p.name} title={title} onPress={() => { setPanelVisible(false); router.push({ pathname: '/(app)/project/[name]', params: { name: p.name } }); }} left={(props) => <List.Icon {...props} icon="folder" />} />
                    );
                  })}
                </List.Section>
                <Divider />
                <List.Section>
                  <List.Subheader>Recent Chats</List.Subheader>
                  {((filtered.recent ?? []).slice(0, 200)).map((c: any) => {
                    const title = (c?.display_name && String(c.display_name).trim().length > 0)
                      ? c.display_name
                      : ((c?.chat_agent && String(c.chat_agent).trim().length > 0) ? c.chat_agent : c?.name);
                    return (
                      <List.Item
                        key={c.name}
                        title={title}
                        description={c.modified}
                        onPress={() => { setPanelVisible(false); router.push({ pathname: '/(app)/chat/[id]', params: { id: c.name } }); }}
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
              </ScrollView>
            </View>
          )}
          </SafeAreaView>
        </Modal>
        {/* Bottom-sheet: New Project */}
        <Modal visible={showNewProject} onDismiss={() => !creatingProject && setShowNewProject(false)} contentContainerStyle={styles.sheetContainer}>
          <View style={[styles.sheetContent, { backgroundColor: (theme as any).colors?.elevation?.level2 ?? theme.colors.background }]}>
            <Text style={styles.sheetTitle}>New Project</Text>
            <TextInput label="Title" value={newProjectTitle} onChangeText={setNewProjectTitle} mode="outlined" style={{ marginBottom: 8 }} autoFocus />
            <TextInput label="Description" value={newProjectDesc} onChangeText={setNewProjectDesc} mode="outlined" multiline numberOfLines={3} style={{ marginBottom: 12 }} />
            <View style={styles.sheetActions}>
              <Button disabled={creatingProject} onPress={() => setShowNewProject(false)}>Cancel</Button>
              <Button mode="contained" loading={creatingProject} disabled={!newProjectTitle.trim() || creatingProject}
                onPress={async () => {
                  try {
                    setCreatingProject(true);
                    await createProject(newProjectTitle.trim(), newProjectDesc.trim());
                    // Invalidate and fetch fresh sidebar data
                    await clearProjectsCache();
                    const data = await getSidebarData();
                    setSidebar(data);
                    try {
                      await saveProjectsCache(data?.projects ?? []);
                      await saveRecentChatsCache((data?.conversations_without_projects ?? []).slice(0, 100));
                    } catch {}
                    setShowNewProject(false);
                    setNewProjectTitle('');
                    setNewProjectDesc('');
                  } catch (e) {
                    console.warn('Create project failed', e);
                  } finally {
                    setCreatingProject(false);
                  }
                }}>Create</Button>
            </View>
          </View>
        </Modal>

        {/* Bottom-sheet: Rename Conversation */}
        <Modal visible={showRename} onDismiss={() => !actionBusy && setShowRename(false)} contentContainerStyle={styles.sheetContainer}>
          <View style={[styles.sheetContent, { backgroundColor: (theme as any).colors?.elevation?.level2 ?? theme.colors.background }]}>
            <Text style={styles.sheetTitle}>Rename Conversation</Text>
            <TextInput label="New Name" value={renameValue} onChangeText={setRenameValue} mode="outlined" style={{ marginBottom: 12 }} />
            <View style={styles.sheetActions}>
              <Button disabled={actionBusy} onPress={() => setShowRename(false)}>Cancel</Button>
              <Button mode="contained" loading={actionBusy} disabled={!renameValue.trim() || actionBusy}
                onPress={async () => {
                  if (!activeConversation) return;
                  try {
                    setActionBusy(true);
                    await apiRenameConversation(activeConversation.name, renameValue.trim());
                    // Update in-place in recent list
                    setSidebar((prev: any) => {
                      if (!prev) return prev;
                      const recent = (prev.conversations_without_projects ?? []).map((r: any) => r.name === activeConversation.name ? { ...r, display_name: renameValue.trim() } : r);
                      return { ...prev, conversations_without_projects: recent };
                    });
                    // Invalidate recent cache so next open refetches if needed
                    await clearRecentChatsCache();
                    setShowRename(false);
                  } catch (e) {
                    console.warn('Rename failed', e);
                  } finally {
                    setActionBusy(false);
                  }
                }}>Save</Button>
            </View>
          </View>
        </Modal>

        {/* Bottom-sheet: Assign to Project */}
        <Modal visible={showAssign} onDismiss={() => !actionBusy && setShowAssign(false)} contentContainerStyle={styles.sheetContainer}>
          <View style={[styles.sheetContent, { backgroundColor: (theme as any).colors?.elevation?.level2 ?? theme.colors.background }]}>
            <Text style={styles.sheetTitle}>Add to Project</Text>
            <List.Section style={{ maxHeight: 240 }}>
              {(sidebar?.projects ?? []).map((p: any) => {
                const title = (p?.project_title && String(p.project_title).trim().length > 0) ? p.project_title : p?.name;
                const selected = assignProject === p.name;
                return (
                  <List.Item
                    key={p.name}
                    title={title}
                    left={(props) => <List.Icon {...props} icon={selected ? 'radiobox-marked' : 'radiobox-blank'} />}
                    onPress={() => setAssignProject(p.name)}
                  />
                );
              })}
            </List.Section>
            <View style={styles.sheetActions}>
              <Button disabled={actionBusy} onPress={() => setShowAssign(false)}>Cancel</Button>
              <Button mode="contained" loading={actionBusy} disabled={!assignProject || actionBusy}
                onPress={async () => {
                  if (!activeConversation || !assignProject) return;
                  try {
                    setActionBusy(true);
                    await apiAssignToProject(activeConversation.name, assignProject);
                    // Remove from recent list
                    setSidebar((prev: any) => {
                      if (!prev) return prev;
                      const recent = (prev.conversations_without_projects ?? []).filter((r: any) => r.name !== activeConversation.name);
                      return { ...prev, conversations_without_projects: recent };
                    });
                    // Invalidate caches impacted by move
                    await clearRecentChatsCache();
                    await clearProjectConversationsCache(assignProject);
                    setShowAssign(false);
                  } catch (e) {
                    console.warn('Assign failed', e);
                  } finally {
                    setActionBusy(false);
                  }
                }}>Add</Button>
            </View>
          </View>
        </Modal>

        {/* Bottom-sheet: Archive confirmation */}
        <Modal visible={showArchive} onDismiss={() => !actionBusy && setShowArchive(false)} contentContainerStyle={styles.sheetContainer}>
          <View style={[styles.sheetContent, { backgroundColor: (theme as any).colors?.elevation?.level2 ?? theme.colors.background }]}>
            <Text style={styles.sheetTitle}>Archive this conversation?</Text>
            <View style={styles.sheetActions}>
              <Button disabled={actionBusy} onPress={() => setShowArchive(false)}>No</Button>
              <Button mode="contained" loading={actionBusy} onPress={async () => {
                if (!activeConversation) return;
                try {
                  setActionBusy(true);
                  await apiArchiveConversation(activeConversation.name);
                  // Remove from recent list
                  setSidebar((prev: any) => {
                    if (!prev) return prev;
                    const recent = (prev.conversations_without_projects ?? []).filter((r: any) => r.name !== activeConversation.name);
                    return { ...prev, conversations_without_projects: recent };
                  });
                  await clearRecentChatsCache();
                  setShowArchive(false);
                } catch (e) {
                  console.warn('Archive failed', e);
                } finally {
                  setActionBusy(false);
                }
              }}>Yes</Button>
            </View>
          </View>
        </Modal>
      </Portal>
      <Appbar.Header mode="center-aligned">
        <Appbar.Action icon="menu" onPress={openPanel} accessibilityLabel="Open menu" />
        <Appbar.Content title={undefined} />
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={<Appbar.Action icon="account-circle" onPress={() => setMenuVisible((v) => !v)} accessibilityLabel="User menu" />}
        >
          <Menu.Item onPress={onRefreshCache} title="Refresh Cache" leadingIcon="refresh" />
          <Menu.Item onPress={toggleTheme} title="Switch Theme" leadingIcon="theme-light-dark" />
          <Menu.Item onPress={onLogout} title="Log out" leadingIcon="logout" />
        </Menu>
      </Appbar.Header>
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  panelContainer: {
    padding: 12,
    borderRadius: 0,
    marginHorizontal: 0,
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'flex-start',
  },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  centerRow: { flexDirection: 'row', alignItems: 'center' },
  sheetContainer: {
    marginHorizontal: 0,
    marginTop: 'auto',
  },
  sheetContent: {
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: 'white',
  },
  sheetTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
