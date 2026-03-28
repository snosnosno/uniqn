import { Text, View } from 'react-native';
import { DevicePhoneMobileIcon } from '@/components/icons';
import { Button } from '@/components/ui/Button';

interface InstallPromptContentProps {
  description: string;
  onLogin?: () => void;
}

export function InstallPromptContent({ description, onLogin }: InstallPromptContentProps) {
  return (
    <View className="items-center py-2">
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30">
        <DevicePhoneMobileIcon size={32} color="#A855F7" />
      </View>

      <Text className="text-center text-base font-semibold text-gray-900 dark:text-white">
        UNIQN 앱에서 계속 이용할 수 있어요
      </Text>

      <Text className="mt-3 text-center text-sm leading-6 text-gray-500 dark:text-gray-400">
        {description}
      </Text>

      {onLogin ? (
        <View className="mt-4 w-full">
          <Button variant="outline" onPress={onLogin} fullWidth>
            로그인
          </Button>
        </View>
      ) : null}
    </View>
  );
}

export default InstallPromptContent;
