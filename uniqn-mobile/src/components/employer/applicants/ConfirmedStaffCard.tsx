import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useCallback, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { STATUS } from '@/constants';
import { CONFIRMED_STAFF_STATUS } from '@/constants/statusConfig';
import { useUserProfile } from '@/hooks/useUserProfile';
import { WorkTimeDisplay } from '@/shared/time';
import { useThemeStore } from '@/stores/themeStore';
import { getRoleDisplayName } from '@/types/unified';
import { slotColorSwatchClassName } from '@/domains/workSchedule';
import type { ConfirmedStaff } from '@/types/confirmedStaff';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  BriefcaseIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  EditIcon,
  ExclamationTriangleIcon,
  RefreshIcon,
  TrashIcon,
} from '@/components/icons';

export interface ConfirmedStaffCardProps {
  staff: ConfirmedStaff;
  onPress?: (staff: ConfirmedStaff) => void;
  onViewProfile?: (staff: ConfirmedStaff) => void;
  /**
   * '근무 수정' — 통합 편집 시트를 연다. 시각뿐 아니라 역할·색·메모까지 한 창에서 고친다.
   *
   * ⚠️ 별도의 '역할 변경' 액션은 없다. 역할은 이 시트가 흡수했고, 따로 두면 같은 축을
   *    두 입구가 저장하게 된다(그때 한쪽만 `role_change_history` 를 남겼다).
   */
  onEditTime?: (staff: ConfirmedStaff) => void;
  onReport?: (staff: ConfirmedStaff) => void;
  onDelete?: (staff: ConfirmedStaff) => void;
  /**
   * 빼기를 **근태 상태와 무관하게** 허용한다(기본값 false = 출근 예정·취소 행만).
   *
   * 🔴 기본 규칙(출근 전만 뺄 수 있다)은 **탈출구가 있을 때만** 성립한다. 공고 스태프관리에는
   *    상태 되돌리기(출근 예정으로)가 있어서 잘못 찍힌 출근을 되돌린 뒤 뺄 수 있지만,
   *    **근무표에는 상태 변경 액션이 아예 없다.** 게다가 컨테이너 직속 배치
   *    (`job_posting_id = venue`)는 대응 공고가 없어 스태프관리 탭 자체가 존재하지 않는다 —
   *    QR 오인식으로 `checked_in` 이 되거나 노쇼 처리된 순간 **앱 전체에서 제거 경로가 0** 이 된다.
   *    폐기된 근무표 시트는 `!!slot.staffId` 만 봤다. 그 동작을 근무표 경로에서만 되살린다.
   *
   * ⚠️ 스태프관리 경로에는 켜지 말 것 — 거긴 되돌리기라는 안전한 경로가 이미 있다.
   */
  allowDeleteAnyStatus?: boolean;
  onStatusChange?: (staff: ConfirmedStaff) => void;
  onCancelNoShow?: (staff: ConfirmedStaff) => void;
  showActions?: boolean;
  compact?: boolean;
}

