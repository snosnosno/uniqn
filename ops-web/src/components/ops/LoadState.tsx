import { Button } from '@/components/ui/button';
import { toUserMessage } from '@/lib/errorMessage';

/**
 * 조회 실패 — "없음"과 반드시 가른다. 실패를 빈 상태로 보이면 운영자가 빈 줄 알고
 * 새로 만들어 저장해 기존 데이터를 통째로 덮어쓴다(전체 교체 RPC — 리뷰 W5·W6).
 */
export function LoadError({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 p-6 text-center">
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{toUserMessage(error)}</p>
      <Button variant="outline" className="h-11" onClick={onRetry}>
        다시 시도
      </Button>
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <p role="status" className="p-6 text-center text-sm text-muted-foreground">
      {label}
    </p>
  );
}
