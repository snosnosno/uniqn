/**
 * UNIQN Mobile - 신고 증빙 첨부 훅
 *
 * @description 신고 증빙 이미지의 업로드(신고 생성 전) / 서명 URL 발급(열람)을 담당한다.
 *   Presentation 이 Service 를 직접 부르지 않도록 하는 얇은 경계층.
 * @version 1.0.0
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { uploadReportEvidence, getReportEvidenceSignedUrl } from '@/services/admin/reportService';
import type { LocalReportEvidence } from '@/types/report';

/** 서명 URL 캐시 유효 시간 — 서명 TTL 1시간에서 10분 여유를 뺀 값 */
const EVIDENCE_URL_STALE_TIME_MS = 1000 * 60 * 50;

/**
 * 증빙 서명 URL 쿼리 키
 *
 * `queryKeys`(lib/queryClient) 에는 아직 신고 첨부 축이 없다. 1:1 문의의 `attachmentUrl` 도
 * 같은 이유로 독립 prefix(`['inquiry-attachment-url', path]`)를 쓰므로 동일 규칙을 따른다.
 */
export function reportEvidenceUrlKey(ref: string) {
  return ['report-evidence-url', ref] as const;
}

/**
 * http(s) 절대 URL 인지 판정 — 과거 데이터는 서명이 필요 없는 절대 URL 일 수 있다.
 */
export function isAbsoluteEvidenceUrl(ref: string): boolean {
  return /^https?:\/\//i.test(ref);
}

/**
 * 증빙 업로드 mutation
 *
 * 성공 시 Storage 경로 배열을 반환한다. 호출부는 이 결과를 `CreateReportInput.evidenceUrls` 에
 * 실어 신고를 **1회** 생성한다 — 업로드가 먼저이므로 실패 시 되돌릴 신고 레코드가 없다.
 */
export function useUploadReportEvidence() {
  return useMutation({
    mutationFn: (files: LocalReportEvidence[]) => uploadReportEvidence(files),
  });
}

/**
 * 증빙 1건의 열람 URL 조회
 *
 * Storage 경로면 서명 URL 을 발급하고, 절대 URL 이면 그대로 돌려준다.
 */
export function useReportEvidenceUrl(ref: string | undefined) {
  return useQuery({
    queryKey: reportEvidenceUrlKey(ref ?? ''),
    queryFn: async () => {
      if (!ref) return null;
      if (isAbsoluteEvidenceUrl(ref)) return ref;
      return getReportEvidenceSignedUrl(ref);
    },
    enabled: !!ref,
    staleTime: EVIDENCE_URL_STALE_TIME_MS,
  });
}
