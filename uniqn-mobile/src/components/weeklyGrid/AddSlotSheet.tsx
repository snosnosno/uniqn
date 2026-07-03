/**
 * AddSlotSheet — 주간 배치 그리드 인원 추가 시트(B1)
 *
 * 선택한 운영처 컨테이너의 특정 날짜에 인원을 꽂는 3가지 추가 방식:
 *   1) 풀 꽂기   — 이 운영처 확정 스태프 풀(useConfirmedStaff)에서 선택 → add_direct_staff
 *   2) 전화검색  — 전화번호 정확일치(useStaffPhoneSearch)로 가입자 찾아 add_direct_staff
 *   3) 공고 열기 — 기존 공고 작성 라우트로 venueId 를 실어 보냄(템플릿→인원→발행 재사용)
 *
 * 컨테이너에 스태프 추가는 허용(설계 §6). 정원 카운트·컨테이너 filled 미러 skip 은 RPC 가 보장(R1).
 * 추가 성공 후 그리드(부족셀·하루 슬롯) 갱신을 위한 weeklyGrid 무효화는 useConfirmedStaff.addStaff
 * 가 confirmedStaff/jobPostings 와 함께 담당한다(W-1) — 시트는 별도 무효화하지 않는다.
 *
 * 후보행·역할칩·전화검색 폼은 AddStaffModal 과 공유하는 프리미티브(@/components/staffPicker)로 통합.
 *
 * 중첩 RN Modal iOS 터치먹통(pitfall_nested_rn_modal_touch_dead) 회피 — 전화검색은 AddStaffModal
 * 모달을 중첩하지 않고 동일 훅(useStaffPhoneSearch)을 단일 시트 내부에 인라인 재사용한다.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { UserPlusIcon, UsersIcon, PhoneIcon, MegaphoneIcon } from '@/components/icons';
import { CandidateRow, RoleChips, PhoneSearchField } from '@/components/staffPicker';
import { STAFF_ROLES } from '@/constants';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';
import { useStaffPhoneSearch } from '@/hooks/useStaffPhoneSearch';
import { useToastStore } from '@/stores/toastStore';
import { toError } from '@/errors';
import { logger } from '@/utils/logger';
import { parseDateString } from '@/utils/date';
import type { UserPhoneSearchResult } from '@/repositories';
import { buildAddSlotPayload } from './addSlotPayload';

type AddMode = 'pool' | 'phone' | 'posting';

const OTHER_ROLE_KEY = 'other';
const KNOWN_ROLE_KEYS = new Set<string>(STAFF_ROLES.map((role) => role.key));

export interface AddSlotSheetProps {
  visible: boolean;
  onClose: () => void;
  /** venue 컨테이너 job_posting_id (= venueId) */
  containerId: string;
  /** YYYY-MM-DD 선택일(그리드 맥락에서 고정) */
  date: string;
  /** 추가 성공 후 상위 갱신 훅(선택) — weeklyGrid 무효화는 시트가 자체 처리 */
  onAdded?: () => void;
}

interface PickedStaff {
  staffId: string;
  name: string;
  photoURL?: string;
  defaultRole?: string;
}

