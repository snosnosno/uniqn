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
import { buildVenueQRString } from '@/services/work/eventQRService';
import { JobTitleSuffix, useJobDetailContext } from './_layout';

/** QR 최대 변 길이 — 큰 화면에서 과하게 커지지 않도록 상한을 둔다. */
const MAX_QR_SIZE = 320;
/** QR 좌우 여백(화면 폭 대비) — 카드 패딩 + 화면 패딩 합계. */
const QR_HORIZONTAL_INSET = 96;

export default function JobPostingQRScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { job } = useJobDetailContext();
  const { width } = useWindowDimensions();

  const qrValue = useMemo(() => (id ? buildVenueQRString(id) : ''), [id]);
  const qrSize = Math.min(MAX_QR_SIZE, Math.max(200, width - QR_HORIZONTAL_INSET));

  const headerTitleSuffix = <JobTitleSuffix jobTitle={job?.title ?? null} />;

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['bottom']}>
      <StackHeader
        title="출퇴근 QR"
        titleSuffix={headerTitleSuffix}
        fallbackHref={`/(employer)/my-postings/${id ?? ''}`}
      />

      {!id ? (
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-base text-content-secondary dark:text-secondary-400 font-sans">
            공고를 찾을 수 없어요
          </Text>
        </View>
      ) : (
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
