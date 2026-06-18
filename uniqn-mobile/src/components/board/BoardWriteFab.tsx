import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddCircleOutlineIcon } from '@/components/icons';

interface BoardWriteFabProps {
  onPress: () => void;
}

/** 게시판 글쓰기 플로팅 액션 버튼 */
export function BoardWriteFab({ onPress }: BoardWriteFabProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: 16,
        bottom: 16 + insets.bottom,
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="글쓰기"
        className="h-12 w-12 items-center justify-center rounded-2xl bg-primary-500 shadow-lg active:opacity-70 dark:bg-primary-400"
      >
        <AddCircleOutlineIcon size={24} color="#09090B" />
      </Pressable>
    </View>
  );
}

export default BoardWriteFab;