/** 추가 방식 세그먼트 한 칸. */
function ModeTab({
  active,
  label,
  icon,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      className={`flex-1 flex-row items-center justify-center gap-1 rounded-md py-2.5 active:opacity-80 ${
        active ? 'bg-primary-500 dark:bg-primary-600' : 'bg-surface-card dark:bg-surface'
      }`}
    >
      {icon}
      <Text
        className={`text-sm font-sans-medium ${active ? 'text-white' : 'text-content-secondary'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function AddSlotSheet({ visible, onClose, containerId, date, onAdded }: AddSlotSheetProps) {
  const router = useRouter();
  const { addToast } = useToastStore();

  // 컨테이너 확정 스태프 풀 + 추가 변이(add_direct_staff). jobPostingId=컨테이너 id.
  const {
    staff: poolStaff,
    isLoading: isPoolLoading,
    addStaff,
    isAddingStaff,
  } = useConfirmedStaff(containerId);
  const phoneSearch = useStaffPhoneSearch();

  const [mode, setMode] = useState<AddMode>('pool');
  const [phone, setPhone] = useState('');
  const [picked, setPicked] = useState<PickedStaff | null>(null);
  const [roleKey, setRoleKey] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [timeSlot, setTimeSlot] = useState('');

  const resetSelection = useCallback(() => {
    setPicked(null);
    setRoleKey('');
    setCustomRole('');
    setTimeSlot('');
  }, []);

  const resetAll = useCallback(() => {
    phoneSearch.reset();
    setMode('pool');
    setPhone('');
    resetSelection();
  }, [phoneSearch, resetSelection]);

  // 시트가 숨겨지면(어떤 닫기 경로든) 입력·검색결과·선택을 비운다(PII 잔존 방지).
  useEffect(() => {
    if (!visible) {
      resetAll();
    }
    // resetAll 은 매 렌더 새 참조라 의존성에서 제외(visible 변화에만 반응).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleClose = useCallback(() => {
    resetAll();
    onClose();
  }, [onClose, resetAll]);

  // 풀: staffId 기준 중복 제거(같은 사람이 여러 날 배정돼도 1회만 노출).
  const poolPeople = useMemo<PickedStaff[]>(() => {
    const byId = new Map<string, PickedStaff>();
    for (const s of poolStaff) {
      if (!byId.has(s.staffId)) {
        byId.set(s.staffId, {
          staffId: s.staffId,
          name: s.staffName,
          photoURL: s.staffPhotoURL,
          defaultRole: s.role,
        });
      }
    }
    return [...byId.values()];
  }, [poolStaff]);

  const pickStaff = useCallback((person: PickedStaff) => {
    setPicked(person);
    // 직전 역할이 표준 키면 프리필, 아니면 미선택(사용자가 직접 고름).
    setRoleKey(
      person.defaultRole && KNOWN_ROLE_KEYS.has(person.defaultRole) ? person.defaultRole : ''
    );
    setCustomRole('');
    setTimeSlot('');
  }, []);

  const handleSearch = useCallback(() => {
    setPicked(null);
    void phoneSearch.search(phone);
  }, [phone, phoneSearch]);

  const isCustomRole = roleKey === OTHER_ROLE_KEY;
  const canSubmit =
    !!picked && !!roleKey && (!isCustomRole || customRole.trim().length > 0) && !isAddingStaff;

  const handleSubmit = useCallback(async () => {
    if (!picked || !roleKey) {
      return;
    }
    try {
      // write 경계: 페이로드 빌더가 날짜 정규화(E5)·XSS 검증(S1)을 수행(실패 시 throw).
      const payload = buildAddSlotPayload({
        containerId,
        staffId: picked.staffId,
        date,
        role: roleKey,
        customRole: isCustomRole ? customRole : undefined,
        timeSlot,
      });
      // 그리드 읽기(summary/daySlots) 무효화는 useConfirmedStaff.addStaff onSuccess 가 담당(W-1).
      await addStaff(payload);
      onAdded?.();
      handleClose();
    } catch (error) {
      // addStaff 자체 에러는 useConfirmedStaff onError 에서 토스트. 빌더(검증) 에러는 여기서 안내.
      const normalized = toError(error);
      const userMessage =
        (error as { userMessage?: string }).userMessage ?? '인원 추가에 실패했습니다.';
      logger.error('주간 그리드 인원 추가 실패', normalized, { containerId, date });
      addToast({ type: 'error', message: userMessage });
    }
  }, [
    picked,
    roleKey,
    isCustomRole,
    customRole,
    timeSlot,
    containerId,
    date,
    addStaff,
    onAdded,
    handleClose,
    addToast,
  ]);

  const handleOpenPosting = useCallback(() => {
    // 기존 공고 작성 라우트로 venueId+date 전달(템플릿→인원→발행 재사용).
    // create 라우트가 초기 draft 에 프리필(P2-1: buildGridPrefillDraft), draftAdapter 가 venue_id 로 영속(P6-1).
    router.push({
      pathname: '/(employer)/my-postings/create',
      params: { venueId: containerId, date },
    });
    handleClose();
  }, [router, containerId, date, handleClose]);

  const dateLabel = useMemo(() => {
    const parsed = parseDateString(date);
    return parsed ? format(parsed, 'M월 d일 (E)', { locale: ko }) : date;
  }, [date]);

  return (
    <Modal visible={visible} onClose={handleClose} title="인원 추가" size="lg" position="bottom">
      {/* 선택일(그리드 맥락에서 고정) */}
      <View className="mb-3 flex-row items-center gap-2">
        <Text className="text-sm text-content-secondary font-sans">배치일</Text>
        <Text className="text-sm font-sans-semibold text-content-primary">{dateLabel}</Text>
      </View>

      {/* 추가 방식 세그먼트 */}
      <View className="mb-3 flex-row gap-1 rounded-lg bg-surface-page p-1 dark:bg-surface-elevated">
        <ModeTab
          active={mode === 'pool'}
          label="풀 꽂기"
          icon={
            <UsersIcon size={16} color={mode === 'pool' ? '#FFFFFF' : SECONDARY_PALETTE[500]} />
          }
          onPress={() => {
            setMode('pool');
            resetSelection();
          }}
        />
        <ModeTab
          active={mode === 'phone'}
          label="전화검색"
          icon={
            <PhoneIcon size={16} color={mode === 'phone' ? '#FFFFFF' : SECONDARY_PALETTE[500]} />
          }
          onPress={() => {
            setMode('phone');
            resetSelection();
          }}
        />
        <ModeTab
          active={mode === 'posting'}
          label="공고 열기"
          icon={
            <MegaphoneIcon
              size={16}
              color={mode === 'posting' ? '#FFFFFF' : SECONDARY_PALETTE[500]}
            />
          }
          onPress={() => setMode('posting')}
        />
      </View>

      {mode === 'posting' ? (
        <View className="gap-4 py-2">
          <Text className="text-sm text-content-secondary font-sans">
            공고를 새로 열어 모집·발행합니다. 이 운영처로 연결됩니다.
          </Text>
          <Button
            variant="primary"
            onPress={handleOpenPosting}
            icon={<MegaphoneIcon size={18} color="#FFFFFF" />}
            fullWidth
          >
            공고 작성으로 이동
          </Button>
        </View>
      ) : (
        <ScrollView className="max-h-[440px]" keyboardShouldPersistTaps="handled">
          {/* 전화검색 입력(전화 모드만) */}
          {mode === 'phone' ? (
            <PhoneSearchField
              phone={phone}
              onChangePhone={setPhone}
              onSearch={handleSearch}
              isSearching={phoneSearch.isSearching}
            />
          ) : null}

          {/* 후보 리스트(풀 또는 전화 검색 결과) */}
          {mode === 'pool' ? (
            isPoolLoading ? (
              <View className="items-center py-6">
                <Loading size="small" />
              </View>
            ) : poolPeople.length === 0 ? (
              <View className="py-4">
                {/* 콜드스타트(P0-2): 첫 운영자는 풀이 비어 있다 — 죽은 안내문 대신 행동 CTA 2개 */}
                <EmptyState
                  icon={<UsersIcon size={40} color={SECONDARY_PALETTE[400]} />}
                  title="확정 스태프 풀이 비어 있어요"
                  description="공고로 모집하거나, 전화번호로 가입자를 찾아 바로 배치할 수 있어요."
                  actionLabel="공고로 모집하기"
                  onAction={handleOpenPosting}
                  secondaryActionLabel="전화번호로 찾기"
                  onSecondaryAction={() => {
                    setMode('phone');
                    resetSelection();
                  }}
                  compact
                />
              </View>
            ) : (
              <View className="mt-1 gap-2">
                {poolPeople.map((person) => (
                  <CandidateRow
                    key={person.staffId}
                    name={person.name}
                    photoURL={person.photoURL}
                    picked={picked?.staffId === person.staffId}
                    onPress={() => pickStaff(person)}
                  />
                ))}
              </View>
            )
          ) : phoneSearch.isSearching ? (
            <View className="items-center py-6">
              <Loading size="small" />
            </View>
          ) : phoneSearch.searched && phoneSearch.results.length === 0 ? (
            <Text className="py-4 text-center text-sm text-content-secondary font-sans">
              일치하는 가입자를 찾을 수 없습니다.
            </Text>
          ) : phoneSearch.results.length > 0 ? (
            <View className="mt-3 gap-2">
              {phoneSearch.results.map((user: UserPhoneSearchResult) => (
                <CandidateRow
                  key={user.uid}
                  name={user.name}
                  nickname={user.nickname ?? undefined}
                  region={user.region ?? undefined}
                  photoURL={user.photoURL ?? undefined}
                  picked={picked?.staffId === user.uid}
                  onPress={() =>
                    pickStaff({
                      staffId: user.uid,
                      name: user.name,
                      photoURL: user.photoURL ?? undefined,
                    })
                  }
                />
              ))}
            </View>
          ) : null}

          {/* 배정 입력(후보 선택 후) */}
          {picked ? (
            <View className="mt-4 gap-3 border-t border-secondary-200 pt-4 dark:border-surface-overlay">
              <Text className="text-sm font-sans-medium text-content-secondary">역할</Text>
              <RoleChips value={roleKey} onChange={setRoleKey} />

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
      )}

      {mode !== 'posting' ? (
        <View className="mt-4 flex-row gap-2">
          <Button variant="outline" onPress={handleClose} fullWidth className="flex-1">
            취소
          </Button>
          <Button
            variant="primary"
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={isAddingStaff}
            icon={<UserPlusIcon size={18} color="#FFFFFF" />}
            fullWidth
            className="flex-1"
          >
            추가
          </Button>
        </View>
      ) : null}
    </Modal>
  );
}

export default AddSlotSheet;
