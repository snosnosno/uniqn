import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BriefcaseIcon, CalendarIcon, HomeIcon, UserIcon } from '@/components/icons';
import { LAYOUT } from '@/constants';
import { getLayoutColor } from '@/constants/colors';
import { useThemeStore } from '@/stores/themeStore';

type PublicBottomTabKey = 'jobs' | 'schedule' | 'employer' | 'profile';
type ProtectedPublicBottomTabKey = Exclude<PublicBottomTabKey, 'jobs'>;

interface PublicBottomTabBarProps {
  activeTab?: PublicBottomTabKey;
  onProtectedTabPress: (tab: ProtectedPublicBottomTabKey) => void;
}

interface PublicBottomTabItem {
  key: PublicBottomTabKey;
  label: string;
  icon: typeof HomeIcon;
}

const TAB_ITEMS: PublicBottomTabItem[] = [
  { key: 'jobs', label: '구인구직', icon: HomeIcon },
  { key: 'schedule', label: '내 스케줄', icon: CalendarIcon },
  { key: 'employer', label: '내 공고', icon: BriefcaseIcon },
  { key: 'profile', label: '프로필', icon: UserIcon },
];

export function PublicBottomTabBar({
  activeTab = 'jobs',
  onProtectedTabPress,
}: PublicBottomTabBarProps) {
  const isDark = useThemeStore((state) => state.isDarkMode);
  const insets = useSafeAreaInsets();
  const activeTintColor = getLayoutColor(isDark, 'tabBarActive');
  const inactiveTintColor = getLayoutColor(isDark, 'tabBarInactive');

  return (
    <View
      className="absolute bottom-0 left-0 right-0 border-t"
      style={{
        backgroundColor: getLayoutColor(isDark, 'tabBarBg'),
        borderTopColor: getLayoutColor(isDark, 'tabBarBorder'),
        height: LAYOUT.TAB_BAR_HEIGHT + insets.bottom,
        paddingBottom: insets.bottom,
      }}
      accessibilityLabel="하단 탭 메뉴"
    >
      <View className="flex-1 flex-row">
        {TAB_ITEMS.map((item) => {
          const isActive = item.key === activeTab;
          const color = isActive ? activeTintColor : inactiveTintColor;
          const Icon = item.icon;

          return (
            <Pressable
              key={item.key}
              onPress={
                isActive
                  ? undefined
                  : () => onProtectedTabPress(item.key as ProtectedPublicBottomTabKey)
              }
              disabled={isActive}
              className="flex-1 items-center justify-center px-2 pt-2"
              accessibilityRole="button"
              accessibilityLabel={`${item.label} 탭`}
              accessibilityState={{ disabled: isActive, selected: isActive }}
            >
              <Icon size={22} color={color} />
              <Text className="mt-1 text-[11px] font-semibold" style={{ color }}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export type { ProtectedPublicBottomTabKey, PublicBottomTabKey };

export default PublicBottomTabBar;
