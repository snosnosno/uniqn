import { useEffect, useRef } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { trackShareFunnel } from '@/services/observability';
import { readShareSource } from '@/constants/shareSource';

/**
 * 공유 링크로 들어온 열람을 기록한다 (S3-5).
 *
 * 🔑 **이게 없으면 `?src=` 는 기능이 아니다.** URL 에 파라미터만 붙이고 아무도 읽지 않으면
 *    "어느 경로의 공유가 실제로 사람을 데려오는가"에 답할 수 없다.
 *    `job_share_created`(공유 발생)의 짝이며, 둘의 비(比)가 전환율이다.
 *
 * ⚠️ **범위**: 공유되는 링크는 웹 URL(`https://uniqn.app/jobs/{id}?src=...`)이다.
 *    웹에서도, 앱 설치 기기의 유니버설 링크에서도 expo-router 가 이 화면을 열며
 *    쿼리를 `useLocalSearchParams` 로 넘겨 주므로 두 경로 모두 여기서 잡힌다.
 *    다만 `uniqn://` 스킴으로 직접 들어오는 경로는 `navigateToDeepLink` 가
 *    `parsed.queryParams` 를 네비게이션에 싣지 않아 출처가 소실된다 — 그 경로는
 *    공유 링크가 아니라 푸시 알림용이라 현재 범위 밖이고, 원장에 잔여로 남긴다.
 *
 * 🔒 출처는 URL 에 노출돼 있어 **누구나 바꿔 넣을 수 있다.** `readShareSource` 화이트리스트를
 *    통과한 값만 기록한다 — 아니면 조작된 값이 그대로 집계에 쌓인다.
 *
 * 🚨 **이 훅이 발화해도 서버에 남지 않을 수 있다.** 이 화면의 주 방문자는 앱이 없는 구직자,
 *    즉 anon 이고 anon INSERT 에는 두 층의 관문이 있다:
 *      ① RLS `ae_anon_insert` 의 event 허용 목록 (20260813160000 이 공유 2종을 넣었다)
 *      ② 가드 트리거의 `props.tk` 필수 (`trackShareFunnel` 이 공고 id 앞 8자를 싣는다)
 *    둘 중 하나라도 어긋나면 `AnalyticsEventRepository` 가 에러를 삼켜 **무음으로 사라진다**
 *    — 프로덕션에선 로그도 안 남는다. 실제로 그 상태로 한 번 적발됐다(2026-08-14 리뷰).
 *    공유 이벤트를 새로 추가할 때는 event CHECK 화이트리스트·RLS 정책·tk 를 **함께** 움직일 것.
 */
export function useTrackShareOpen(jobId: string | undefined): void {
  const params = useLocalSearchParams<{ src?: string | string[] }>();
  const source = readShareSource(params.src);

  // 같은 (공고, 출처) 조합은 한 마운트에서 한 번만 — 리렌더마다 쏘면 열람 수가 부풀려진다.
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!jobId || !source) {
      return;
    }
    const key = `${jobId}:${source}`;
    if (firedRef.current === key) {
      return;
    }
    firedRef.current = key;
    trackShareFunnel('job_share_opened', { job_id: jobId, src: source });
  }, [jobId, source]);
}
