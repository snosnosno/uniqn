/** 화면 전체 로딩 — 스크린리더가 읽도록 role=status. */
export function FullScreenLoading({ label = '불러오는 중…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
      <span className="label">{label}</span>
    </div>
  );
}
