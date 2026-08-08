/**
 * ops 결함 ⑦-2 — 스태프 1인 근태 기록/되돌리기 시트.
 *
 * 설계 정본: `docs/planning/2026-08-08-ops-attendance-writeback-design.md` §7.
 *
 * 이 컴포넌트의 존재 이유는 **버튼을 언제 열지 결정하는 것**이다. 해석기
 * `ops_resolve_staff_work_logs` 가 사유 코드로 fail-closed 판정을 내려 주고, 화면은 그
 * 판정을 그대로 존중한다:
 *   · `ok && writeAllowed` 일 때만 기록 컨트롤을 연다. `ambiguous`(같은 날 2건)·`cancelled`
 *     (취소된 행)에서 버튼을 열면 **틀린 행에 시각이 박히고**, 되돌려도 스태프에게 나간
 *     푸시는 회수되지 않는다.
 *   · `settled` 는 행을 표시하되 컨트롤만 잠근다 — work_log_id 는 정상 반환되므로 시각은 보인다.
 *   · 되돌리기를 같은 화면에 함께 낸다(§결정 7). 밀어 넣는 액션만 있으면 오조작이 곧 확정이다.
 *
 * 🚨 **일괄 버튼을 만들지 말 것**(§결정 5). `work_logs` AFTER UPDATE 에 notify 트리거가
 *    **3개** 걸려 있어 20명 일괄 처리는 최대 60회 발화다. 1행 = 1알림은 올바른 동작이고,
 *    일괄이 필요해지면 알림 배칭 설계가 **선행**돼야 한다.
 *
 * 🔑 `writeAllowed` 는 화면 힌트일 뿐 권한의 근거가 아니다. 실제 가드는
 *    `update_work_log_slot` 이 자기 술어로 재검증하고, 거부 문구(`ALREADY_SETTLED`·
 *    `PERMISSION_DENIED`)는 훅의 토스트가 **서버 문구 그대로** 표면화한다 — 클라에서 같은
 *    뜻의 문구를 새로 쓰면 서버와 조용히 갈라진다.
 */
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { SheetModal } from '@/components/ui/SheetModal';
import { confirmAction } from '@/utils/confirmAction';
import { useRecordOpsAttendance } from '@/hooks/ops';
import type { OpsStaffWorkLogLink, OpsStaffWorkLogReason } from '@/types/ops';

export interface StaffAttendanceSheetProps {
  visible: boolean;
  tournamentId: string;
  staffName: string;
  /** 해석기 결과. 아직 로딩 중이거나 해석 행이 없으면 null. */
  link: OpsStaffWorkLogLink | null;
  onClose: () => void;
}

/**
 * 사유별 안내 문구. `ok` 는 안내가 아니라 컨트롤을 띄우므로 여기 없다.
 *
 * exhaustive Record 로 두는 이유: `OpsStaffWorkLogReason` 에 값이 추가되면 **여기서 타입
 * 에러가 난다**. 기본 문구로 조용히 흘려보내면 새 사유가 안내 없이 빈 화면으로 나간다.
 */
const REASON_NOTICE: Record<Exclude<OpsStaffWorkLogReason, 'ok'>, string> = {
  no_posting:
    '대회에 공고가 연결되어 있지 않아 근태를 기록할 수 없습니다. STAFF 탭 상단에서 공고를 먼저 연결해 주세요.',
  no_event_date:
    '대회 운영일이 지정되어 있지 않아 기록할 행을 특정할 수 없습니다. 대회 정보에서 운영일을 먼저 지정해 주세요.',
  not_linked:
    '이 스태프에게는 해당 날짜의 근무 기록이 없습니다. 수동으로 추가한 스태프는 공고 근무 기록과 연결되지 않습니다.',
  cancelled: '해당 날짜의 근무 기록이 취소되었거나 노쇼 처리되어 근태를 기록할 수 없습니다.',
  ambiguous:
    '같은 날짜에 근무 기록이 2건 이상이라 어느 기록에 남길지 자동으로 정할 수 없습니다. 근무 일정 화면에서 직접 기록해 주세요.',
  settled: '정산이 완료된 근무 기록이라 근태를 수정할 수 없습니다.',
};

/** 권한 축이 달라 막힌 경우. 사유 코드가 아니라 `writeAllowed=false` 로 온다. */
const NO_PERMISSION_NOTICE =
  '이 공고의 근무 기록을 수정할 권한이 없습니다. 대회 운영 권한과 공고 정산 권한은 별개입니다.';

function formatTs(ts: string | null): string {
  if (!ts) return '기록 없음';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '기록 없음';
  return format(d, 'M월 d일 HH:mm', { locale: ko });
}

