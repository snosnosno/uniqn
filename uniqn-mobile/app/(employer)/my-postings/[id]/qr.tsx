/**
 * UNIQN Mobile - 공고 고정 QR 화면
 *
 * @description 공고당 1장인 고정 출퇴근 QR. 공고 ID 만으로 만들어지므로 서버 왕복·만료·갱신이 없다.
 *   화면으로 보여주거나 스크린샷으로 저장해 현장에 비치하면 스태프가 스캔해 출/퇴근한다.
 *
 * @note 저장/공유 버튼을 두지 않는다 — expo-media-library·react-native-view-shot 은
 *   네이티브 모듈이라 OTA 로 배포되지 않는다(새 EAS 빌드 필요). 스크린샷으로 충분하다.
 */

import { useMemo } from 'react';
import { useWindowDimensions, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { StackHeader } from '@/components/headers';
import { ErrorState, Loading } from '@/components';
import { buildVenueQRString } from '@/services/work/eventQRService';
import { JobTitleSuffix, useJobDetailContext } from './_layout';

/** QR 최대 변 길이 — 큰 화면에서 과하게 커지지 않도록 상한을 둔다. */
const MAX_QR_SIZE = 320;
/** QR 좌우 여백(화면 폭 대비) — 카드 패딩 + 화면 패딩 합계. */
const QR_HORIZONTAL_INSET = 96;

/** 공고를 특정할 수 없을 때의 안내 문구 */
function NotFoundBody({ message }: { message: string }) {
  return (
    <View className="flex-1 items-center justify-center px-4">
      <Text className="text-center text-base text-content-secondary dark:text-secondary-400 font-sans">
        {message}
      </Text>
    </View>
  );
}

export default function JobPostingQRScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { job, isFixed, isLoading, error, refresh } = useJobDetailContext();
  const { width } = useWindowDimensions();

  const qrValue = useMemo(() => (id ? buildVenueQRString(id) : ''), [id]);
  const qrSize = Math.min(MAX_QR_SIZE, Math.max(200, width - QR_HORIZONTAL_INSET));

  const headerTitleSuffix = <JobTitleSuffix jobTitle={job?.title ?? null} />;

  // job 이 없는데 QR 을 그리면 제목 없는 QR 이 나온다. 권한 없는(또는 존재하지 않는) 공고 ID 로
  // 딥링크했을 때가 그렇다 — 실제 권한은 RPC 의 auth.uid() + 배정 존재가 강제하므로 보안 결함은
  // 아니지만, "출퇴근 QR"이라 적힌 화면에 쓸 수 없는 QR 이 그려지는 건 표시 결함이다.
  const body = (() => {
    if (!id) {
      return <NotFoundBody message="공고를 찾을 수 없어요" />;
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
    // "공고를 찾을 수 없어요"로 나온다 — 사장이 공고가 사라진 줄 안다(감사 A4).
    // 캐시된 공고가 있으면 QR 은 그린다 — QR 값은 라우트 id 만으로 만들어지므로
    // 일시적 조회 실패로 현장 출퇴근 도구를 막을 이유가 없다.
    if (error && !job) {
      return (
        <ErrorState
          error={error}
          title="공고를 불러오지 못했어요"
          onRetry={refresh}
          alwaysAllowRetry
        />
      );
    }

    if (!job) {
      return <NotFoundBody message="공고를 찾을 수 없어요" />;
    }

    // 고정 공고는 QR 진입점이 모두 숨겨져 있지만 이 라우트는 딥링크로 직접 열릴 수 있다.
    // 진입점만 막고 도착지를 열어두면 우회 경로가 남는다 (사유는 _layout.tsx 주석 참고).
    if (isFixed) {
      return <NotFoundBody message="고정 공고는 아직 QR 출퇴근을 지원하지 않아요" />;
    }

    return null;
  })();

  return (
    // StackHeader 는 상단 인셋을 스스로 처리하지 않는다 — 'top' 을 빼면 제목이 상태바
    // (시계·배터리) 아래로 파고든다. 회귀 가드: app/__tests__/stack-header-safe-area.test.ts
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader
        title="출퇴근 QR"
        titleSuffix={headerTitleSuffix}
        fallbackHref={`/(employer)/my-postings/${id ?? ''}`}
      />

      {body ?? (
        <View className="flex-1 items-center justify-center px-4">
          {/* QR 배경은 스캔 대비를 위해 다크모드에서도 흰색을 유지한다 (dark:bg-white 의도적) */}
          <View
            className="rounded-lg bg-white p-6 dark:bg-white"
            accessibilityRole="image"
            accessibilityLabel="출퇴근용 QR 코드"
          >
            <QRCode value={qrValue} size={qrSize} backgroundColor="white" color="black" />
          </View>

          <Text className="mt-6 text-center text-base text-content-primary dark:text-secondary-200 font-sans">
            스태프가 이 QR을 스캔해 출근·퇴근합니다
          </Text>
          <Text className="mt-2 text-center text-sm text-content-secondary dark:text-secondary-400 font-sans">
            공고마다 1장이며 바뀌지 않습니다. 스크린샷으로 저장해 현장에 비치하세요.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
