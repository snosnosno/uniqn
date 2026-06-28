/**
 * UNIQN Mobile - 스태프 직접 추가 모달
 *
 * @description 지원 절차 없이 앱 가입자를 스태프로 직접 추가한다.
 *   1단계: 전화번호 정확 일치 검색 → 가입자 선택
 *   2단계: 근무 날짜/역할/(선택)시간대 입력 → 추가
 *
 * 백엔드 정합(정원 가드/정원 카운트)은 add_direct_staff RPC가 보장한다.
 */

import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { format } from 'date-fns';
import { STAFF_ROLES } from '@/constants';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Avatar } from '@/components/ui/Avatar';
import { Loading } from '@/components/ui/Loading';
import { SearchIcon, UserPlusIcon } from '@/components/icons';
import { useStaffPhoneSearch } from '@/hooks/useStaffPhoneSearch';
import type { UserPhoneSearchResult } from '@/repositories';
import type { AddDirectStaffInput } from '@/types';

export interface AddStaffModalProps {
  visible: boolean;
  onClose: () => void;
  jobPostingId: string;
  isSubmitting?: boolean;
  onSubmit: (input: AddDirectStaffInput) => Promise<unknown>;
}

const OTHER_ROLE_KEY = 'other';

export function AddStaffModal({
  visible,
  onClose,
  jobPostingId,
  isSubmitting = false,
  onSubmit,
}: AddStaffModalProps) {
  const { results, isSearching, searched, search, reset } = useStaffPhoneSearch();

  const [phone, setPhone] = useState('');
  const [selected, setSelected] = useState<UserPhoneSearchResult | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [roleKey, setRoleKey] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [timeSlot, setTimeSlot] = useState('');

  const resetAll = useCallback(() => {
    reset();
    setPhone('');
    setSelected(null);
    setDate(null);
    setRoleKey('');
    setCustomRole('');
    setTimeSlot('');
  }, [reset]);

  const handleClose = useCallback(() => {
    resetAll();
    onClose();
  }, [onClose, resetAll]);

  const handleSearch = useCallback(() => {
    // 재검색 시 이전 선택을 초기화 — 새 결과에 없는 사람이 그대로 제출되는 것을 방지
    setSelected(null);
    void search(phone);
  }, [phone, search]);

  const isCustomRole = roleKey === OTHER_ROLE_KEY;
  const canSubmit =
    !!selected &&
    !!date &&
    !!roleKey &&
    (!isCustomRole || customRole.trim().length > 0) &&
    !isSubmitting;

  const handleSubmit = useCallback(async () => {
    if (!selected || !date || !roleKey) {
      return;
    }

    const input: AddDirectStaffInput = {
      jobPostingId,
      staffId: selected.uid,
      assignments: [
        {
          date: format(date, 'yyyy-MM-dd'),
          role: roleKey,
          customRole: isCustomRole ? customRole.trim() : undefined,
          timeSlot: timeSlot.trim() ? timeSlot.trim() : undefined,
        },
      ],
    };

    try {
      await onSubmit(input);
      handleClose();
    } catch {
      // 에러 토스트는 호출측(useConfirmedStaff onError)에서 처리한다. 모달은 유지.
    }
  }, [
    selected,
    date,
    roleKey,
    isCustomRole,
    customRole,
    timeSlot,
    jobPostingId,
    onSubmit,
    handleClose,
  ]);

  return (
    <Modal visible={visible} onClose={handleClose} title="스태프 추가" size="lg" position="bottom">
      <ScrollView className="max-h-[480px]" keyboardShouldPersistTaps="handled">
        {/* 1단계: 전화번호 검색 */}
        <View className="flex-row items-end gap-2">
          <View className="flex-1">
            <Input
              label="전화번호"
              value={phone}
              onChangeText={setPhone}
              placeholder="등록된 전화번호 전체 입력"
              keyboardType="phone-pad"
              hint="개인정보 보호를 위해 전화번호 전체가 정확히 일치해야 검색됩니다."
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </View>
          <Button
            variant="secondary"
            onPress={handleSearch}
            loading={isSearching}
            icon={<SearchIcon size={18} color={SECONDARY_PALETTE[500]} />}
            accessibilityLabel="전화번호로 검색"
          >
            검색
          </Button>
        </View>

        {/* 검색 결과 */}
        {isSearching ? (
          <View className="items-center py-6">
            <Loading size="small" />
          </View>
        ) : searched && results.length === 0 ? (
          <Text className="py-4 text-center text-sm text-content-secondary font-sans">
            일치하는 가입자를 찾을 수 없습니다.
          </Text>
        ) : (
          results.length > 0 && (
            <View className="mt-3 gap-2">
              {results.map((user) => {
                const isPicked = selected?.uid === user.uid;
                return (
                  <Pressable
                    key={user.uid}
                    onPress={() => setSelected(user)}
                    className={`flex-row items-center rounded-md border p-3 active:opacity-80 ${
                      isPicked
                        ? 'border-primary-500 bg-primary-50 dark:border-primary-500 dark:bg-surface-elevated'
                        : 'border-secondary-200 bg-surface-card dark:border-surface-overlay dark:bg-surface'
                    }`}
                  >
                    <Avatar source={user.photoURL ?? undefined} name={user.name} size="md" />
                    <View className="ml-3 flex-1">
                      <Text className="text-base font-sans-semibold text-content-primary">
                        {user.name}
                        {user.nickname ? (
                          <Text className="text-sm text-content-secondary font-sans">
                            {`  ${user.nickname}`}
                          </Text>
                        ) : null}
                      </Text>
                      {user.region ? (
                        <Text className="text-xs text-content-secondary font-sans">
                          {user.region}
                        </Text>
                      ) : null}
                    </View>
                    {isPicked ? (
                      <Text className="text-sm font-sans-semibold text-primary-600 dark:text-primary-400">
                        선택됨
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )
        )}

        {/* 2단계: 배정 입력 (가입자 선택 후) */}
        {selected ? (
          <View className="mt-4 gap-3 border-t border-secondary-200 pt-4 dark:border-surface-overlay">
            <DatePicker label="근무 날짜" value={date} onChange={setDate} />

            <View>
              <Text className="mb-1.5 text-sm font-sans-medium text-content-secondary">역할</Text>
              <View className="flex-row flex-wrap gap-2">
                {STAFF_ROLES.map((role) => {
                  const isActive = roleKey === role.key;
                  return (
                    <Pressable
                      key={role.key}
                      onPress={() => setRoleKey(role.key)}
                      className={`flex-row items-center rounded-full border px-3 py-2 active:opacity-80 ${
                        isActive
                          ? 'border-primary-500 bg-primary-50 dark:bg-surface-elevated'
                          : 'border-secondary-200 bg-surface-card dark:border-surface-overlay dark:bg-surface'
                      }`}
                    >
                      <Text
                        className={`text-sm font-sans-medium ${
                          isActive
                            ? 'text-primary-700 dark:text-primary-300'
                            : 'text-content-secondary'
                        }`}
                      >
                        {`${role.icon} ${role.name}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {isCustomRole ? (
              <Input
                label="역할명 직접 입력"
                value={customRole}
                onChangeText={setCustomRole}
                placeholder="예: 칩 러너"
              />
            ) : null}

            <Input
              label="시간대 (선택)"
              value={timeSlot}
              onChangeText={setTimeSlot}
              placeholder="예: 18:00~02:00"
            />
          </View>
        ) : null}
      </ScrollView>

      <View className="mt-4 flex-row gap-2">
        <Button variant="outline" onPress={handleClose} fullWidth className="flex-1">
          취소
        </Button>
        <Button
          variant="primary"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={isSubmitting}
          icon={<UserPlusIcon size={18} color="#FFFFFF" />}
          fullWidth
          className="flex-1"
        >
          추가
        </Button>
      </View>
    </Modal>
  );
}

export default AddStaffModal;
