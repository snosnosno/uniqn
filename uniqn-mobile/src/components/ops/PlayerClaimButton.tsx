/**
 * ops 1c-4 — 운영자용 참가자 플레이어 링크(QR) 발급/공유.
 * 멱등 발급(useIssueClaimToken) → getOpsPlayerUrl(배포 origin 동적) → 웹=복사 / 네이티브=Share.
 * (QR 이미지 출력은 후속 — 링크/공유로 충분.)
 */
import { Pressable, Text, Platform, Share } from 'react-native';
import { useIssueClaimToken } from '@/hooks/ops';
import { getOpsPlayerUrl } from '@/constants/ops';
import { useToastStore } from '@/stores/toastStore';

interface PlayerClaimButtonProps {
  tournamentId: string;
  participantId: string;
}

export function PlayerClaimButton({ tournamentId, participantId }: PlayerClaimButtonProps) {
  const issueMut = useIssueClaimToken(tournamentId);

  const deliver = async (token: string) => {
    const url = getOpsPlayerUrl(token);
    if (Platform.OS === 'web') {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(url);
          useToastStore.getState().success('플레이어 링크를 복사했습니다');
        } else {
          useToastStore.getState().success(url);
        }
      } catch {
        useToastStore.getState().error('링크 복사에 실패했습니다');
      }
    } else {
      try {
        await Share.share({ message: url });
      } catch {
        // 사용자 취소 등 — 무시
      }
    }
  };

  const onPress = () => {
    if (issueMut.isPending) return;
    issueMut.mutate(participantId, {
      onSuccess: (token) => {
        if (token) void deliver(token);
      },
    });
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={issueMut.isPending}
      accessibilityRole="button"
      accessibilityLabel="플레이어 링크"
      className="min-h-[44px] items-center justify-center rounded-md bg-gray-100 px-2 active:opacity-70 dark:bg-gray-800"
    >
      <Text className="text-xs text-content-primary dark:text-off-white">링크</Text>
    </Pressable>
  );
}

export default PlayerClaimButton;
