import { useEffect, useState } from 'react';
import { Text } from 'react-native';

// Blinking block cursor rendered inline at the end of streaming text.
// Must be placed inside a <Text>.
export default function TypingCursor() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setVisible((v) => !v), 500);
    return () => clearInterval(id);
  }, []);

  return <Text className={visible ? 'bg-ink' : ''}>{'  '}</Text>;
}
