/**
 * ops 1c — HISTORY 탭(감사 로그 = 이벤트 척추).
 * useOpsEvents(ops_events created_at desc) 를 FlashList 로 표시한다.
 * 각 행: 이벤트 타입 한글 라벨 · 상대 시각 · payload 요약. 필터는 Phase 1 생략.
 */
import { View, Text } from 'react-native';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { formatRelative } from '@/utils/formatters/date';
import { useOpsEvents } from '@/hooks/ops';
import type { OpsEvent, OpsEventType } from '@/types/ops';

const EVENT_LABEL: Record<OpsEventType, string> = {
  tournament_created: '대회 생성',
  tournament_status_changed: '대회 상태 변경',
  registration_toggled: '등록 전환',
  player_registered: '참가자 등록',
  player_checked_in: '체크인',
  player_rebuy: '리바이',
  player_addon: '애드온',
  player_busted: '탈락',
  player_reentered: '재진입',
  player_moved: '좌석 이동',
  seat_freed: '좌석 비움',
  table_added: '테이블 추가',
  table_closed: '테이블 상태 변경',
  table_redraw: '리드로우',
  prize_assigned: '상금 배정',
  level_play: '레벨 시작',
  level_pause: '일시정지',
  level_set: '레벨 변경',
};

/** payload 의 원시값(string/number/boolean) 만 골라 간결 요약. */
function summarizePayload(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      parts.push(`${key.replace(/_/g, ' ')} ${value}`);
    }
    if (parts.length >= 3) break;
  }
  return parts.join(' · ');
}

interface HistoryTabProps {
  tournamentId: string;
}

export function HistoryTab({ tournamentId }: HistoryTabProps) {
  const { events, isLoading } = useOpsEvents(tournamentId);

  return (
    <AppFlashList
      data={events}
      keyExtractor={(e: OpsEvent) => e.id}
      estimatedItemSize={64}
      contentContainerStyle={{ padding: 16, paddingTop: 8 }}
      renderItem={({ item }: { item: OpsEvent }) => {
        const summary = summarizePayload(item.payload);
        return (
          <View className="mb-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
            <View className="flex-row items-center justify-between">
              <Text className="font-sans-semibold text-content-primary dark:text-off-white">
                {EVENT_LABEL[item.type] ?? item.type}
              </Text>
              <Text className="text-xs text-secondary-500 dark:text-secondary-400">
                {formatRelative(item.createdAt)}
              </Text>
            </View>
            {summary ? (
              <Text
                numberOfLines={1}
                className="mt-1 text-xs text-secondary-500 dark:text-secondary-400"
              >
                {summary}
              </Text>
            ) : null}
          </View>
        );
      }}
      ListEmptyComponent={
        <View className="items-center gap-2 px-6 py-12">
          <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
            아직 기록이 없어요
          </Text>
          <Text className="text-center text-sm text-secondary-500 dark:text-secondary-400">
            {isLoading
              ? '불러오는 중…'
              : '등록·클럭·좌석 등 모든 운영 동작이 이곳에 시간순으로 남습니다.'}
          </Text>
        </View>
      }
    />
  );
}

export default HistoryTab;
