/**
 * VenueSettingsSheet — 지점 역할별 단가표 관리 시트 (JIT 급여 설계 §C, 보조 진입점)
 *
 * 주 입력은 배치 시 JIT(AddSlotSheet) — 이 시트는 일괄 조회·수정(시급 인상 등)·삭제용.
 * 행 편집/역할 추가 폼은 RoleSalaryField 재사용. 저장은 useSetVenueRoleSalary 단일 경로.
 * v1 범위: 단가표만(지점 이름 변경 등 기타 설정 제외 — 설계 §C 범위 컷).
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
import { useSetVenueRoleSalary } from '@/hooks/weeklyGrid';
import { useToastStore } from '@/stores/toastStore';
import { confirmAction } from '@/utils/confirmAction';
import type { VenueContainer } from '@/domains/weeklyGrid';
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
  const entries = container?.roleSalaries ?? [];

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

  // 시트는 weekly-grid 에서 상시 마운트(visible 토글)이므로, 닫기·지점(container) 변경 시
  // 폼 상태를 전량 리셋한다. 잔존 editDraft/addDraft 가 다른 지점 재오픈 시 프리필돼
  // 엉뚱한 지점에 저장되는 stale 오기록을 차단한다.
  useEffect(() => {
    setEditingKey(null);
    setEditDraft(null);
    resetAddForm();
  }, [visible, container?.id, resetAddForm]);

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
      title="역할별 단가"
      isLoading={mutation.isPending}
    >
      <View className="gap-3 p-5">
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
