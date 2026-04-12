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
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-sm bg-primary-100 dark:bg-primary-900/30">
        <DevicePhoneMobileIcon size={32} color="#D4AF37" />
      </View>

      <Text className="text-center text-base font-semibold text-secondary-900 dark:text-off-white">
        UNIQN 앱에서 계속 이용할 수 있어요
      </Text>

      <Text className="mt-3 text-center text-sm leading-6 text-secondary-500 dark:text-secondary-400">
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
