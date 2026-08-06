/**
 * SlotColorChips — 배치 구분 색 팔레트 (통합 편집 시트 공용)
 *
 * 🔴 **NativeWind 는 동적으로 조립한 클래스를 빌드 시점에 보지 못한다.** `` `bg-${token}` `` 로
 *    만들면 클래스가 purge 되어 스와치가 통째로 무색이 되고, `dark:` 변형이 함께 사라진다.
 *    이 파일은 `SLOT_COLOR_CHIPS`·`slotColorSwatchClassName` 이 들고 있는 **정적 리터럴만**
 *    끌어다 쓴다. 이 제약이 이 컴포넌트 설계의 전부다.
 *
 * 🔑 퇴역 팔레트 처리를 포함해 옮겼다(`EditSlotSheet.tsx:527-539`). 옛 팔레트(15종)로 저장된
 *    색은 피커의 4종에 없어서, 그냥 두면 **아무것도 선택되지 않은 것처럼** 보인다. 색만 확인하려던
 *    사장이 멀쩡한 색을 갈아치우는 경로라, 현재 색을 선택된 스와치로 함께 보여주되 새로 고를
 *    수는 없게 한다.
 *
 * 🔑 선택 상태를 `accessibilityState.selected` 로만 표현하지 않는다 — react-native-web 0.21.2 가
 *    처리하지 않는다(2026-08-06 실측). 스와치는 글자가 없어 색·테두리에만 기대게 되므로
 *    선택된 칩에 체크 표식을 얹는다.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  SLOT_COLOR_CHIPS,
  isCurrentSlotColor,
  slotColorSwatchClassName,
  type SlotColorToken,
  type StoredSlotColorToken,
} from '@/domains/workSchedule';

/** 옛 팔레트 안내 — 문구 하나를 두 곳(스와치 조건·본문)에서 쓰므로 상수로 묶는다. */
const LEGACY_NOTICE = '지난 팔레트로 지정된 색이에요. 위에서 고르면 새 색으로 바뀝니다.';

export interface SlotColorChipsProps {
  /** 현재 색. 옛 팔레트 토큰일 수 있다(그래서 Stored 타입). null = 색 없음. */
  value: StoredSlotColorToken | null;
  /** 고를 수 있는 것은 현행 4종뿐이라 반환 타입은 좁은 쪽이다. */
  onChange: (token: SlotColorToken) => void;
  readOnly?: boolean;
}

export function SlotColorChips({ value, onChange, readOnly = false }: SlotColorChipsProps) {
  // 옛 색이면 별도 스와치로 보여준다. 화이트리스트 밖 값(자유 hex 등)은 className 이 없어
  // null 이 되고, 그때는 스와치를 통째로 생략한다 — 클래스를 조립해 메우지 않는다.
  const legacyColorSwatch =
    value && !isCurrentSlotColor(value) ? slotColorSwatchClassName(value) : null;

  return (
    <View>
      <View className="flex-row flex-wrap gap-2">
        {SLOT_COLOR_CHIPS.map((chip) => {
          const selected = value === chip.token;

          return (
            <Pressable
              key={chip.token}
              testID={`color-chip-${chip.token}`}
              onPress={() => onChange(chip.token)}
              disabled={readOnly}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: readOnly }}
              accessibilityLabel={`색상 ${chip.label}`}
              className={`h-9 w-9 items-center justify-center rounded-full ${chip.swatchClassName} ${
                selected ? 'border-2 border-content-primary' : 'border border-divider'
              }`}
            >
              {selected ? (
                // 흰 체크 — 현행 4종은 전부 채도 높은 500/400 이라 대비가 확보된다.
                <Text
                  testID={`color-chip-selected-${chip.token}`}
                  className="font-sans-semibold text-sm text-white dark:text-white"
                >
                  ✓
                </Text>
              ) : null}
            </Pressable>
          );
        })}

        {legacyColorSwatch ? (
          <View
            accessibilityRole="image"
            accessibilityLabel="현재 색상 (지난 팔레트)"
            className={`h-9 w-9 rounded-full border-2 border-content-primary ${legacyColorSwatch}`}
          />
        ) : null}
      </View>

      {legacyColorSwatch ? (
        <Text className="mt-1.5 font-sans text-xs text-content-muted dark:text-secondary-400">
          {LEGACY_NOTICE}
        </Text>
      ) : null}
    </View>
  );
}
