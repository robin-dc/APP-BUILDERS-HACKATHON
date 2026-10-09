import { Text } from 'react-native';

// Renders a string with **bold** segments, so message copy stays plain data.
export default function RichText({ text, className = '', children }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return (
    <Text className={`text-[15px] leading-6 text-ink ${className}`}>
      {parts.map((part, i) =>
        part.startsWith('**') ? (
          <Text key={i} className="font-bold">
            {part.slice(2, -2)}
          </Text>
        ) : (
          part
        )
      )}
      {children}
    </Text>
  );
}
