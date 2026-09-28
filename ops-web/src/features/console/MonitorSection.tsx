/**
 * 전광판 — 모바일 MonitorLinkButton + MonitorConfigCard(현황 탭).
 * 링크: 멱등 발급 후 복사 · 새 창 열기(같은 PC 로 TV 를 띄울 때) · 강제 재발급(유출 대응, 확인창).
 * TV 구성: 프리셋 3종 + 슬롯 5개. 고르는 건 로컬 초안이고 [저장]을 눌러야 바뀐다(진행 중에도 4초 안에 반영).
 */
import { useMemo, useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from 'cn';
import { ConfirmDialog } from '@/components/ops/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { MONITOR_MODULES } from '@/core/components/ops/monitor/registry';
import {
  MONITOR_MODULE_IDS,
  MONITOR_PRESETS,
  parseMonitorConfig,
  type MonitorModuleId,
  type MonitorPreset,
  type MonitorSlots,
} from '@/core/domains/ops';
import type { OpsTournament } from '@/core/types/ops';
import { useRotateMonitorToken, useSetMonitorConfig } from '@/hooks/ops/useMonitorMutations';

const PRESET_LABEL: Record<MonitorPreset, string> = {
  full: '풀 · 정보 좌 · 상금 우',
  mirror: '미러 · 상금 좌 · 정보 우',
  classic: '클래식 · 가운데 + 하단 줄',
};

/** 전광판은 이 웹(ops-web)이 직접 서빙한다 — 링크는 지금 origin 기준. */
const monitorUrl = (token: string) => `${window.location.origin}/monitor/${token}`;

export function MonitorSection({ tournament }: { tournament: OpsTournament }) {
  const rotate = useRotateMonitorToken(tournament.id);
  const [confirmRotate, setConfirmRotate] = useState(false);

  const token = tournament.monitorToken ?? null;
  const copy = (t: string) =>
    void navigator.clipboard
      .writeText(monitorUrl(t))
      .then(() => toast.success('전광판 링크를 복사했습니다'))
      .catch(() => toast.error('링크 복사에 실패했습니다'));
  // 발급은 서버 왕복 뒤라 그 자리에서 복사·새 창을 부르면 Safari 가 사용자 동작이 아니라며 막는다
  // (리뷰 W7). 발급 결과는 토스트의 [복사] 버튼으로 한 번 더 누르게 한다.
  const issue = (force: boolean) => {
    if (rotate.isPending) return;
    rotate.mutate(force, {
      onSuccess: (t) =>
        t &&
        toast.success(force ? '새 전광판 링크를 만들었어요' : '전광판 링크를 만들었어요', {
          action: { label: '복사', onClick: () => copy(t) },
        }),
    });
  };

  return (
    <section aria-label="전광판" className="flex flex-col gap-3 border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <p className="font-semibold">전광판</p>
          <p className="text-sm text-muted-foreground">
            공개 링크로 큰 화면에 클럭·블라인드·상금을 띄웁니다.
          </p>
        </div>
        {token ? (
          <>
            <Button variant="outline" className="h-11" onClick={() => copy(token)}>
              <Copy /> 링크 복사
            </Button>
            <Button
              variant="outline"
              className="h-11"
              onClick={() => window.open(monitorUrl(token), '_blank', 'noopener')}
            >
              <ExternalLink /> 새 창
            </Button>
            <Button
              variant="ghost"
              className="h-11 text-destructive"
              disabled={rotate.isPending}
              onClick={() => setConfirmRotate(true)}
            >
              재발급
            </Button>
          </>
        ) : (
          <Button size="lg" disabled={rotate.isPending} onClick={() => issue(false)}>
            {rotate.isPending ? '발급 중…' : '링크 발급'}
          </Button>
        )}
      </div>
      {/* 다른 기기에서 저장하면(realtime) 초안을 서버 값으로 다시 맞춘다 — 저장값이 바뀌면 새로 마운트 */}
      <MonitorConfigEditor
        key={JSON.stringify(tournament.monitorConfig ?? null)}
        tournament={tournament}
      />
      <ConfirmDialog
        open={confirmRotate}
        onOpenChange={setConfirmRotate}
        title="전광판 링크 재발급"
        confirmLabel="재발급"
        onConfirm={() => issue(true)}
      >
        지금 링크를 띄운 화면은 더 이상 갱신되지 않아요. 링크가 새어 나갔을 때만 재발급하세요. 새
        링크는 [복사]로 바로 가져갈 수 있어요.
      </ConfirmDialog>
    </section>
  );
}

function MonitorConfigEditor({ tournament }: { tournament: OpsTournament }) {
  const save = useSetMonitorConfig(tournament.id);
  const saved = useMemo(
    () => parseMonitorConfig(tournament.monitorConfig),
    [tournament.monitorConfig]
  );
  const [preset, setPreset] = useState<MonitorPreset>(saved.preset);
  const [slots, setSlots] = useState<MonitorSlots>(saved.slots);
  const dirty = preset !== saved.preset || slots.some((s, i) => s !== saved.slots[i]);

  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <p className="label">TV 구성</p>
      <div role="radiogroup" aria-label="레이아웃 프리셋" className="grid gap-1 sm:grid-cols-3">
        {MONITOR_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={preset === p}
            onClick={() => setPreset(p)}
            className={cn(
              'h-11 border px-3 text-left text-sm',
              preset === p ? 'border-primary font-semibold' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {PRESET_LABEL[p]}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        {slots.map((slot, i) => (
          <label key={i} className="flex flex-col gap-1">
            <span className="label">슬롯 {i + 1}</span>
            <select
              value={slot ?? ''}
              onChange={(e) =>
                setSlots(
                  slots.map((s, j) =>
                    j === i ? ((e.target.value || null) as MonitorModuleId | null) : s
                  )
                )
              }
              className="h-11 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
            >
              <option value="">비움</option>
              {MONITOR_MODULE_IDS.map((id) => (
                <option key={id} value={id} disabled={slots.includes(id) && slot !== id}>
                  {MONITOR_MODULES[id].pickerLabel}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="lg"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate({ v: 1, preset, slots })}
        >
          {save.isPending ? '저장 중…' : '저장'}
        </Button>
        <Button
          variant="ghost"
          className="h-11"
          disabled={save.isPending}
          onClick={() => save.mutate(null)}
        >
          기본값으로
        </Button>
      </div>
    </div>
  );
}
