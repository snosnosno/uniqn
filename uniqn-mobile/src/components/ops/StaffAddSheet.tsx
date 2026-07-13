/**
 * ops 1e — 로스터 수동 추가 시트.
 * 전화번호 검색(useStaffPhoneSearch, search_users_by_phone RPC 재사용) → 가입자 선택 → 역할 선택
 * → ops_add_staff(useAddOpsStaff). 제출 직전 addOpsStaffInputSchema 로 재검증
 * (자유 텍스트 customRole XSS 방어 — CLAUDE.md 시스템 경계 검증 규칙, 이전까지 미소비였던 스키마를 여기서 소비).
 * AddStaffModal(직접추가 스태프, 근태 배정)의 전화검색 UX 를 차용하되 날짜/시간대 필드는 뺀다
 * (ops_staff 는 (대회, 스태프) 단위 로스터라 work_logs 식 근태 슬롯이 불필요).
 */
import { useCallback, useEffect, useState } from 'react';
import { Keyboard, Pressable, Text, View } from 'react-native';
import { STAFF_ROLES } from '@/constants';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { SheetModal } from '@/components/ui/SheetModal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Loading } from '@/components/ui/Loading';
import { SearchIcon, UserPlusIcon } from '@/components/icons';
import { useStaffPhoneSearch } from '@/hooks/useStaffPhoneSearch';
import { useAddOpsStaff } from '@/hooks/ops';
import { addOpsStaffInputSchema } from '@/schemas/opsStaff.schema';
import { useToastStore } from '@/stores/toastStore';
import type { UserPhoneSearchResult } from '@/repositories';
import type { StaffRole } from '@/types/role';

export interface StaffAddSheetProps {
  visible: boolean;
  tournamentId: string;
  onClose: () => void;
}

const OTHER_ROLE_KEY: StaffRole = 'other';

export function StaffAddSheet({ visible, tournamentId, onClose }: StaffAddSheetProps) {
  const { results, isSearching, searched, search, reset } = useStaffPhoneSearch();
  const addMut = useAddOpsStaff(tournamentId);

  const [phone, setPhone] = useState('');
  const [selected, setSelected] = useState<UserPhoneSearchResult | null>(null);
  const [roleKey, setRoleKey] = useState<StaffRole | ''>('');
  const [customRole, setCustomRole] = useState('');

  const resetAll = useCallback(() => {
    reset();
    setPhone('');
    setSelected(null);
    setRoleKey('');
    setCustomRole('');
  }, [reset]);

  const handleClose = useCallback(() => {
    resetAll();
    onClose();
  }, [onClose, resetAll]);

  // 모달이 숨겨지면 입력·검색결과·선택을 비운다(SheetModal 은 visible 토글만 되고 언마운트되지 않음 —
  // AddStaffModal 문형과 동일하게 재오픈 시 이전 PII 잔존 방지).
  useEffect(() => {
    if (!visible) {
      resetAll();
    }
  }, [visible, resetAll]);

  const handleSearch = useCallback(() => {
    // 키보드를 내려 하단 footer(취소/추가 버튼)가 키보드 뒤/화면 밖으로 밀리지 않게 한다 (iOS).
    // keyboardShouldPersistTaps='handled' 라 검색 버튼 탭만으로는 키보드가 자동으로 내려가지 않는다.
    Keyboard.dismiss();
    setSelected(null);
    void search(phone);
  }, [phone, search]);

  const isCustomRole = roleKey === OTHER_ROLE_KEY;
  const canSubmit =
    !!selected && !!roleKey && (!isCustomRole || customRole.trim().length > 0) && !addMut.isPending;

  const handleSubmit = useCallback(() => {
    if (!selected || !roleKey) return;

    const parsed = addOpsStaffInputSchema.safeParse({
      staffId: selected.uid,
      role: roleKey,
      customRole: isCustomRole ? customRole.trim() : null,
    });
    if (!parsed.success) {
      useToastStore.getState().error(parsed.error.issues[0]?.message ?? '입력값을 확인해주세요');
      return;
    }

    addMut.mutate(parsed.data, { onSuccess: handleClose });
  }, [selected, roleKey, isCustomRole, customRole, addMut, handleClose]);

  const footer = (
    <View className="flex-row gap-2">
      <Button variant="outline" onPress={handleClose} fullWidth className="flex-1">
        취소
      </Button>
      <Button
        variant="primary"
        onPress={handleSubmit}
        disabled={!canSubmit}
        loading={addMut.isPending}
        icon={<UserPlusIcon size={18} color="#FFFFFF" />}
        fullWidth
        className="flex-1"
      >
        추가
      </Button>
    </View>
  );

  return (
    <SheetModal
      visible={visible}
      onClose={handleClose}
      title="스태프 추가"
      isLoading={addMut.isPending}
      footer={footer}
    >
      <View className="p-5">
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
                    accessibilityRole="button"
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

        {/* 2단계: 역할 선택 (가입자 선택 후) */}
        {selected ? (
          <View className="mt-4 gap-3 border-t border-secondary-200 pt-4 dark:border-surface-overlay">
            <View>
              <Text className="mb-1.5 text-sm font-sans-medium text-content-secondary">역할</Text>
              <View className="flex-row flex-wrap gap-2">
                {STAFF_ROLES.map((role) => {
                  const isActive = roleKey === role.key;
                  return (
                    <Pressable
                      key={role.key}
                      onPress={() => setRoleKey(role.key)}
                      accessibilityRole="button"
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
          </View>
        ) : null}
      </View>
    </SheetModal>
  );
}

export default StaffAddSheet;
