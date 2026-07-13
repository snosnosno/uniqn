/**
 * 구직자 → 구인자 신고 모달 상태 훅
 *
 * @description ReportModal 을 시트(ScheduleDetailModal) 밖 상위 화면(schedule.tsx)에서
 *   소유하기 위한 훅. 시트를 먼저 닫고 신고 모달을 열어야 iOS 중첩 Modal 터치 먹통을 피할 수 있는데,
 *   ReportModal 이 시트의 children 이면 시트가 닫힐 때(schedule=null) 함께 언마운트되어 열 수 없다.
 *   상위로 승격해 QRCodeScanner 형제로 렌더한다.
 */
import { useCallback, useState } from 'react';
import type { ReportTarget } from '@/components/employer/ReportModal';
import { getUserProfile } from '@/services/auth';
import { createReport } from '@/services/admin';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import type { CreateReportInput } from '@/types';

/** 신고 열기 요청 — 호출자(시트)가 닫히기 전에 스냅샷한 대상 정보. */
export interface OwnerReportRequest {
  ownerId: string;
  /** 즉시 표시용 fallback 이름 (프로필 조회 전) */
  ownerName: string;
  jobPostingId: string;
  jobPostingTitle?: string;
}

export interface OwnerReportState {
  visible: boolean;
  target: ReportTarget | null;
  jobPostingId: string;
  jobPostingTitle?: string;
  isLoading: boolean;
  /** 신고 모달 열기 — fallback 이름으로 즉시 표시 후 실이름을 비동기로 보강. */
  open: (request: OwnerReportRequest) => void;
  close: () => void;
  submit: (input: CreateReportInput) => Promise<void>;
}

export function useOwnerReport(): OwnerReportState {
  const { addToast } = useToastStore();
  const [visible, setVisible] = useState(false);
  const [target, setTarget] = useState<ReportTarget | null>(null);
  const [jobPostingId, setJobPostingId] = useState('');
  const [jobPostingTitle, setJobPostingTitle] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  const open = useCallback((request: OwnerReportRequest) => {
    setTarget({ id: request.ownerId, name: request.ownerName });
    setJobPostingId(request.jobPostingId);
    setJobPostingTitle(request.jobPostingTitle);
    setVisible(true);

    // 실제 구인자 이름을 비동기로 보강 (대상이 그대로일 때만 반영).
    void (async () => {
      try {
        const profile = await getUserProfile(request.ownerId);
        const resolvedName = profile?.name || profile?.nickname;
        if (!resolvedName) return;
        setTarget((current) =>
          current?.id === request.ownerId ? { ...current, name: resolvedName } : current
        );
      } catch (error) {
        logger.error('Failed to get employer profile', error as Error);
      }
    })();
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    setTarget(null);
  }, []);

  const submit = useCallback(
    async (input: CreateReportInput) => {
      setIsLoading(true);
      try {
        await createReport(input);
        addToast({ type: 'success', message: '신고가 접수되었습니다.' });
        // 닫힘 상태 리셋은 close() 단일 소스로 — 초기화 필드가 늘 때 한쪽만 갱신되는 것 방지
        close();
      } catch (error) {
        const err = error as Error & { code?: string; message?: string };
        logger.error('Failed to submit report', err, {
          input,
          errorCode: err.code,
          errorMessage: err.message,
        });
        addToast({ type: 'error', message: '신고 접수에 실패했습니다. 다시 시도해주세요.' });
      } finally {
        setIsLoading(false);
      }
    },
    [addToast, close]
  );

  return { visible, target, jobPostingId, jobPostingTitle, isLoading, open, close, submit };
}
