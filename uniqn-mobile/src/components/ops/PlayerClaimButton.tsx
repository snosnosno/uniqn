/**
 * ops 운영자용 참가자 자격 발급/링크 재공유 (claim 토큰 분리·D8).
 * - viewToken 있으면 "링크 공유"(비파괴, 발급 미호출) + "PIN 재발급"(로테이트, 확인).
 * - viewToken 없으면 "발급"(view_token+PIN 생성). 발급 결과 PIN은 Alert로 1회 표시(슬립용).
 */
import { Pressable, Text, Platform, Share, Alert } from 'react-native';
import { useIssuePlayerCredentials } from '@/hooks/ops';
import { getOpsPlayerUrl } from '@/constants/ops';
import { useToastStore } from '@/stores/toastStore';
import type { OpsPlayerCredentials } from '@/types/ops';

interface PlayerClaimButtonProps {
  tournamentId: string;
  participantId: string;
  viewToken: string | null;
}

async function shareUrl(url: string) {
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
      /* 사용자 취소 무시 */
    }
  }
}

export function PlayerClaimButton({
  tournamentId,
  participantId,
  viewToken,
}: PlayerClaimButtonProps) {
  const issueMut = useIssuePlayerCredentials(tournamentId);

  const onIssued = (cred: OpsPlayerCredentials) => {
    const url = getOpsPlayerUrl(cred.viewToken);
    // 평문 PIN은 1회만 노출 — 슬립에 인쇄/전달.
    Alert.alert(
      '연결 PIN 발급됨',
      `연결 PIN: ${cred.claimPin}\n\n슬립/QR에 PIN을 함께 적어주세요. 재발급하면 이 PIN은 무효가 됩니다.`,
      [
        { text: '링크 공유', onPress: () => void shareUrl(url) },
        { text: '닫기', style: 'cancel' },
      ]
    );
  };

  const issue = () => {
    if (issueMut.isPending) return;
    issueMut.mutate(participantId, { onSuccess: onIssued });
  };

  const onPressIssue = () => {
    if (!viewToken) return issue(); // 최초 발급
    Alert.alert('PIN 재발급', '재발급하면 이전 PIN은 사용할 수 없어요. 진행할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '재발급', style: 'destructive', onPress: issue },
    ]);
  };

  return (
    <>
      {viewToken ? (
        <Pressable
          onPress={() => void shareUrl(getOpsPlayerUrl(viewToken))}
          accessibilityRole="button"
          accessibilityLabel="플레이어 링크 공유"
          className="min-h-[44px] items-center justify-center rounded-md bg-gray-100 px-2 active:opacity-70 dark:bg-gray-800"
        >
          <Text className="text-xs text-content-primary dark:text-off-white">링크</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={onPressIssue}
        disabled={issueMut.isPending}
        accessibilityRole="button"
        accessibilityLabel={viewToken ? 'PIN 재발급' : 'PIN 발급'}
        className="min-h-[44px] items-center justify-center rounded-md bg-gray-100 px-2 active:opacity-70 dark:bg-gray-800"
      >
        <Text className="text-xs text-content-primary dark:text-off-white">
          {viewToken ? 'PIN 재발급' : 'PIN 발급'}
        </Text>
      </Pressable>
    </>
  );
}

export default PlayerClaimButton;
