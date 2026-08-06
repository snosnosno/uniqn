/**
 * 근무지 길찾기 버튼 — 사용자가 실제로 쓰는 지도 앱으로 연다.
 *
 * 예전에는 기기 기본 지도로만 갔다. 국내 스태프 대부분은 카카오맵·네이버지도를 쓰는데,
 * 기본 지도(Apple/Google)는 국내 상호·건물 검색이 약해 "열리긴 열렸는데 어디인지 모르겠는"
 * 상태로 끝나곤 했다.
 *
 * 흐름: 첫 탭에서 한 번 고르고 → 기억한다 → 다음부터는 바로 그 앱으로. 바꾸고 싶으면 옆의
 * '변경'. 매번 시트를 띄우면 반복 동작에 마찰이 붙고, 아예 안 물어보면 고를 방법이 없다.
 *
 * 웹 빌드는 선택 시트를 띄우지 않는다 — 브라우저에서는 앱 스킴이 무의미하고, 기존처럼
 * 카카오 웹 지도로 여는 것이 유일하게 말이 되는 동작이다.
 */
import React, { memo, useCallback, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { MapIcon } from '@/components/icons';
import { ActionSheet } from '@/components/ui';
import { getMapAppPreference, setMapAppPreference } from '@/utils/mapAppPreference';
import {
  MAP_APP_CHOICES,
  MAP_APP_LABELS,
  openMapDestination,
  type MapAppId,
  type MapDestination,
} from '@/utils/mapLink';
import { useToast } from '@/stores/toastStore';

export interface DirectionsButtonProps extends MapDestination {
  /** 스크린리더가 읽을 목적지 이름 — 비어 있으면 '근무지' 로 대체한다 */
  accessibilityName?: string;
}

const IS_WEB = Platform.OS === 'web';

const SHEET_OPTIONS = MAP_APP_CHOICES.map((value) => ({
  value,
  label: MAP_APP_LABELS[value],
}));

function DirectionsButtonComponent({
  query,
  coordinates,
  label,
  accessibilityName,
}: DirectionsButtonProps) {
  const toast = useToast();
  // 최초 1회만 저장소를 읽는다(초기화 함수) — 렌더마다 MMKV 를 때릴 이유가 없다.
  const [preferredApp, setPreferredApp] = useState<MapAppId | null>(() =>
    IS_WEB ? null : getMapAppPreference()
  );
  const [pickerVisible, setPickerVisible] = useState(false);

  const openWith = useCallback(
    async (app?: MapAppId) => {
      const opened = await openMapDestination({ query, coordinates, label }, app);
      if (!opened) {
        toast.error('지도 앱을 열지 못했어요. 주소를 직접 검색해 주세요.');
      }
    },
    [query, coordinates, label, toast]
  );

  const handlePress = useCallback(() => {
    // 웹이거나 이미 고른 앱이 있으면 곧장 연다. 없을 때만 묻는다.
    if (IS_WEB) return void openWith();
    if (preferredApp) return void openWith(preferredApp);
    setPickerVisible(true);
  }, [openWith, preferredApp]);

  const handleSelect = useCallback(
    (value: string) => {
      // ActionSheet 는 string 을 돌려준다 — 좁히지 않고 쓰면 알 수 없는 값이 URL 로 흘러간다.
      const app = MAP_APP_CHOICES.find((choice) => choice === value);
      if (!app) return;

      setMapAppPreference(app);
      setPreferredApp(app);
      void openWith(app);
    },
    [openWith]
  );

  const destinationName = accessibilityName?.trim() || '근무지';

  return (
    <>
      <View className="ml-8 mt-2 flex-row items-center gap-2">
        {/* 주 액션 라벨은 '길찾기' 로 고정한다 — 고른 앱에 따라 라벨이 길어졌다 짧아졌다 하면
            같은 자리에 있던 버튼이 손가락 밑에서 흔들린다. 어떤 앱으로 갈지는 옆에서 알린다. */}
        <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={`${destinationName} 길찾기`}
          className="flex-row items-center rounded-lg bg-primary-50 px-3 py-2 active:bg-primary-100 dark:bg-primary-900/20 dark:active:bg-primary-900/30"
        >
          <MapIcon size={16} color="#B8962E" />
          <Text className="ml-1.5 text-sm font-sans-medium text-primary-600 dark:text-primary-400">
            길찾기
          </Text>
        </Pressable>

        {/* 어떤 앱으로 열리는지 밝히고, 동시에 바꿀 통로가 된다.
            이게 없으면 한 번의 선택이 되돌릴 수 없는 결정이 되고, 왜 그 앱이 열리는지도 알 수 없다. */}
        {!IS_WEB && preferredApp && (
          <Pressable
            onPress={() => setPickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={`길찾기에 사용할 지도 앱 변경 (현재 ${MAP_APP_LABELS[preferredApp]})`}
            hitSlop={10}
            className="flex-row items-center rounded-lg px-2 py-2 active:bg-secondary-100 dark:active:bg-secondary-800"
          >
            <Text className="text-xs text-content-muted dark:text-secondary-400 font-sans">
              {MAP_APP_LABELS[preferredApp]} · 변경
            </Text>
          </Pressable>
        )}
      </View>

      <ActionSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        title="어떤 지도로 열까요?"
        description="선택한 앱을 기억해 다음부터 바로 열어요. 설치되어 있지 않으면 웹 지도로 안내합니다."
        options={SHEET_OPTIONS}
        onSelect={handleSelect}
      />
    </>
  );
}

export const DirectionsButton = memo(DirectionsButtonComponent);
