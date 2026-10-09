import { Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

// Round icon-only button. variant: 'filled' (chip background) | 'outline' (white with border)
export default function IconButton({ icon, onPress, size = 40, iconSize = 20, variant = 'filled', label }) {
  const look = variant === 'outline' ? 'border border-line bg-surface' : 'bg-chip';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      className={`items-center justify-center rounded-full active:opacity-70 ${look}`}
      style={{ width: size, height: size }}
    >
      <MaterialCommunityIcons name={icon} size={iconSize} color={colors.ink} />
    </Pressable>
  );
}
