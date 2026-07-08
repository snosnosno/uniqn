/** ops 1b — 테이블 추가 폼. seatCount(1~11)/name/lockType/priority 입력 → onSubmit. */
import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import type { OpsTableLockType } from '@/types/ops';

const LOCK_OPTIONS: { value: OpsTableLockType; label: string }[] = [
  { value: 'none', label: '없음' },
  { value: 'locked', label: '잠금' },
  { value: 'feature', label: '피처' },
];

export interface AddTableInput {
  seatCount: number;
  name?: string;
  lockType: OpsTableLockType;
  priority?: number;
}

interface AddTableFormProps {
  isPending: boolean;
  onSubmit: (input: AddTableInput) => void;
}

export function AddTableForm({ isPending, onSubmit }: AddTableFormProps) {
  const [seatCount, setSeatCount] = useState('9');
  const [name, setName] = useState('');
  const [lockType, setLockType] = useState<OpsTableLockType>('none');
  const [priority, setPriority] = useState('');

  const seatNum = parseInt(seatCount.replace(/[^0-9]/g, ''), 10);
  const seatValid = Number.isInteger(seatNum) && seatNum >= 1 && seatNum <= 11;
  const parsedPriority = parseInt(priority.replace(/[^0-9]/g, ''), 10);
  const priorityValue = Number.isInteger(parsedPriority) ? parsedPriority : undefined;

  const submit = () => {
    if (!seatValid || isPending) return;
    onSubmit({
      seatCount: seatNum,
      name: name.trim() || undefined,
      lockType,
      priority: priorityValue,
    });
  };

  return (
    <View className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="테이블 이름 (선택)"
        placeholderTextColor="#9CA3AF"
        maxLength={40}
        className="mb-2 rounded-md border border-gray-300 px-3 py-2 text-content-primary dark:border-gray-700 dark:text-off-white"
      />
      <View className="flex-row gap-2">
        <TextInput
          value={seatCount}
          onChangeText={setSeatCount}
          placeholder="좌석 수 (1-11)"
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          maxLength={2}
          className="mb-2 flex-1 rounded-md border border-gray-300 px-3 py-2 text-content-primary dark:border-gray-700 dark:text-off-white"
        />
        <TextInput
          value={priority}
          onChangeText={setPriority}
          placeholder="우선순위 (선택)"
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          maxLength={2}
          className="mb-2 flex-1 rounded-md border border-gray-300 px-3 py-2 text-content-primary dark:border-gray-700 dark:text-off-white"
        />
      </View>

      <Text className="mb-1 text-xs text-secondary-500 dark:text-secondary-400">잠금</Text>
      <View className="mb-3 flex-row gap-2">
        {LOCK_OPTIONS.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => setLockType(o.value)}
            accessibilityRole="button"
            className={`flex-1 items-center rounded-md py-2 active:opacity-70 ${
              lockType === o.value ? 'bg-primary-600' : 'bg-gray-100 dark:bg-gray-800'
            }`}
          >
            <Text
              className={`text-sm ${
                lockType === o.value ? 'font-sans-semibold text-white' : 'text-content-primary'
              }`}
            >
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={submit}
        disabled={!seatValid || isPending}
        accessibilityRole="button"
        className={`items-center rounded-md py-2.5 ${
          seatValid && !isPending
            ? 'bg-primary-600 active:opacity-70'
            : 'bg-gray-300 dark:bg-gray-700'
        }`}
      >
        <Text className="font-sans-semibold text-white">
          {isPending ? '추가 중…' : '테이블 추가'}
        </Text>
      </Pressable>
      {!seatValid && seatCount.trim().length > 0 && (
        <Text className="mt-1 text-xs text-error-600 dark:text-error-400">
          좌석 수는 1~11 사이여야 합니다.
        </Text>
      )}
    </View>
  );
}
