/**
 * 플랫폼별 공유 시트 어댑터
 *
 * @description 웹(Web Share API → 클립보드 fallback)과 네이티브(Share.share) 분기를 한 곳에 모은다.
 *   단일 공유(useShare)와 묶음 공유(useBulkShare)가 같은 어댑터를 쓰게 해서
 *   "웹에서 클립보드로 떨어지는" 경로가 한쪽에만 구현되는 일을 막는다.
 */

import { useCallback } from 'react';
import { Platform, Share } from 'react-native';
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

export function useShareSheet(): UseShareSheetReturn {
  const toast = useToast();

  const openShareSheet = useCallback(
    async (options: ShareSheetOptions): Promise<ShareSheetAction> => {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.share) {
          try {
            await navigator.share({
              title: options.title,
              text: options.message,
              url: options.url,
            });
            return 'shared';
          } catch (e) {
            // AbortError = 사용자가 공유 시트 닫음
            if (e instanceof Error && e.name === 'AbortError') {
              return 'dismissed';
            }
            // 그 외 에러는 클립보드 fallback
          }
        }

        const copyText = options.url || options.message;
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(copyText);
        }
        toast.success('링크가 복사되었습니다');
        return 'shared';
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
    [toast]
  );

  return { openShareSheet };
}
