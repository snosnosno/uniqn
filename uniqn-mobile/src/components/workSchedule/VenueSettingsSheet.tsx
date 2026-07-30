/**
 * VenueSettingsSheet — 지점 설정 시트 (지점 정보 + 역할별 단가표)
 *
 * v1 은 단가표 전용이었다(설계 §C 범위 컷). 그 결과 지점 이름·장소·연락처를 고칠 수단이
 * 어디에도 없었고, 배치된 스태프는 상세 화면에서 '이벤트 / 장소 : -' 를 봤다. S1 에서
 * 지점 정보 섹션을 얹어 그 경로를 뚫는다.
 *
 * 단가표: 주 입력은 배치 시 JIT(AddSlotSheet) — 여기는 일괄 조회·수정(시급 인상 등)·삭제용.
 * 행 편집/역할 추가 폼은 RoleSalaryField 재사용. 저장은 useSetVenueRoleSalary 단일 경로.
 *
 * ⚠️ 의도적으로 넣지 않은 것 두 가지:
 *  - **기본 근무시간** — 시간은 지점 설정이 아니라 배치·공고 작성 때마다 명시 입력한다
 *    (사용자 결정 4). 기본값이 있으면 색상만 고치려던 사용자가 8시간 근무를 확정시킨다.
 *  - **주소 자유 텍스트** — 주소는 검색 컴포넌트가 붙은 뒤 얹는다. 자유 입력으로 받으면
 *    길찾기가 그 문자열로 검색돼 엉뚱한 곳을 안내한다. 지금은 장소명·연락처만 받는다.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { TrashIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { RoleChips } from '@/components/staffPicker';
import { getRoleDisplayName } from '@/types/unified';
import { useSetVenueRoleSalary, useUpdateVenueContainer } from '@/hooks/workSchedule';
import { useToastStore } from '@/stores/toastStore';
import { confirmAction } from '@/utils/confirmAction';
import { isAppError } from '@/errors';
import type { VenueContainer } from '@/domains/workSchedule';
import type { PostingRoleCatalogEntry } from '@/types';
import { RoleSalaryField, defaultVenueSalaryDraft, type VenueSalaryDraft } from './RoleSalaryField';

const TYPE_LABEL: Record<string, string> = { hourly: '시급', daily: '일급', monthly: '월급' };

const entryLabel = (e: PostingRoleCatalogEntry) => getRoleDisplayName(e.role, e.customRole);
const salaryLabel = (e: PostingRoleCatalogEntry) =>
  e.salary
    ? `${TYPE_LABEL[e.salary.type] ?? e.salary.type} ${e.salary.amount.toLocaleString('ko-KR')}원`
    : '미설정';
const entryKey = (e: { role: string; customRole?: string }) =>
  e.role === 'other' && e.customRole ? `other:${e.customRole}` : e.role;

export interface VenueSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  container: VenueContainer | null;
}

export function VenueSettingsSheet({ visible, onClose, container }: VenueSettingsSheetProps) {
  const { addToast } = useToastStore();
  const mutation = useSetVenueRoleSalary();
  const profileMutation = useUpdateVenueContainer();
  const entries = container?.roleSalaries ?? [];

  // 지점 정보 폼 — 저장된 값으로 프리필하고, 시트를 다시 열거나 지점을 바꾸면 되돌린다.
  const [name, setName] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [phone, setPhone] = useState('');

  // 편집 중인 행 키 / 추가 폼 상태
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<VenueSalaryDraft | null>(null);
  const [adding, setAdding] = useState(false);
  const [addRole, setAddRole] = useState('');
  const [addCustomRole, setAddCustomRole] = useState('');
  const [addDraft, setAddDraft] = useState<VenueSalaryDraft | null>(null);

  const resetAddForm = useCallback(() => {
    setAdding(false);
    setAddRole('');
    setAddCustomRole('');
    setAddDraft(null);
  }, []);

  // 시트는 work-schedule 에서 상시 마운트(visible 토글)이므로, 닫기·지점(container) 변경 시
  // 폼 상태를 전량 리셋한다. 잔존 editDraft/addDraft 가 다른 지점 재오픈 시 프리필돼
  // 엉뚱한 지점에 저장되는 stale 오기록을 차단한다.
  useEffect(() => {
    setEditingKey(null);
    setEditDraft(null);
    resetAddForm();
    setName(container?.name ?? '');
    setPlaceName(container?.location?.name ?? '');
    setPhone(container?.contactPhone ?? '');
  }, [
    visible,
    container?.id,
    container?.name,
    container?.location?.name,
    container?.contactPhone,
    resetAddForm,
  ]);

  // 지점 정보 저장. 서버 규약상 undefined=미변경 / 빈 문자열=제거이므로, 사용자가 비운 칸은
  // undefined 로 뭉개지 말고 '' 를 그대로 보내야 실제로 지워진다.
  const saveProfile = useCallback(async () => {
    if (!container) return;
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      addToast({ type: 'error', message: '지점명을 입력해주세요' });
      return;
    }
    try {
      await profileMutation.mutateAsync({
        containerId: container.id,
        name: trimmedName,
        location: { name: placeName.trim() },
        contactPhone: phone.trim(),
      });
      addToast({ type: 'success', message: '지점 정보를 저장했어요' });
    } catch (err) {
      // 동명 지점(23505)·검증 실패는 서버가 한글 사유를 준다 — 뭉개면 사용자가 원인을 못 안다.
      const message =
        isAppError(err) && err.userMessage
          ? err.userMessage
          : '지점 정보 저장에 실패했어요. 잠시 후 다시 시도해주세요.';
      addToast({ type: 'error', message });
    }
  }, [container, name, placeName, phone, profileMutation, addToast]);

  const profileDirty =
    !!container &&
    (name.trim() !== container.name ||
      placeName.trim() !== (container.location?.name ?? '') ||
      phone.trim() !== (container.contactPhone ?? ''));

  const save = useCallback(
    async (role: string, customRole: string | undefined, salary: VenueSalaryDraft | null) => {
      if (!container) return;
      try {
        await mutation.mutateAsync({ venueId: container.id, role, customRole, salary });
        addToast({
          type: 'success',
          message: salary ? '단가를 저장했어요' : '단가를 삭제했어요 — 다음 배치 때 다시 물어봐요',
        });
        setEditingKey(null);
        resetAddForm();
      } catch {
        addToast({ type: 'error', message: '단가 저장에 실패했어요. 잠시 후 다시 시도해주세요.' });
      }
    },
    [container, mutation, addToast, resetAddForm]
  );

  // 삭제는 되돌리기 어려운 파괴적 동작 — 확인 후에만 실행(다음 배치 때 JIT 가 다시 물어봄).
  const confirmDelete = useCallback(
    (e: PostingRoleCatalogEntry) => {
      confirmAction({
        title: '단가 삭제',
        message: `${entryLabel(e)} 단가를 삭제할까요? 다음 배치 때 다시 물어봐요.`,
        confirmText: '삭제',
        destructive: true,
        onConfirm: () => save(e.role, e.customRole, null),
      });
    },
    [save]
  );

  const addRoleReady = !!addRole && (addRole !== 'other' || addCustomRole.trim().length > 0);

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="지점 설정"
      isLoading={mutation.isPending || profileMutation.isPending}
    >
      <View className="gap-3 p-5">
        {/* 지점 정보 — 이 값들이 배치된 스태프의 스케줄 상세에 그대로 보인다 */}
        <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
          지점 정보
        </Text>
        <Text className="text-sm text-content-secondary font-sans">
          여기 적은 지점명·장소·연락처가 배치된 스태프의 근무 상세에 보여요.
        </Text>
        <Input
          label="지점명"
          value={name}
          onChangeText={setName}
          placeholder="예: 홀덤펍 강남점"
          maxLength={50}
        />
        <Input
          label="장소"
          value={placeName}
          onChangeText={setPlaceName}
          placeholder="예: 강남역 2번 출구 앞"
          maxLength={100}
        />
        <Input
          label="연락처"
          value={phone}
          onChangeText={setPhone}
          placeholder="예: 02-123-4567"
          keyboardType="phone-pad"
          maxLength={25}
        />
        <Button
          variant="primary"
          disabled={!profileDirty || profileMutation.isPending}
          onPress={saveProfile}
          fullWidth
        >
          지점 정보 저장
        </Button>

        <View className="mt-2 border-t border-secondary-200 pt-4 dark:border-surface-overlay">
          <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
            역할별 단가
          </Text>
        </View>
        <Text className="text-sm text-content-secondary font-sans">
          처음 쓰는 역할은 배치 시 자동으로 여쭤봐요. 여기서는 한 번에 확인·수정할 수 있어요.
        </Text>

        {entries.length === 0 ? (
          <View className="items-center gap-2 py-8">
            <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
              아직 설정된 단가가 없어요
            </Text>
            <Text className="text-center text-sm text-content-secondary font-sans">
              근무표에서 인원을 배치할 때 자동으로 물어봐요. 미리 넣고 싶으면 아래에서 추가하세요.
            </Text>
          </View>
        ) : (
          <View className="gap-1">
            {entries.map((e) => {
              const key = entryKey(e);
              const isEditing = editingKey === key;
              return (
                <View
                  key={key}
                  className="border-b border-secondary-200 py-1 dark:border-surface-overlay"
                >
                  <View className="flex-row items-center justify-between py-2">
                    <Pressable
                      className="min-h-[44px] flex-1 flex-row items-center justify-between pr-2"
                      accessibilityRole="button"
                      accessibilityLabel={`${entryLabel(e)} 단가 수정`}
                      onPress={() => {
                        setEditingKey(isEditing ? null : key);
                        setEditDraft(
                          e.salary && e.salary.type !== 'other'
                            ? { type: e.salary.type, amount: e.salary.amount }
                            : defaultVenueSalaryDraft(e.role)
                        );
                      }}
                    >
                      <Text className="text-base text-content-primary dark:text-off-white font-sans-medium">
                        {entryLabel(e)}
                      </Text>
                      <Text className="text-base text-content-secondary font-sans">
                        {salaryLabel(e)}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => confirmDelete(e)}
                      disabled={mutation.isPending}
                      accessibilityRole="button"
                      accessibilityLabel={`${entryLabel(e)} 단가 삭제`}
                      accessibilityState={{ disabled: mutation.isPending }}
                      hitSlop={10}
                      className="h-11 w-11 items-center justify-center disabled:opacity-40"
                    >
                      <TrashIcon size={18} color={SECONDARY_PALETTE[400]} />
                    </Pressable>
                  </View>
                  {isEditing && editDraft ? (
                    <View className="gap-2 pb-2">
                      <RoleSalaryField
                        roleLabel={entryLabel(e)}
                        caption={`${entryLabel(e)} 단가 수정`}
                        value={editDraft}
                        onChange={setEditDraft}
                      />
                      <Button
                        variant="primary"
                        onPress={() => save(e.role, e.customRole, editDraft)}
                        fullWidth
                      >
                        단가 저장
                      </Button>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {/* 역할 추가 */}
        {adding ? (
          <View className="gap-3 pt-2">
            <Text className="text-sm font-sans-medium text-content-secondary">역할</Text>
            <RoleChips
              value={addRole}
              onChange={(role) => {
                setAddRole(role);
                setAddDraft(defaultVenueSalaryDraft(role));
              }}
            />
            {addRole === 'other' ? (
              <Input
                label="역할명 직접 입력"
                value={addCustomRole}
                onChangeText={setAddCustomRole}
                placeholder="예: 칩 러너"
              />
            ) : null}
            {addRoleReady && addDraft ? (
              <RoleSalaryField
                roleLabel={getRoleDisplayName(
                  addRole,
                  addRole === 'other' ? addCustomRole.trim() : undefined
                )}
                caption="단가 입력"
                value={addDraft}
                onChange={setAddDraft}
              />
            ) : null}
            <Button
              variant="primary"
              disabled={!addRoleReady || !addDraft}
              onPress={() =>
                addDraft &&
                save(addRole, addRole === 'other' ? addCustomRole.trim() : undefined, addDraft)
              }
              fullWidth
            >
              단가 추가
            </Button>
            <Button
              variant="ghost"
              onPress={resetAddForm}
              accessibilityLabel="역할 추가 취소"
              fullWidth
            >
              취소
            </Button>
          </View>
        ) : (
          <Button variant="outline" onPress={() => setAdding(true)} fullWidth>
            역할 추가
          </Button>
        )}
      </View>
    </SheetModal>
  );
}
