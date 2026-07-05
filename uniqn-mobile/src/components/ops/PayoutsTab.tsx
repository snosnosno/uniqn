/**
 * ops 1f — PAYOUTS 탭 컨테이너(2부): 구조 편집 | 페이아웃 대장 세그먼트 전환.
 * 편집기(PayoutStructureEditor) = 금액/% 구조 저장. 대장(PayoutLedger) = 실지급 조인·정정.
 */
import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import type { OpsTournament } from '@/types/ops';
import { PayoutStructureEditor } from './PayoutStructureEditor';
import { PayoutLedger } from './PayoutLedger';

const SECTIONS = [
  { key: 'editor', label: '구조 편집' },
  { key: 'ledger', label: '페이아웃 대장' },
] as const;

type Section = (typeof SECTIONS)[number]['key'];

export function PayoutsTab({ tournament }: { tournament: OpsTournament }) {
  const [section, setSection] = useState<Section>('editor');

  return (
    <View className="flex-1">
      {/* 세그먼트([id].tsx 탭과 동일 스타일) */}
      <View className="mx-4 mb-1 mt-2 flex-row rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        {SECTIONS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => setSection(s.key)}
            accessibilityRole="button"
            className={`flex-1 items-center rounded-md py-2 ${section === s.key ? 'bg-white dark:bg-gray-700' : ''}`}
          >
            <Text
              numberOfLines={1}
              className={`text-xs ${section === s.key ? 'font-sans-semibold text-content-primary' : 'text-secondary-500 dark:text-secondary-400'}`}
            >
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {section === 'editor' ? (
          <PayoutStructureEditor tournament={tournament} />
        ) : (
          <PayoutLedger tournament={tournament} />
        )}
      </ScrollView>
    </View>
  );
}

export default PayoutsTab;
