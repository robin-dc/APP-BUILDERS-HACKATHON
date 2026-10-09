import './global.css';
import { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from './src/components/AppHeader';
import ChatScreen from './src/screens/ChatScreen';
import SplashScreen from './src/screens/SplashScreen';

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  // Bumping this remounts the chat, resetting messages, draft and translator.
  const [session, setSession] = useState(0);
  const finishSplash = useCallback(() => setSplashDone(true), []);

  const restart = () => {
    setSession((s) => s + 1);
    setSplashDone(false);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView className="flex-1 bg-cream" edges={['top', 'left', 'right']}>
        <AppHeader onLogoPress={restart} />
        <ChatScreen key={session} />
        <SafeAreaView edges={['bottom']} className="bg-surface" />
      </SafeAreaView>

      {/* Drawn over the app so it can fade straight into the chat. */}
      {!splashDone && <SplashScreen onFinish={finishSplash} />}
      <StatusBar style={splashDone ? 'dark' : 'light'} />
    </SafeAreaProvider>
  );
}
