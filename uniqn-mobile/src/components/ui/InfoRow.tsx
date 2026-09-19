/**
 * UNIQN Mobile - InfoRow 컴포넌트
 *
 * @description 읽기 전용 "라벨-값" 한 줄. 라벨 좌 / 값 우.
 *
 * 라벨을 위에 두고 값을 박스에 담는 형태(라벨 20px + 박스 44px + 여백 12px ≈ 76px)는
 * 필드 다섯 개만 모여도 세로 380px 을 먹는다. 수정할 수 없는 값에 입력창 모양을 입히는
 * 것부터가 거짓 어포던스라, 값을 오른쪽으로 보내 한 줄(44px)로 접는다. 같은 정보가
 * 화면의 절반 이하를 쓰고, 라벨과 값이 눈높이에서 바로 짝지어진다.
 *
 * @version 1.0.0
 */

import React from 'react';
import { View, Text } from 'react-native';

export interface InfoRowProps {
  /** 좌측 라벨 */
  label: string;
  /** 우측 값. 비어 있으면 '-' */
  value?: string | null;
  /** 값 아래 덧붙는 보조 설명 (예: Apple 비공개 이메일) */
  hint?: string | null;
  /** 값 대신 오른쪽 칸을 채울 노드 (배지·입력창 등). 주면 `value`/`hint` 는 무시된다. */
  children?: React.ReactNode;
  /** 세로 여백을 없애 자식 높이가 행 높이가 되게 한다 (44px 입력창을 넣을 때) */
  dense?: boolean;
  testID?: string;
}

/**
 * 한 줄 정보 행.
 *
 * 값이 길면(이메일 등) 라벨을 밀어내지 않고 값 쪽에서 줄바꿈한다 — `shrink-0` 라벨 +
 * `flex-1` 값. 라벨이 줄어들면 스캔 기준선이 무너진다.
 */
export function InfoRow({ label, value, hint, children, dense = false, testID }: InfoRowProps) {
  // 🔑 자식이 있으면 컨테이너에 `accessible` 을 걸지 않는다. Pressable/TextInput 같은
  //    상호작용 자식이 들어오는 자리인데, 부모가 accessible 이면 스크린리더가 행 전체를
  //    한 덩어리로 삼켜 자식에 초점이 가지 않는다 — 입력창이 음성으로 사라진다.
  const isPlainValue = !children;

  return (
    <View
      className={`min-h-[44px] flex-row items-center justify-between ${dense ? '' : 'py-2'}`}
      testID={testID}
      accessible={isPlainValue}
      accessibilityLabel={isPlainValue ? `${label} ${value || '없음'}` : undefined}
    >
      <Text className="mr-3 shrink-0 text-sm text-content-muted dark:text-secondary-400 font-sans">
        {label}
      </Text>
      {isPlainValue ? (
        <View className="flex-1 items-end">
          <Text className="text-right text-sm text-content-primary dark:text-off-white font-sans">
            {value || '-'}
          </Text>
          {hint ? (
            <Text className="mt-0.5 text-right text-xs text-content-placeholder font-sans">
              {hint}
            </Text>
          ) : null}
        </View>
      ) : (
        <View className="flex-1">{children}</View>
      )}
    </View>
  );
}