function ActionButton({
  label,
  onPress,
  destructive = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={`flex-1 items-center rounded-md py-2.5 active:opacity-70 ${
        disabled
          ? 'bg-gray-100 dark:bg-gray-800'
          : destructive
            ? 'bg-gray-100 dark:bg-gray-800'
            : 'bg-primary-600'
      }`}
    >
      <Text
        className={`font-sans-semibold text-sm ${
          disabled
            ? 'text-secondary-400'
            : destructive
              ? 'text-error-600 dark:text-error-400'
              : 'text-white'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TimeRow({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className="text-sm text-secondary-500 dark:text-secondary-400">{label}</Text>
      <Text testID={testID} className="font-sans-medium text-content-primary dark:text-off-white">
        {value}
      </Text>
    </View>
  );
}

export function StaffAttendanceSheet({
  visible,
  tournamentId,
  staffName,
  link,
  onClose,
}: StaffAttendanceSheetProps) {
  const recordMut = useRecordOpsAttendance(tournamentId);
  const isPending = recordMut.isPending;

  // 기록도 확인을 받는다. 되돌리기가 같은 화면에 있어도 **푸시는 되돌려지지 않는다** —
  // 기록 즉시 스태프에게 알림이 나가고, 취소해도 이미 받은 알림은 회수되지 않는다.
  const confirmRecord = useCallback(
    (axis: 'checkIn' | 'checkOut', next: Date | null) => {
      if (!link?.workLogId || isPending) return;
      const axisLabel = axis === 'checkIn' ? '출근' : '퇴근';
      const clearing = next === null;
      confirmAction({
        title: clearing ? `${axisLabel} 기록 취소` : `${axisLabel} 기록`,
        message: clearing
          ? `${staffName} 님의 ${axisLabel} 기록을 지울까요?`
          : `${staffName} 님의 ${axisLabel}을 ${format(next, 'M월 d일 HH:mm', { locale: ko })} 로 기록할까요?\n스태프에게 알림이 발송됩니다.`,
        confirmText: clearing ? '기록 취소' : '기록',
        destructive: clearing,
        onConfirm: () =>
          // 3상 계약(키 없음=미변경 / null=삭제 / 값=기록) — 건드리지 않는 축의 키는
          // 아예 싣지 않는다. 실으면 의도 없이 덮어쓴다.
          recordMut.mutate({ workLogId: link.workLogId as string, [axis]: next }),
      });
    },
    [link?.workLogId, isPending, staffName, recordMut]
  );

  const notice =
    link === null
      ? '근태 정보를 불러오는 중입니다.'
      : link.reason !== 'ok'
        ? REASON_NOTICE[link.reason]
        : !link.writeAllowed
          ? NO_PERMISSION_NOTICE
          : null;

  // 컨트롤은 ok + writeAllowed + 해석된 행이 있을 때만. settled 는 위 notice 분기에서
  // 걸러지므로 여기 도달하지 않는다(시각은 아래 TimeRow 로 계속 보인다).
  const canWrite = !!link && link.reason === 'ok' && link.writeAllowed && !!link.workLogId;

  return (
    <SheetModal visible={visible} onClose={onClose} title={`${staffName} 근태`}>
      <View className="px-4 pb-4">
        {link && (
          <View className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
            <TimeRow label="출근" value={formatTs(link.checkInTs)} testID="attendance-check-in" />
            <TimeRow label="퇴근" value={formatTs(link.checkOutTs)} testID="attendance-check-out" />
          </View>
        )}

        {notice && (
          <Text
            testID="attendance-reason-notice"
            className="mt-3 text-sm leading-5 text-secondary-500 dark:text-secondary-400"
          >
            {notice}
          </Text>
        )}

        {canWrite && link && (
          <View className="mt-3 gap-2">
            <View className="flex-row gap-2">
              {link.checkInTs ? (
                <ActionButton
                  label="출근 취소"
                  destructive
                  disabled={isPending}
                  onPress={() => confirmRecord('checkIn', null)}
                />
              ) : (
                <ActionButton
                  label="출근 기록"
                  disabled={isPending}
                  onPress={() => confirmRecord('checkIn', new Date())}
                />
              )}
              {link.checkOutTs ? (
                <ActionButton
                  label="퇴근 취소"
                  destructive
                  disabled={isPending}
                  onPress={() => confirmRecord('checkOut', null)}
                />
              ) : (
                <ActionButton
                  label="퇴근 기록"
                  disabled={isPending}
                  onPress={() => confirmRecord('checkOut', new Date())}
                />
              )}
            </View>
            <Text className="text-xs text-secondary-500 dark:text-secondary-400">
              기록하면 스태프에게 알림이 발송됩니다. 잘못 기록했다면 같은 화면에서 취소할 수 있어요.
            </Text>
          </View>
        )}
      </View>
    </SheetModal>
  );
}

export default StaffAttendanceSheet;
