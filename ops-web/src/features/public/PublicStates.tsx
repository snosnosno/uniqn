import type { ReactNode } from 'react';
import type { GateState } from './publicGate';

/** 가운데 안내(무효 링크·연결 실패·로딩) — 두 공개뷰 공용. */
export function CenterNotice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-8 text-center">
      <h1 className="text-xl font-bold">{title}</h1>
      {children ? <p className="text-sm text-muted-foreground">{children}</p> : null}
    </main>
  );
}

/**
 * 공개뷰 첫 상태 안내 — 모바일과 같은 순서:
 * 토큰 무효(영구, 새 링크 필요) → 한 번도 못 받았는데 연결 실패(자동 복귀) → 로딩.
 * 보여줄 게 없으면(gateOf === null) 부르지 않는다.
 */
export function GateNotice({ kind, gate }: { kind: 'monitor' | 'player'; gate: GateState }) {
  if (gate === 'invalid') {
    return kind === 'monitor' ? (
      <CenterNotice title="유효하지 않은 모니터 링크입니다">
        운영자에게 새 링크를 요청하거나 QR을 다시 스캔해주세요.
      </CenterNotice>
    ) : (
      <CenterNotice title="유효하지 않은 플레이어 링크입니다">
        운영자에게 새 QR 또는 링크를 요청해주세요.
      </CenterNotice>
    );
  }
  if (gate === 'offline') {
    return (
      <CenterNotice title="서버에 연결할 수 없습니다">
        네트워크를 확인해주세요. 연결되면 자동으로 다시 표시됩니다.
      </CenterNotice>
    );
  }
  return (
    <main role="status" className="flex min-h-dvh items-center justify-center">
      <p className="text-muted-foreground">불러오는 중…</p>
    </main>
  );
}

/** 스냅샷은 있는데 갱신이 막힘 — 화면은 유지하고 신선도만 알린다(무인 전광판). */
export function ReconnectingBadge() {
  return (
    <span role="status" className="border border-warning px-2 py-1 text-xs text-warning">
      연결이 불안정합니다 · 자동으로 다시 시도 중
    </span>
  );
}
