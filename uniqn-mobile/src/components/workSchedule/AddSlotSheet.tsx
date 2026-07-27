/**
 * AddSlotSheet — 근무표 인원 추가 시트(B1)
 *
 * 선택한 운영처 컨테이너의 특정 날짜에 인원을 꽂는 3가지 추가 방식:
 *   1) 풀 꽂기   — 이 운영처 확정 스태프 풀(useConfirmedStaff)에서 선택 → add_direct_staff
 *   2) 닉네임검색 — 닉네임 prefix(useStaffNicknameSearch)로 가입자 찾아 add_direct_staff
 *   3) 공고 열기 — 기존 공고 작성 라우트로 venueId 를 실어 보냄(템플릿→인원→발행 재사용)
 *
 * 컨테이너에 스태프 추가는 허용(설계 §6). 정원 카운트·컨테이너 filled 미러 skip 은 RPC 가 보장(R1).
 * 추가 성공 후 그리드(부족셀·하루 슬롯) 갱신을 위한 workSchedule 무효화는 useConfirmedStaff.addStaff
 * 가 confirmedStaff/jobPostings 와 함께 담당한다(W-1) — 시트는 별도 무효화하지 않는다.
 *
 * 후보행·역할칩·닉네임검색 폼은 AddStaffModal 과 공유하는 프리미티브(@/components/staffPicker)로 통합.
 * 시간대는 형제 화면 AddStaffModal·지원/확정 흐름과 동일하게 **출근시간(start) 하나만** 받는다
 * (StartTimeField: 단일 wheel-picker + '미정' 토글). 종료·익일 개념은 이 화면에 없으므로
 * SlotTimeField/OvernightPreviewBanner 는 쓰지 않는다(그것들은 근무표 슬롯 편집 EditSlotSheet 전용).
 * 저장은 출근시간 있으면 'HH:mm' 단일, 미정이면 timeSlot 미기록(형식 검증은 addSlotPayload).
 *
 * 중첩 RN Modal iOS 터치먹통(pitfall_nested_rn_modal_touch_dead) 회피 — 닉네임검색은 AddStaffModal
 * 모달을 중첩하지 않고 동일 훅(useStaffNicknameSearch)을 단일 시트 내부에 인라인 재사용하며,
 * 시간 휠 피커는 SheetModal 의 overlay(Modal 루트 렌더)로 띄운다(EditSlotSheet·AddStaffModal 패턴).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { SheetModal } from '@/components/ui/SheetModal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { TimeWheelPicker, type TimeValue } from '@/components/ui/TimeWheelPicker';
import { UserPlusIcon, UsersIcon, SearchIcon, MegaphoneIcon } from '@/components/icons';
import {
  CandidateRow,
  RoleChips,
  NicknameSearchField,
  SearchErrorNotice,
} from '@/components/staffPicker';
import { STAFF_ROLES } from '@/constants';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { DEFAULT_SLOT_START_TIME, hasRoleSalary } from '@/domains/workSchedule';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';
import { useStaffNicknameSearch } from '@/hooks/useStaffNicknameSearch';
import { useVenueContainer, useSetVenueRoleSalary } from '@/hooks/workSchedule';
import { useToastStore } from '@/stores/toastStore';
import { getRoleDisplayName } from '@/types/unified';
import { toError } from '@/errors';
import { logger } from '@/utils/logger';
import { parseDateString } from '@/utils/date';
import type { UserNicknameSearchResult } from '@/repositories';
import { buildAddSlotPayload } from './addSlotPayload';
import { RoleSalaryField, defaultVenueSalaryDraft, type VenueSalaryDraft } from './RoleSalaryField';
import { timeStringToValue, timeValueToString } from './SlotTimeField';
import { StartTimeField } from './StartTimeField';

type AddMode = 'pool' | 'nickname' | 'posting';

const OTHER_ROLE_KEY = 'other';
const KNOWN_ROLE_KEYS = new Set<string>(STAFF_ROLES.map((role) => role.key));

// 출근시간 기본값 SSOT — 홀덤펍 저녁 운영 기준.
const DEFAULT_START = DEFAULT_SLOT_START_TIME;

export interface AddSlotSheetProps {
  visible: boolean;
  onClose: () => void;
  /** venue 컨테이너 job_posting_id (= venueId) */
  containerId: string;
  /** YYYY-MM-DD 선택일(그리드 맥락에서 고정) */
  date: string;
  /** 추가 성공 후 상위 갱신 훅(선택) — workSchedule 무효화는 시트가 자체 처리 */
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
      {/* 골드(primary-500 #D4AF37) 위 흰 글씨는 약 1.9:1 로 WCAG 실패 — 선택된 칩의 글자가
          사실상 안 보인다. 같은 목적의 기존 토큰 content-onGold(#09090B)로 교체(약 10:1). */}
      <Text
        className={`text-sm font-sans-medium ${active ? 'text-content-onGold' : 'text-content-secondary'}`}
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
  const nicknameSearch = useStaffNicknameSearch();

  const [mode, setMode] = useState<AddMode>('pool');
  const [nickname, setNickname] = useState('');
  const [picked, setPicked] = useState<PickedStaff | null>(null);
  const [roleKey, setRoleKey] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [startTime, setStartTime] = useState(DEFAULT_START);
  // 출근시간 미정 — 체크 시 timeSlot 미기록(지원/확정 모델과 동일).
  const [isTimeUndefined, setIsTimeUndefined] = useState(false);
  // 출근시간 휠 피커 열림 여부. 중첩 Modal 없이 SheetModal overlay 로 단일 렌더.
  const [pickerOpen, setPickerOpen] = useState(false);

  // JIT 급여 접점: 컨테이너 단가표(roleSalaries) 읽기 + 단가 저장 변이 + 인라인 드래프트.
  // 시트가 열렸을 때만 조회(닫힌 상태 재조회 방지). 미설정 역할만 그 자리서 묻는다(설계 §B).
  const { data: container, isFetched: containerFetched } = useVenueContainer(
    visible ? containerId : null
  );
  const setRoleSalary = useSetVenueRoleSalary();
  const [jitDraft, setJitDraft] = useState<VenueSalaryDraft | null>(null);
  const [jitDismissed, setJitDismissed] = useState(false);

  const resetSelection = useCallback(() => {
    setPicked(null);
    setRoleKey('');
    setCustomRole('');
    setStartTime(DEFAULT_START);
    setIsTimeUndefined(false);
    setPickerOpen(false);
  }, []);

  const resetAll = useCallback(() => {
    nicknameSearch.reset();
    setMode('pool');
    setNickname('');
    resetSelection();
  }, [nicknameSearch, resetSelection]);

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
    setStartTime(DEFAULT_START);
    setIsTimeUndefined(false);
    setPickerOpen(false);
  }, []);

  const handleSearch = useCallback(() => {
    setPicked(null);
    void nicknameSearch.search(nickname);
  }, [nickname, nicknameSearch]);

  const isCustomRole = roleKey === OTHER_ROLE_KEY;
  // 출근시간은 단일 시각 또는 미정 — 항상 유효(시작==종료 같은 가드 불필요).
  const canSubmit =
    !!picked && !!roleKey && (!isCustomRole || customRole.trim().length > 0) && !isAddingStaff;

  // 역할 선택 완료 여부(표준=칩, 커스텀=이름 입력) + JIT 단가 필요 판정.
  const roleReady = !!roleKey && (!isCustomRole || customRole.trim().length > 0);
  // 컨테이너 조회 도착 전(container undefined)에는 hasRoleSalary([],…)=false 로 이미 설정된 역할까지
  // JIT 로 오노출→기본 드래프트가 기존 단가를 덮어쓴다. isFetched 게이트로 데이터 확정 후에만 판정한다.
  const needsJitSalary =
    containerFetched &&
    roleReady &&
    !jitDismissed &&
    !hasRoleSalary(
      container?.roleSalaries ?? [],
      roleKey,
      isCustomRole ? customRole.trim() : undefined
    );

  // roleKey 변경 시에만 JIT 드래프트를 기본값으로 재시드('나중에 설정'도 함께 무효화).
  // 커스텀명(customRole) 키 입력마다 재시드하면 사용자가 수정한 단가가 조용히 소실되므로 제외한다.
  // 기타 역할의 기본 드래프트는 customRole 텍스트와 무관(defaultVenueSalaryDraft(roleKey) 고정)하고,
  // 노출 자체는 needsJitSalary(roleReady 포함) 가 게이트하므로 roleKey 만으로 시드해도 안전하다.
  useEffect(() => {
    setJitDismissed(false);
    setJitDraft(roleKey ? defaultVenueSalaryDraft(roleKey) : null);
  }, [roleKey]);

  // 커스텀명이 바뀌면 다른 역할 정체성 → '나중에 설정'만 무효화(드래프트 금액은 보존).
  useEffect(() => {
    setJitDismissed(false);
  }, [customRole]);

  // 출근시간 피커 값('HH:mm' → TimeValue).
  const pickerValue = useMemo<TimeValue>(() => timeStringToValue(startTime), [startTime]);

  // 휠 피커 선택 완료 → 'HH:mm'(0패딩) 로 되돌려 반영.
  const handlePickerConfirm = useCallback((timeValue: TimeValue) => {
    setStartTime(timeValueToString(timeValue));
    setPickerOpen(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!picked || !roleKey) {
      return;
    }
    // JIT: 미설정 역할이면 단가를 **먼저** 저장한다. 실패해도 배치는 계속(설계 §B) — 토스트로 재안내.
    if (needsJitSalary && jitDraft) {
      try {
        await setRoleSalary.mutateAsync({
          venueId: containerId,
          role: roleKey,
          customRole: isCustomRole ? customRole.trim() : undefined,
          salary: jitDraft,
        });
      } catch (error) {
        logger.warn('지점 단가 JIT 저장 실패 — 배치는 계속', {
          containerId,
          roleKey,
          cause: toError(error).message,
        });
        addToast({
          type: 'info',
          message: '단가 저장에 실패했어요. 다음 배치 때 다시 물어볼게요.',
        });
      }
    }
    try {
      // write 경계: 페이로드 빌더가 날짜 정규화(E5)·시간 형식 검증(TIME_RE)·XSS 검증(S1)을 수행(실패 시 throw).
      // 출근시간은 미정이면 미기록, 아니면 단일 'HH:mm'(지원/확정 모델과 동일).
      const payload = buildAddSlotPayload({
        containerId,
        staffId: picked.staffId,
        date,
        role: roleKey,
        customRole: isCustomRole ? customRole : undefined,
        startTime,
        timeUndefined: isTimeUndefined,
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
      logger.error('근무표 인원 추가 실패', normalized, { containerId, date });
      addToast({ type: 'error', message: userMessage });
    }
  }, [
    picked,
    roleKey,
    isCustomRole,
    customRole,
    startTime,
    isTimeUndefined,
    containerId,
    date,
    addStaff,
    onAdded,
    handleClose,
    addToast,
    needsJitSalary,
    jitDraft,
    setRoleSalary,
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

  // 하단 고정 액션(취소/추가) — 공고 열기 모드는 자체 CTA 를 쓰므로 footer 없음.
  const footer =
    mode !== 'posting' ? (
      <View className="flex-row gap-2">
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
    ) : undefined;

  // 출근시간 휠 피커 — SheetModal 루트에 embedded 오버레이로 렌더(중첩 RN Modal 회피).
  const pickerOverlay = (
    <TimeWheelPicker
      visible={pickerOpen}
      value={pickerValue}
      title="출근 시간"
      minHour={0}
      maxHour={23}
      minuteInterval={15}
      onConfirm={handlePickerConfirm}
      onClose={() => setPickerOpen(false)}
      embedded
    />
  );

  return (
    <SheetModal
      visible={visible}
      onClose={handleClose}
      title="인원 추가"
      isLoading={isAddingStaff}
      footer={footer}
      overlay={pickerOverlay}
    >
      <View className="p-5">
        {/* 선택일(그리드 맥락에서 고정) */}
        <View className="mb-3 flex-row items-center gap-2">
          <Text className="text-sm text-content-secondary font-sans">배치일</Text>
          <Text className="text-sm font-sans-semibold text-content-primary dark:text-off-white">
            {dateLabel}
          </Text>
        </View>

        {/* 추가 방식 세그먼트 */}
        <View className="mb-3 flex-row gap-1 rounded-lg bg-surface-page p-1 dark:bg-surface-elevated">
          <ModeTab
            active={mode === 'pool'}
            label="스태프 추가"
            icon={
              <UsersIcon size={16} color={mode === 'pool' ? '#FFFFFF' : SECONDARY_PALETTE[500]} />
            }
            onPress={() => {
              setMode('pool');
              resetSelection();
            }}
          />
          <ModeTab
            active={mode === 'nickname'}
            label="닉네임검색"
            icon={
              <SearchIcon
                size={16}
                color={mode === 'nickname' ? '#FFFFFF' : SECONDARY_PALETTE[500]}
              />
            }
            onPress={() => {
              setMode('nickname');
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
              공고를 새로 열어 모집·발행합니다. 이 지점으로 연결됩니다.
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
          <>
            {/* 닉네임검색 입력(닉네임 모드만) */}
            {mode === 'nickname' ? (
              <NicknameSearchField
                nickname={nickname}
                onChangeNickname={setNickname}
                onSearch={handleSearch}
                isSearching={nicknameSearch.isSearching}
              />
            ) : null}

            {/* 후보 리스트(풀 또는 닉네임 검색 결과) */}
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
                    description="공고로 모집하거나, 닉네임으로 가입자를 찾아 바로 배치할 수 있어요."
                    actionLabel="공고로 모집하기"
                    onAction={handleOpenPosting}
                    secondaryActionLabel="닉네임으로 찾기"
                    onSecondaryAction={() => {
                      setMode('nickname');
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
            ) : nicknameSearch.isSearching ? (
              <View className="items-center py-6">
                <Loading size="small" />
              </View>
            ) : nicknameSearch.error ? (
              <SearchErrorNotice error={nicknameSearch.error} />
            ) : nicknameSearch.searched && nicknameSearch.results.length === 0 ? (
              <Text className="py-4 text-center text-sm text-content-secondary font-sans">
                일치하는 가입자를 찾을 수 없습니다.
              </Text>
            ) : nicknameSearch.results.length > 0 ? (
              <View className="mt-3 gap-2">
                {nicknameSearch.results.map((user: UserNicknameSearchResult) => (
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

                {/* JIT 단가 — 미설정 역할일 때만 그 자리서 입력(설정돼 있으면 미노출). '나중에 설정' 가능 */}
                {needsJitSalary && jitDraft ? (
                  <RoleSalaryField
                    roleLabel={getRoleDisplayName(
                      roleKey,
                      isCustomRole ? customRole.trim() : undefined
                    )}
                    value={jitDraft}
                    onChange={setJitDraft}
                    onDismiss={() => setJitDismissed(true)}
                  />
                ) : null}

                {/* 출근시간 — 형제 화면(지원/확정)처럼 단일 시각 + '미정' 토글(종료·익일 없음) */}
                <StartTimeField
                  value={startTime}
                  isUndefined={isTimeUndefined}
                  onToggleUndefined={setIsTimeUndefined}
                  onPress={() => setPickerOpen(true)}
                />
              </View>
            ) : null}
          </>
        )}
      </View>
    </SheetModal>
  );
}
