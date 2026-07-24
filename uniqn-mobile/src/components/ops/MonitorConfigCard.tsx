/**
 * TV 모니터 구성 카드 (S1 C6-⑤ — 스펙 §5 설정 UI).
 * STATUS 탭 인라인 확장 카드: 프리셋 3택 세그먼트 + 슬롯 5개 SelectBottomSheet + 저장/기본값 복원.
 * ⚠️ 중첩 RN Modal iOS 터치먹통 함정 회피 — 카드 자체는 모달이 아니고 SelectBottomSheet 만 모달.
 * 진행 중 대회에서도 변경 가능(4s 폴링 내 TV 자동 반영, 별도 푸시 없음).
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SelectBottomSheet } from '@/components/ui/BottomSheet';
import { MONITOR_MODULES } from '@/components/ops/monitor/registry';
import {
  MONITOR_MODULE_IDS,
  MONITOR_PRESETS,
  MONITOR_SLOT_COUNT,
  parseMonitorConfig,
  type MonitorModuleId,
  type MonitorPreset,
  type MonitorSlots,
} from '@/domains/ops';
import { useSetMonitorConfig } from '@/hooks/ops';

const EMPTY_VALUE = '__empty__' as const;

/** 프리셋별 카드 고유 표시 데이터(라벨/설명) — id 목록 자체는 MONITOR_PRESETS 가 소스. */
const PRESET_META: Record<MonitorPreset, { label: string; description: string }> = {
  full: { label: '풀', description: '슬롯 좌 · 프라이즈 우' },
  mirror: { label: '미러', description: '프라이즈 좌 · 슬롯 우' },
  classic: { label: '클래식', description: '중앙 + 하단 스트립' },
};

const PRESETS: { value: MonitorPreset; label: string; description: string }[] = MONITOR_PRESETS.map(
  (value) => ({ value, ...PRESET_META[value] })
);

interface Props {
  tournamentId: string;
  /** ops_tournaments.monitor_config 원본(jsonb). NULL=기본. */
  monitorConfig: unknown;
}

