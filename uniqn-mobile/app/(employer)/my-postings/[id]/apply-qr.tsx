/**
 * UNIQN Mobile - 공고 지원 QR 화면 (S3-5)
 *
 * @description 구직자가 찍으면 공고 상세가 열리는 QR. 홍보물·매장 게시용이다.
 *
 * @note 🚨 **출퇴근 QR(`qr.tsx`)과 절대 헷갈리면 안 된다.**
 *   같은 공고에 두 QR 이 존재하고 둘 다 "공고 QR"처럼 보인다. 현장에서 스태프가 이 QR 을
 *   찍고 "출근됐겠지" 하고 일을 시작하면, 퇴근할 때 출근 기록이 없다는 걸 알게 된다.
 *   방어는 세 겹이다:
 *     ① 페이로드 `type` 이 다르다(`apply` vs `venue`) — 스캐너가 기계적으로 가른다.
 *     ② 출근 스캐너가 이 QR 을 만나면 "지원용 QR"이라고 **짚어서** 말한다.
 *     ③ 이 화면이 "출근용이 아니다"를 눈에 보이게 못박는다.
 *   회귀 가드: src/services/work/__tests__/eventQRService.applyQR.test.ts
 *
 * @note 저장/공유 버튼을 두지 않는 이유는 qr.tsx 와 같다 — 네이티브 모듈이 OTA 로 안 나간다.
 */

import { useMemo } from 'react';
import { useWindowDimensions, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { StackHeader } from '@/components/headers';
import { ErrorState, Loading } from '@/components';
import { buildApplyQRString } from '@/services/work/eventQRService';
import { QR_MESSAGES } from '@/constants/qr';
import { JobTitleSuffix, useJobDetailContext } from './_layout';
import { loadFailed, notFound } from '@/constants/messages';

/** QR 최대 변 길이 — 큰 화면에서 과하게 커지지 않도록 상한을 둔다. */
const MAX_QR_SIZE = 320;
/** QR 좌우 여백(화면 폭 대비) — 카드 패딩 + 화면 패딩 합계. */
const QR_HORIZONTAL_INSET = 96;

function NotFoundBody({ message }: { message: string }) {
  return (
    <View className="flex-1 items-center justify-center px-4">
      <Text className="text-center text-base text-content-secondary dark:text-secondary-400 font-sans">
        {message}
      </Text>
    </View>
  );
}

export default function JobPostingApplyQRScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { job, isLoading, error, refresh } = useJobDetailContext();
  const { width } = useWindowDimensions();

  const qrValue = useMemo(() => (id ? buildApplyQRString(id) : ''), [id]);
  const qrSize = Math.min(MAX_QR_SIZE, Math.max(200, width - QR_HORIZONTAL_INSET));

  const headerTitleSuffix = <JobTitleSuffix jobTitle={job?.title ?? null} />;

  const body = (() => {
    if (!id) {
      return <NotFoundBody message={notFound('공고')} />;
    }

    if (isLoading) {
      return (
        <View className="flex-1 items-center justify-center px-4">
          <Loading size="large" />
          <Text className="mt-4 text-content-secondary dark:text-secondary-400 font-sans">
            공고를 불러오는 중...
          </Text>
        </View>
      );
    }

    // 조회 실패도 job=null 이라, 이 분기가 없으면 일시적 네트워크 오류가
    // "공고를 찾을 수 없어요"로 나온다 (qr.tsx 와 같은 이유 — 감사 A4).
    if (error && !job) {
      return (
        <ErrorState error={error} title={loadFailed('공고')} onRetry={refresh} alwaysAllowRetry />
      );
    }

    if (!job) {
      return <NotFoundBody message={notFound('공고')} />;
    }

    // 고정 공고도 지원은 받는다 — 출퇴근 QR 과 달리 여기서 막을 이유가 없다.
    return null;
  })();

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader
        title={QR_MESSAGES.applyQRTitle}
        titleSuffix={headerTitleSuffix}
        fallbackHref={`/(employer)/my-postings/${id ?? ''}`}
      />

      {body ?? (
        <View className="flex-1 items-center justify-center px-4">
          {/* QR 배경은 스캔 대비를 위해 다크모드에서도 흰색을 유지한다 (dark:bg-white 의도적) */}
          <View
            className="rounded-lg bg-white p-6 dark:bg-white"
            accessibilityRole="image"
            accessibilityLabel="공고 지원용 QR 코드"
          >
            <QRCode value={qrValue} size={qrSize} backgroundColor="white" color="black" />
          </View>

          <Text className="mt-6 text-center text-base text-content-primary dark:text-secondary-200 font-sans">
            {QR_MESSAGES.applyQRDescription}
          </Text>

          {/* 🚨 출근 QR 오인 방지 — 색과 문구 둘 다로 말한다(색만으로는 전달되지 않는다) */}
          <View className="mt-4 rounded-md bg-warning-100 px-3 py-2 dark:bg-warning-700/30">
            <Text className="text-center text-sm font-sans-medium text-warning-700 dark:text-warning-500">
              {QR_MESSAGES.applyQRNotCheckInNotice}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