export const ConfirmedStaffCard = React.memo(function ConfirmedStaffCard({
  staff,
  onPress,
  onViewProfile,
  onEditTime,
  onReport,
  onDelete,
  allowDeleteAnyStatus = false,
  onStatusChange,
  onCancelNoShow,
  showActions = true,
  compact = false,
}: ConfirmedStaffCardProps) {
  const { isDarkMode } = useThemeStore();
  const { displayName, profilePhotoURL, profilePhotoURLBlurhash } = useUserProfile({
    userId: staff.staffId,
    fallbackName: staff.staffName,
    fallbackNickname: staff.staffNickname,
    fallbackPhotoURL: staff.staffPhotoURL,
    fallbackPhotoURLBlurhash: staff.staffPhotoURLBlurhash,
  });

  // 배치 색상 태그(#4) — 근무표에서 고른 슬롯 색상을 카드 이름 앞 스와치로 표시.
  const colorSwatch = slotColorSwatchClassName(staff.color);

  const isCheckedIn =
    staff.status === STATUS.WORK_LOG.CHECKED_IN ||
    staff.status === STATUS.WORK_LOG.CHECKED_OUT ||
    staff.status === STATUS.WORK_LOG.COMPLETED;

  const timeInfo = useMemo(
    () =>
      WorkTimeDisplay.getDisplayInfo({
        checkInTime: staff.checkInTime,
        checkOutTime: staff.checkOutTime,
        timeSlot: staff.timeSlot,
        date: staff.date,
      }),
    [staff.checkInTime, staff.checkOutTime, staff.date, staff.timeSlot]
  );

  const workDuration = timeInfo.duration !== '-' ? timeInfo.duration : null;
  const canDelete =
    allowDeleteAnyStatus ||
    staff.status === STATUS.WORK_LOG.SCHEDULED ||
    staff.status === STATUS.WORK_LOG.CANCELLED;
  const canChangeStatus =
    staff.status === STATUS.WORK_LOG.SCHEDULED ||
    staff.status === STATUS.WORK_LOG.CHECKED_IN ||
    staff.status === STATUS.WORK_LOG.CHECKED_OUT ||
    staff.status === STATUS.WORK_LOG.COMPLETED;
  // 정산 완료 건은 서버(ConfirmedStaffRepository.cancelNoShow)가 취소를 거부하므로
  // 버튼 단계에서 미리 숨긴다.
  const canCancelNoShow = staff.isNoShow && staff.payrollStatus !== STATUS.PAYROLL.COMPLETED;

  // 액션 줄에 **실제로 그려질** 버튼들. 이걸 미리 세지 않으면 콜백은 왔는데 상태 게이트가
  // 전부 막은 카드에서 구분선(mt-3 border-t pt-3)만 자식 없이 남는다 — 근무표처럼 콜백을
  // 하나만 넘기는 소비처에서 카드마다 빈 줄이 생겼다.
  // 🔴 상태로 진입을 막지 않는다(D2·D4). 시트가 **읽기 전용 모드로 열려** 정산 완료·노쇼·취소를
  // 각각의 이유로 거절하므로, 여기서 버튼까지 숨기면 사용자에게는 "왜 없지?"만 남는다.
  // 세 진입점(근무표·스태프관리·정산)이 같은 답을 주는 것이 D2 이고, 답을 말하는 주체는 시트다.
  // ⚠️ 노쇼 취소(`canCancelNoShow`)는 다르다 — 그쪽은 서버가 실제로 거부하고 대체 화면도 없어
  //    게이트를 유지한다. 잠금 사유의 정본은 `WorkLogEditSheet` 의 `lockReason` 이다.
  const showsEditTime = Boolean(onEditTime);
  const showsCancelNoShow = Boolean(onCancelNoShow) && canCancelNoShow;
  const showsReport = Boolean(onReport);
  const showsDelete = Boolean(onDelete) && canDelete;
  const hasVisibleActions = showsEditTime || showsCancelNoShow || showsReport || showsDelete;

  const handlePress = useCallback(() => {
    onPress?.(staff);
  }, [onPress, staff]);

  const handleViewProfile = useCallback(() => {
    onViewProfile?.(staff);
  }, [onViewProfile, staff]);

  const handleEditTime = useCallback(() => {
    onEditTime?.(staff);
  }, [onEditTime, staff]);

  const handleReport = useCallback(() => {
    onReport?.(staff);
  }, [onReport, staff]);

  const handleDelete = useCallback(() => {
    onDelete?.(staff);
  }, [onDelete, staff]);

  const handleStatusChange = useCallback(() => {
    onStatusChange?.(staff);
  }, [onStatusChange, staff]);

  const handleCancelNoShow = useCallback(() => {
    onCancelNoShow?.(staff);
  }, [onCancelNoShow, staff]);

  return (
    <Card variant="elevated" padding={compact ? 'sm' : 'md'}>
      <Pressable onPress={handlePress} disabled={!onPress}>
        <View className="flex-row items-center">
          <Pressable
            onPress={handleViewProfile}
            disabled={!onViewProfile}
            className="flex-1 flex-row items-center active:opacity-80"
          >
            <Avatar
              source={profilePhotoURL}
              name={displayName}
              size={compact ? 'sm' : 'md'}
              className="mr-3"
              blurhash={profilePhotoURLBlurhash}
            />
            <View className="flex-1">
              <View className="flex-row items-center">
                {colorSwatch ? (
                  <View
                    className={`mr-1.5 h-3 w-3 rounded-sm border border-divider ${colorSwatch}`}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                ) : null}
                <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
                  {displayName}
                </Text>
                {staff.isRead === false ? (
                  <View className="ml-2 h-2 w-2 rounded-sm bg-primary-500" />
                ) : null}
              </View>
              <View className="mt-0.5 flex-row items-center">
                <BriefcaseIcon size={12} color={SECONDARY_PALETTE[500]} />
                <Text className="ml-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                  {getRoleDisplayName(staff.role, staff.customRole)}
                </Text>
              </View>
            </View>
          </Pressable>

          <Pressable
            onPress={handleStatusChange}
            disabled={!canChangeStatus || !onStatusChange}
            className={canChangeStatus && onStatusChange ? 'active:opacity-70' : ''}
          >
            <Badge variant={CONFIRMED_STAFF_STATUS[staff.status].variant} size="sm">
              {CONFIRMED_STAFF_STATUS[staff.status].label}
            </Badge>
          </Pressable>
          {onPress ? <ChevronRightIcon size={20} color={SECONDARY_PALETTE[400]} /> : null}
        </View>

        {compact ? null : (
          <View className="mt-3 flex-row items-center border-t border-secondary-100 pt-3 dark:border-surface-overlay">
            <ClockIcon size={16} color={SECONDARY_PALETTE[500]} />
            <View className="ml-2 flex-1 flex-row">
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                    {timeInfo.isEffectiveStartActual ? '출근' : '시작'}
                  </Text>
                  {isCheckedIn ? (
                    <View className="ml-1">
                      <CheckCircleIcon size={12} color="#22C55E" />
                    </View>
                  ) : null}
                </View>
                <Text className="text-sm font-sans-medium text-content-primary dark:text-off-white">
                  {timeInfo.effectiveStart}
                </Text>
              </View>

              <View className="flex-1">
                <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                  {timeInfo.isEffectiveEndActual ? '퇴근' : '종료'}
                </Text>
                <Text className="text-sm font-sans-medium text-content-primary dark:text-off-white">
                  {/* P2-3-lite: 심야 운영 자정 넘김은 "익일" 병기(SSOT isEndNextDay) */}
                  {timeInfo.isEndNextDay ? `익일 ${timeInfo.effectiveEnd}` : timeInfo.effectiveEnd}
                </Text>
              </View>

              {workDuration ? (
                <View className="flex-1">
                  <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                    근무 시간
                  </Text>
                  <Text className="text-sm font-sans-semibold text-primary-600 dark:text-primary-400">
                    {workDuration}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {staff.notes && !compact ? (
          <View className="mt-2 rounded-lg bg-surface-page dark:bg-surface p-2">
            <Text
              className="text-sm text-content-muted dark:text-secondary-400 font-sans"
              numberOfLines={2}
            >
              {staff.notes}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {showActions && hasVisibleActions ? (
        <View
          testID="card-actions"
          className="mt-3 flex-row gap-2 border-t border-secondary-100 pt-3 dark:border-surface-overlay"
        >
          {showsEditTime ? (
            <Pressable
              onPress={handleEditTime}
              className="flex-1 flex-row items-center justify-center rounded-lg bg-surface-card py-2 active:opacity-70 dark:bg-surface"
            >
              <EditIcon size={14} color={isDarkMode ? '#D4AF37' : '#8A7228'} />
              {/* 라벨이 '시간 수정'이 아닌 이유 — 이 버튼이 여는 시트는 역할·색·메모도 고친다.
                  '시간'이라고 부르면 역할 편집 입구가 사라진 것처럼 보인다. */}
              <Text className="ml-1 text-sm font-sans-medium text-primary-600 dark:text-primary-400">
                근무 수정
              </Text>
            </Pressable>
          ) : null}

          {showsCancelNoShow ? (
            <Pressable
              onPress={handleCancelNoShow}
              className="flex-1 flex-row items-center justify-center rounded-lg bg-surface-card py-2 active:opacity-70 dark:bg-surface"
            >
              <RefreshIcon size={14} color={SECONDARY_PALETTE[500]} />
              <Text className="ml-1 text-sm font-sans-medium text-content-primary dark:text-off-white">
                노쇼 취소
              </Text>
            </Pressable>
          ) : null}

          {showsReport ? (
            <Pressable
              onPress={handleReport}
              className="flex-row items-center justify-center rounded-lg bg-error-50 px-3 py-2 active:opacity-70 dark:bg-error-900/20"
            >
              <ExclamationTriangleIcon size={14} color="#DC2626" />
              <Text className="ml-1 text-sm font-sans-medium text-error-600 dark:text-error-400">
                신고
              </Text>
            </Pressable>
          ) : null}

          {showsDelete ? (
            /* 아이콘 단독 버튼이라 라벨이 없으면 스크린리더가 읽을 것이 없다(룰 27).
               파괴적 액션이므로 대상을 라벨에 넣는다 — "빼기" 만으로는 무엇을 빼는지 알 수 없다.
               testID 는 기존 테스트가 잡고 있으므로 유지한다. */
            <Pressable
              testID="card-delete-action"
              onPress={handleDelete}
              accessibilityRole="button"
              accessibilityLabel={`${staff.staffName || '스태프'} 빼기`}
              className="flex-row items-center justify-center rounded-lg bg-surface-card px-3 py-2 active:opacity-70 dark:bg-surface"
            >
              <TrashIcon size={14} color={SECONDARY_PALETTE[500]} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
});
