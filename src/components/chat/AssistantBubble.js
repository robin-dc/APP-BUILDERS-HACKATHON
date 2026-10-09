import { View } from 'react-native';

// Card bubble for the assistant's text, mirroring UserBubble: light surface, corner tucked toward the duck.
export default function AssistantBubble({ className = '', children }) {
  return (
    <View className={`max-w-[92%] self-start rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-3 ${className}`}>
      {children}
    </View>
  );
}
