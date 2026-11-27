import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthScreen } from './src/components/AuthScreen';
import { TrackerScreen } from './src/screens/TrackerScreen';
import { restoreSessionUser, signOut } from './src/services/auth';
import { COLORS } from './src/theme/colors';
import type { UserAccount } from './src/types/models';

export default function App() {
  const [booting, setBooting] = useState(true);
  const [activeUser, setActiveUser] = useState<UserAccount | null>(null);
  const [lockedUser, setLockedUser] = useState<UserAccount | null>(null);

  useEffect(() => {
    let mounted = true;
    restoreSessionUser()
      .then(({ user, requiresQuickUnlock }) => {
        if (!mounted) return;
        if (user && requiresQuickUnlock) {
          setLockedUser(user);
          setActiveUser(null);
        } else {
          setActiveUser(user);
          setLockedUser(null);
        }
      })
      .finally(() => {
        if (mounted) setBooting(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSignOut = async () => {
    await signOut(false);
    setActiveUser(null);
    setLockedUser(null);
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {booting ? (
        <View style={styles.boot}>
          <ActivityIndicator color={COLORS.text} size="large" />
        </View>
      ) : activeUser ? (
        <TrackerScreen
          user={activeUser}
          onUserUpdated={setActiveUser}
          onSignOut={handleSignOut}
        />
      ) : (
        <AuthScreen
          lockedUser={lockedUser}
          onAuthenticated={(user) => {
            setLockedUser(null);
            setActiveUser(user);
          }}
        />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
