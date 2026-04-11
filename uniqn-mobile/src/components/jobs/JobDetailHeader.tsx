import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ShareIcon } from '@/components/icons';
import { HeaderBackButton } from '@/components/navigation';
import { getIconColor, getLayoutColor, HEADER_CLASSES } from '@/constants';
import { useThemeStore } from '@/stores';

interface JobDetailHeaderProps {
  title?: string;
  onShare?: () => void;
  isSharing?: boolean;
  fallbackHref?: string;
}

export function JobDetailHeader({
  title,
  onShare,
  isSharing,
  fallbackHref = '/(app)/(tabs)',
}: JobDetailHeaderProps) {
  const { isDarkMode } = useThemeStore();
  const headerBackgroundColor = getLayoutColor(isDarkMode, 'header');
  const headerBorderColor = getLayoutColor(isDarkMode, 'headerBorder');
  const headerTintColor = getLayoutColor(isDarkMode, 'headerTint');
  const secondaryTextColor = getIconColor(isDarkMode, 'primary');

  return (
    <View
      className="flex-row items-center px-4 py-3"
      style={{
        backgroundColor: headerBackgroundColor,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: headerBorderColor,
      }}
    >
      <HeaderBackButton tintColor={headerTintColor} fallbackHref={fallbackHref} className="mr-2" />

      <View className="min-w-0 flex-1 flex-row items-center">
        <Text className="text-base font-semibold" style={{ color: headerTintColor }}>
          공고 상세
        </Text>
        {title ? (
          <>
            <Text className="mx-2" style={{ color: secondaryTextColor }}>
              |
            </Text>
            <Text
              className="flex-1 text-base"
              style={{ color: secondaryTextColor }}
              numberOfLines={1}
              testID="job-detail-title"
            >
              {title}
            </Text>
          </>
        ) : null}
      </View>

      {onShare ? (
        <Pressable
          onPress={onShare}
          disabled={isSharing}
          className={`-mr-2 ml-2 rounded-sm p-2 ${HEADER_CLASSES.actionPressed}`}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="공고 공유하기"
          accessibilityRole="button"
        >
          <ShareIcon size={22} color={secondaryTextColor} />
        </Pressable>
      ) : null}
    </View>
  );
}
