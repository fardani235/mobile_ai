import { useState } from 'react';
import { StyleSheet, TextInput, Button, View, Text } from 'react-native';
import { router } from 'expo-router';
import { loginWithCredentials } from '@/auth/session';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithCredentials({ username, password });
      router.replace('/(app)');
    } catch (e: any) {
      setError(e?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <TextInput
        placeholder="Username"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
        style={styles.input}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Button title={loading ? 'Signing in…' : 'Sign in'} onPress={onLogin} disabled={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 12, justifyContent: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  error: { color: 'red' },
});
