/** 플레이어뷰 변화 배너와 알림음 켜기 — 상태는 `usePlayerAlerts`, 판정은 `playerAlerts`(순수). */
import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fmt } from '@/features/console/format';
import { setChimeEnabled, useChimeEnabled } from '@/lib/chime';
import { notifyPlayer, type LevelAlert, type SeatAlert } from './usePlayerAlerts';

export function PlayerAlertBanners({
  seat,
  level,
  onDismissSeat,
}: {
  seat: SeatAlert | null;
  level: LevelAlert | null;
  onDismissSeat: () => void;
}) {
  // 알림 영역은 비어 있어도 항상 둔다 — 내용과 함께 새로 붙는 live region 은 스크린리더가 읽지 않는 경우가 많다.
  return (
    <div
      aria-live="polite"
      className={seat || level ? 'flex flex-col gap-2 px-[18px] pt-3' : undefined}
    >
      {seat ? (
        <div
          role="alert"
          className="flex items-center gap-3 border border-l-4 border-l-warning bg-card px-3 py-2"
        >
          <p className="flex-1">
            <span className="label block text-warning">
              {seat.moved ? '자리가 바뀌었어요' : '자리가 배정됐어요'}
            </span>
            <b className="num text-xl">
              T{seat.tableNo} · {seat.seatNo}번
            </b>
          </p>
          <Button variant="outline" className="h-11" onClick={onDismissSeat}>
            확인
          </Button>
        </div>
      ) : null}
      {level ? (
        <p className="border border-l-4 border-l-primary bg-card px-3 py-2">
          <span className="label block">{level.kind === 'break' ? '휴식' : '레벨 변경'}</span>
          <b className="num">
            {level.kind === 'break'
              ? '휴식 시간이 시작됐어요'
              : `LEVEL ${level.level} · ${fmt(level.smallBlind)} / ${fmt(level.bigBlind)}${
                  level.ante > 0 ? ` (${fmt(level.ante)})` : ''
                }`}
          </b>
        </p>
      ) : null}
    </div>
  );
}

/** 소리·진동 켜기 — 이 기기에만 저장된다. 켜는 순간 한 번 울려 스피커 상태를 확인시킨다. */
export function PlayerAlertToggle() {
  const enabled = useChimeEnabled('player');
  return (
    <div className="flex items-center gap-3 px-[18px] py-3">
      <p className="flex-1 text-sm">
        자리·레벨 알림음
        <span className="block text-xs text-muted-foreground">
          자리가 바뀌거나 레벨이 넘어가면 소리와 진동으로 알려요. 화면은 켜 두어야 해요.
        </span>
      </p>
      <Button
        variant={enabled ? 'default' : 'outline'}
        className="h-11"
        aria-pressed={enabled}
        onClick={() => {
          setChimeEnabled(!enabled, 'player');
          if (!enabled) notifyPlayer();
        }}
      >
        {enabled ? <Bell /> : <BellOff />}
        {enabled ? '켜짐' : '꺼짐'}
      </Button>
    </div>
  );
}
