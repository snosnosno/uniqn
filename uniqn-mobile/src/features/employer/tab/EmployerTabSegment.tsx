/**
 * EmployerTabSegment — 내 공고 탭 [공고]/[근무표] 전환 (구인자 IA S3)
 *
 * 왼쪽이 [공고]이고 기본값도 [공고]다 — 신규 사용자 경험은 그대로 두고, 근무표는 한 번의 탭으로 닿게 한다.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';

export type EmployerTabSegmentValue = 'postings' | 'schedule';

const SEGMENTS: { value: EmployerTabSegmentValue; label: string }[] = [
  { value: 'postings', label: '공고' },
  { value: 'schedule', label: '근무표' },
];

export interface EmployerTabSegmentProps {
  value: EmployerTabSegmentValue;
  onChange: (value: EmployerTabSegmentValue) => void;
}

export function EmployerTabSegment({ value, onChange }: EmployerTabSegmentProps) {
  return (
    <View
      accessibilityRole="tablist"
      className="flex-row rounded-lg bg-secondary-100 p-1 dark:bg-surface"
    >
      {SEGMENTS.map((segment) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            onPress={() => onChange(segment.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${segment.label} 보기`}
            testID={`employer-segment-${segment.value}`}
            className={`min-h-[44px] flex-1 items-center justify-center rounded-md ${
              selected ? 'bg-white dark:bg-surface-overlay' : ''
            }`}
          >
            <Text
              className={`text-sm font-sans-semibold ${
                selected
                  ? 'text-primary-700 dark:text-primary-400'
                  : 'text-secondary-600 dark:text-secondary-400'
              }`}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