export function MonitorConfigCard({ tournamentId, monitorConfig }: Props) {
  const [expanded, setExpanded] = useState(false);
  const saved = useMemo(() => parseMonitorConfig(monitorConfig), [monitorConfig]);
  const [preset, setPreset] = useState<MonitorPreset>(saved.preset);
  const [slots, setSlots] = useState<MonitorSlots>(saved.slots);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const configMut = useSetMonitorConfig(tournamentId);

  // 서버 구성이 바뀌면(다른 기기 저장 등) 편집 전 상태를 재동기화
  useEffect(() => {
    setPreset(saved.preset);
    setSlots(saved.slots);
  }, [saved]);

  const dirty = preset !== saved.preset || slots.some((slot, i) => slot !== saved.slots[i]);

  const pickerOptions = useMemo(() => {
    if (pickerSlot === null) return [];
    return [
      { label: '비움', value: EMPTY_VALUE },
      ...MONITOR_MODULE_IDS.map((id) => ({
        label: MONITOR_MODULES[id].pickerLabel,
        value: id,
        // 같은 모듈 중복 선택 비활성(현재 슬롯 자신은 허용)
        disabled: slots.includes(id) && slots[pickerSlot] !== id,
      })),
    ];
  }, [pickerSlot, slots]);

  const onPickSlot = (value: string) => {
    if (pickerSlot === null) return;
    setSlots((prev) =>
      prev.map((slot, i) =>
        i === pickerSlot ? (value === EMPTY_VALUE ? null : (value as MonitorModuleId)) : slot
      )
    );
    setPickerSlot(null);
  };

  const save = () => {
    if (configMut.isPending) return;
    configMut.mutate({ v: 1, preset, slots });
  };

  const resetToDefault = () => {
    if (configMut.isPending) return;
    configMut.mutate(null);
  };

  return (
    <View className="mx-1 mt-3 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        className="min-h-[44px] flex-row items-center justify-between p-4 active:opacity-70"
      >
        <View>
          <Text className="font-sans-semibold text-content-primary dark:text-off-white">
            TV 모니터 구성
          </Text>
          <Text className="text-xs text-secondary-500 dark:text-secondary-400">
            프리셋 {PRESETS.find((p) => p.value === preset)?.label} · 슬롯{' '}
            {slots.filter(Boolean).length}/{MONITOR_SLOT_COUNT}
          </Text>
        </View>
        <Text className="text-secondary-500 dark:text-secondary-400">
          {expanded ? '접기' : '편집'}
        </Text>
      </Pressable>

      {expanded ? (
        <View className="gap-4 border-t border-gray-200 p-4 dark:border-gray-700">
          {/* 프리셋 세그먼트 */}
          <View className="gap-2">
            <Text className="text-xs font-sans-medium text-secondary-500 dark:text-secondary-400">
              레이아웃 프리셋
            </Text>
            <View className="flex-row gap-2">
              {PRESETS.map((p) => {
                const selected = preset === p.value;
                return (
                  <Pressable
                    key={p.value}
                    onPress={() => setPreset(p.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    className={`min-h-[44px] flex-1 items-center justify-center rounded-md border px-2 py-2 ${
                      selected
                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        selected
                          ? 'font-sans-semibold text-primary-700 dark:text-primary-400'
                          : 'text-content-primary dark:text-content-primary'
                      }`}
                    >
                      {p.label}
                    </Text>
                    <Text className="text-[10px] text-secondary-500 dark:text-secondary-400">
                      {p.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 슬롯 5개 */}
          <View className="gap-2">
            <Text className="text-xs font-sans-medium text-secondary-500 dark:text-secondary-400">
              통계 슬롯 (위에서부터 표시 · 데이터 없으면 자동 숨김)
            </Text>
            {slots.map((slot, i) => (
              <Pressable
                key={i}
                onPress={() => setPickerSlot(i)}
                accessibilityRole="button"
                accessibilityLabel={`슬롯 ${i + 1} 모듈 선택`}
                className="min-h-[44px] flex-row items-center justify-between rounded-md border border-gray-200 px-3 py-2 active:opacity-70 dark:border-gray-700"
              >
                <Text className="text-sm text-secondary-500 dark:text-secondary-400">
                  슬롯 {i + 1}
                </Text>
                <Text className="text-sm font-sans-medium text-content-primary dark:text-off-white">
                  {slot ? MONITOR_MODULES[slot].pickerLabel : '비움'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* 저장 / 기본값 복원 */}
          <View className="flex-row gap-2">
            <Pressable
              onPress={resetToDefault}
              disabled={configMut.isPending}
              accessibilityRole="button"
              className={`min-h-[44px] items-center justify-center rounded-md bg-gray-100 px-4 dark:bg-gray-800 ${
                configMut.isPending ? 'opacity-40' : 'active:opacity-70'
              }`}
            >
              <Text className="text-sm text-content-primary dark:text-off-white">기본값</Text>
            </Pressable>
            <Pressable
              onPress={save}
              disabled={configMut.isPending || !dirty}
              accessibilityRole="button"
              className={`min-h-[44px] flex-1 items-center justify-center rounded-md bg-primary-600 ${
                configMut.isPending || !dirty ? 'opacity-40' : 'active:opacity-70'
              }`}
            >
              <Text className="font-sans-semibold text-white">
                {configMut.isPending ? '저장 중…' : '저장'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <SelectBottomSheet
        visible={pickerSlot !== null}
        onClose={() => setPickerSlot(null)}
        title={pickerSlot !== null ? `슬롯 ${pickerSlot + 1} 모듈` : '슬롯 모듈'}
        options={pickerOptions}
        onSelect={onPickSlot}
        snapPoints={['60%', '90%']}
        scrollable
      />
    </View>
  );
}
