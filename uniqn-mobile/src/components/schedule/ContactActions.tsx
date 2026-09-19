/**
 * 구인자 연락 액션 — 전화 + 문자.
 *
 * 전화만 있으면 "지금 통화하기 곤란한 상황"에서 연락 경로가 통째로 막힌다. 스태프는 근무 중이거나
 * 이동 중일 때가 많고, 구인자도 영업 중이라 전화를 못 받는다. 문자는 이 앱에서 가장 흔한
 * 비동기 연락 수단인데 지금까지 없었다.
 *
 * `Linking.openURL` 을 직접 부르지 않고 `openExternalUrl` 을 경유한다 — 핸들러 앱이 없는 기기에서
 * reject 되면 catch 없이는 unhandled rejection 으로 조용히 아무 일도 일어나지 않는다
 * (Sentry UNIQN-MOBILE-1F). 유틸이 실패를 흡수하고 번호를 그대로 보여줘 직접 걸 수 있게 한다.
 */
import React, { memo, useCallback } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { MessageIcon, PhoneIcon } from '@/components/icons';
import { formatPhoneForDisplay } from '@/utils/phone';
import { openExternalUrl } from '@/utils/externalLink';

export interface ContactActionsProps {
  /** 구인자 전화번호 (raw) */
  phone: string;
  /** 로깅에 남길 화면 이름 */
  component?: string;
}

/** 웹 브라우저에는 문자 앱이 없다 — 죽은 버튼을 두느니 감춘다. */
const SUPPORTS_SMS = Platform.OS !== 'web';

const ACTION_CLASSNAME =
  'flex-1 min-h-[44px] flex-row items-center justify-center rounded-lg bg-primary-50 px-3 py-2 active:bg-primary-100 dark:bg-primary-900/20 dark:active:bg-primary-900/30';

function ContactActionsComponent({ phone, component = 'ContactActions' }: ContactActionsProps) {
  const display = formatPhoneForDisplay(phone);

  const handleCall = useCallback(() => {
    void openExternalUrl(`tel:${phone}`, {
      fallbackTitle: '전화 앱을 열 수 없어요',
      fallbackHint: '아래 번호로 직접 걸어주세요.',
      fallbackValue: display,
      component,
    });
  }, [phone, display, component]);

  const handleMessage = useCallback(() => {
    void openExternalUrl(`sms:${phone}`, {
      fallbackTitle: '문자 앱을 열 수 없어요',
      fallbackHint: '아래 번호로 직접 문자를 보내주세요.',
      fallbackValue: display,
      component,
    });
  }, [phone, display, component]);

  return (
    <View className="gap-2">
      <Text className="text-base font-sans-medium text-content-primary dark:text-off-white">
        {display}
      </Text>

      <View className="flex-row gap-2">
        <Pressable
          onPress={handleCall}
          accessibilityRole="button"
          accessibilityLabel={`구인자에게 전화하기 ${display}`}
          className={ACTION_CLASSNAME}
        >
          <PhoneIcon size={16} color="#B8962E" />
          <Text className="ml-1.5 text-sm font-sans-medium text-primary-600 dark:text-primary-400">
            전화하기
          </Text>
        </Pressable>

        {SUPPORTS_SMS && (
          <Pressable
            onPress={handleMessage}
            accessibilityRole="button"
            accessibilityLabel={`구인자에게 문자하기 ${display}`}
            className={ACTION_CLASSNAME}
          >
            <MessageIcon size={16} color="#B8962E" />
            <Text className="ml-1.5 text-sm font-sans-medium text-primary-600 dark:text-primary-400">
              문자하기
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export const ContactActions = memo(ContactActionsComponent);
