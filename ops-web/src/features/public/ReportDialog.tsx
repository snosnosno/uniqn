/**
 * 공개뷰 익명 신고 — 모바일 PublicReportSheet(S1 B2): 최하단 캡션 링크 → 사유 3종 + 선택 상세.
 * 재신고는 서버 rate limit(대회당 시간당 5건) + 접수됨 상태로 억제. 로그인 불필요.
 */
import { useState } from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { isAppError } from '@/core/errors/AppError';
import * as opsReportService from '@/core/services/ops/opsReportService';
import { OPS_REPORT_REASON_LABELS, type OpsReportReason } from '@/core/types/ops';
import { logger } from '@/lib/logger';

const REASONS: OpsReportReason[] = ['gambling', 'illegal_gambling', 'other'];
const DETAILS_MAX = 500;

export function ReportLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="이 대회 신고하기"
      className="mx-auto block min-h-11 px-4 text-xs text-muted-foreground underline-offset-4 hover:underline"
    >
      이 대회 신고하기
    </button>
  );
}

export function ReportDialog({
  open,
  onOpenChange,
  tokenKind,
  token,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenKind: 'monitor' | 'player';
  token: string;
}) {
  const [reason, setReason] = useState<OpsReportReason>('gambling');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const trimmed = details.trim();
      await opsReportService.submitReport({
        tokenKind,
        token,
        reason,
        details: trimmed ? trimmed.slice(0, DETAILS_MAX) : null,
      });
      setDone(true);
    } catch (e) {
      logger.warn('공개뷰 신고 실패', { tokenKind });
      setError(
        isAppError(e) ? e.userMessage : '신고 접수에 실패했어요. 잠시 후 다시 시도해주세요.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{done ? '신고가 접수됐어요' : '이 대회 신고하기'}</DialogTitle>
          <DialogDescription>
            {done
              ? '운영팀이 확인 후 필요한 조치를 취할게요.'
              : '익명으로 접수돼요. 필요할 때만 상세 내용을 남겨주세요.'}
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <DialogFooter>
            <Button size="lg" onClick={() => onOpenChange(false)}>
              닫기
            </Button>
          </DialogFooter>
        ) : (
          <>
            <div role="radiogroup" aria-label="신고 사유" className="flex flex-col gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={reason === r}
                  onClick={() => setReason(r)}
                  className={cn(
                    'flex h-11 items-center border px-3 text-left text-sm',
                    reason === r ? 'border-primary font-semibold' : 'text-muted-foreground'
                  )}
                >
                  {OPS_REPORT_REASON_LABELS[r]}
                </button>
              ))}
            </div>
            <textarea
              aria-label="상세 내용(선택)"
              placeholder="상세 내용(선택)"
              maxLength={DETAILS_MAX}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="min-h-24 rounded-lg border border-input bg-transparent p-3 text-sm dark:bg-input/30"
            />
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button size="lg" disabled={submitting} onClick={() => void submit()}>
                {submitting ? '접수 중…' : '신고'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
