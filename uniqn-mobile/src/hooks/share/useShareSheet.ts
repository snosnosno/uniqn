/**
 * 플랫폼별 공유 시트 어댑터
 *
 * @description 웹(Web Share API → 클립보드 fallback)과 네이티브(Share.share) 분기를 한 곳에 모은다.
 *   단일 공유(useShare)와 묶음 공유(useBulkShare)가 같은 어댑터를 쓰게 해서
 *   "웹에서 클립보드로 떨어지는" 경로가 한쪽에만 구현되는 일을 막는다.
 *
 *   ⚠️ 데스크톱 웹에서는 `navigator.share` 가 있어도 쓰지 않는다. OS 공유 시트(Windows
 *   공유 대화상자 등)에 카카오톡이 대상으로 등록돼 있지 않아 시트를 열어도 보낼 곳이 없고,
 *   사용자가 시트를 닫으면 AbortError 라 클립보드 복사까지 건너뛰어 아무 반응이 없었다.
 *   이 앱의 웹 공유는 사실상 "카톡에 붙여넣기"가 목적이므로 데스크톱은 클립보드가 정답이다.
 */

import { useCallback } from 'react';
import { Platform, Share } from 'react-native';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { useToast } from '@/stores/toastStore';

export type ShareSheetAction = 'shared' | 'dismissed';

export interface ShareSheetOptions {
  /** 공유 시트 제목 (네이티브 title / 웹 navigator.share title) */
  title: string;
  /** 공유 본문 */
  message: string;
  /**
   * 본문과 별도로 전달할 URL. 본문 안에 이미 링크가 있으면 넘기지 말 것 —
   * iOS 에서 url 을 따로 주면 카톡이 본문+링크를 이중 렌더한다.
   */
  url?: string;
  /** 네이티브 공유 다이얼로그 제목 */
  dialogTitle?: string;
}

export interface UseShareSheetReturn {
  openShareSheet: (options: ShareSheetOptions) => Promise<ShareSheetAction>;
}

/**
 * 공유 시트에 카카오톡 같은 메신저가 대상으로 뜨는 환경인가.
 *
 * 데스크톱 브라우저도 Web Share API 를 지원하지만(Chrome 89+ Windows), OS 공유 시트에
 * 카카오톡이 없어서 공유가 성립하지 않는다. 그래서 "지원 여부"가 아니라 "모바일 여부"로
 * 가른다. userAgentData 는 Chromium 계열만 제공하므로 UA 문자열 폴백을 둔다.
 */
function isMobileWebEnvironment(): boolean {
  if (typeof navigator === 'undefined') return false;

  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (typeof uaData?.mobile === 'boolean') return uaData.mobile;

  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent ?? '');
}

export function useShareSheet(): UseShareSheetReturn {
  const toast = useToast();

  /**
   * 클립보드 복사 + 결과 안내. 실패를 삼키지 않는다 —
   * 예전 구현은 복사 실패 시 예외가 호출자까지 올라가 "공고 정보를 불러오지 못했어요" 라는
   * 엉뚱한 토스트로 둔갑했다.
   */
  const copyToClipboard = useCallback(
    async (text: string, isLinkOnly: boolean): Promise<ShareSheetAction> => {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        toast.error('이 브라우저에서는 자동 복사가 안 돼요. 본문을 직접 선택해 복사해주세요.');
        return 'dismissed';
      }

      try {
        await navigator.clipboard.writeText(text);
      } catch (error) {
        logger.warn('공유 본문 클립보드 복사 실패', { error: toError(error) });
        toast.error('복사하지 못했어요. 브라우저 클립보드 권한을 확인하고 다시 시도해주세요.');
        return 'dismissed';
      }

      toast.success(
        isLinkOnly
          ? '링크가 복사되었어요. 카카오톡에 붙여넣어 주세요.'
          : '공유 문구가 복사되었어요. 카카오톡에 붙여넣어 주세요.'
      );
      return 'shared';
    },
    [toast]
  );

  const openShareSheet = useCallback(
    async (options: ShareSheetOptions): Promise<ShareSheetAction> => {
      if (Platform.OS === 'web') {
        const copyText = options.url || options.message;

        if (isMobileWebEnvironment() && typeof navigator !== 'undefined' && navigator.share) {
          try {
            await navigator.share({
              title: options.title,
              text: options.message,
              url: options.url,
            });
            return 'shared';
          } catch (e) {
            // AbortError = 사용자가 공유 시트를 직접 닫음 — 의도된 취소이므로 조용히 끝낸다.
            if (e instanceof Error && e.name === 'AbortError') {
              return 'dismissed';
            }
            // 그 외 에러는 클립보드 fallback
          }
        }

        return copyToClipboard(copyText, Boolean(options.url));
      }

      const result = await Share.share(
        {
          title: options.title,
          message: options.message,
          ...(Platform.OS === 'ios' && options.url ? { url: options.url } : {}),
        },
        { dialogTitle: options.dialogTitle ?? options.title }
      );
      return result.action === Share.sharedAction ? 'shared' : 'dismissed';
    },
    [copyToClipboard]
  );

  return { openShareSheet };
}
