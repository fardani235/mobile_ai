import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { loadSession } from '@/auth/storage';

export default function Index() {
  const [ready, setReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      const sess = await loadSession();
      setIsAuthed(!!sess?.sid);
      setReady(true);
    })();
  }, []);

  if (!ready) return null;
  return <Redirect href={isAuthed ? '/(app)' : '/login'} />;
}
