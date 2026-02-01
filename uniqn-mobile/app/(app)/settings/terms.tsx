/**
 * UNIQN Mobile - Terms of Service Screen
 * 이용약관 화면
 * 전자상거래법 및 표준약관 준수
 */

/* eslint-disable react/no-unescaped-entities */

import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/ui';

export default function TermsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        <Card className="mb-4">
          <Text className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
            UNIQN 이용약관
          </Text>

          {/* 제1조: 목적 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제1조 (목적)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              이 약관은 스노스튜디오(이하 "회사")가 제공하는 UNIQN 서비스(이하 "서비스")의 이용조건
              및 절차, 회사와 회원 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
            </Text>
          </View>

          {/* 제2조: 정의 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제2조 (정의)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. "서비스"란 회사가 제공하는 홀덤 토너먼트 스태프 매칭 플랫폼을 의미합니다.{'\n\n'}
              2. "회원"이란 이 약관에 동의하고 회사와 이용계약을 체결한 자를 의미합니다.{'\n\n'}
              3. "구인자"란 스태프를 모집하는 회원을 의미합니다.{'\n\n'}
              4. "구직자(스태프)"란 스태프로 근무하고자 하는 회원을 의미합니다.{'\n\n'}
              5. "공고"란 구인자가 스태프 모집을 위해 등록하는 게시물을 의미합니다.{'\n\n'}
              6. "매칭"이란 구인자와 구직자 간의 근무 계약 성립을 의미합니다.
            </Text>
          </View>

          {/* 제3조: 약관의 효력 및 변경 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제3조 (약관의 효력 및 변경)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 이 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이
              발생합니다.{'\n\n'}
              2. 회사는 필요한 경우 관련 법령을 위배하지 않는 범위에서 이 약관을 변경할 수 있습니다.
              {'\n\n'}
              3. 약관 변경 시 시행일 7일 전부터 앱 내 공지사항을 통해 공지합니다.{'\n\n'}
              4. 회원의 권리 또는 의무에 중대한 변경이 있는 경우 시행일 30일 전부터 공지합니다.
              {'\n\n'}
              5. 회원이 변경된 약관에 동의하지 않는 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.
              {'\n\n'}
              6. 변경된 약관의 시행일 이후에도 서비스를 계속 이용하는 경우 약관 변경에 동의한 것으로
              봅니다.
            </Text>
          </View>

          {/* 제4조: 서비스의 제공 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제4조 (서비스의 제공)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              회사는 다음과 같은 서비스를 제공합니다.{'\n\n'}
              1. 구인공고 등록 및 조회 서비스{'\n'}
              2. 스태프 지원 및 매칭 서비스{'\n'}
              3. QR 코드 기반 출퇴근 관리 서비스{'\n'}
              4. 정산 관리 서비스{'\n'}
              5. 알림 서비스 (푸시 알림, 앱 내 알림){'\n'}
              6. 고객지원 서비스{'\n'}
              7. 기타 회사가 정하는 서비스
            </Text>
          </View>

          {/* 제5조: 회원의 의무 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제5조 (회원의 의무)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 회원은 서비스 이용 시 관련 법령과 이 약관을 준수해야 합니다.{'\n\n'}
              2. 회원은 타인의 권리를 침해하거나 허위 정보를 등록해서는 안 됩니다.{'\n\n'}
              3. 회원은 자신의 계정 정보를 안전하게 관리해야 하며, 제3자에게 이용을 허락해서는 안
              됩니다.{'\n\n'}
              4. 회원은 다음 행위를 해서는 안 됩니다.{'\n'}- 허위 또는 타인의 정보로 가입하는 행위
              {'\n'}- 서비스 운영을 방해하는 행위{'\n'}- 다른 회원의 개인정보를 수집·저장·공개하는
              행위{'\n'}- 불법적인 목적으로 서비스를 이용하는 행위{'\n'}- 회사의 사전 동의 없이 영리
              목적으로 서비스를 이용하는 행위
            </Text>
          </View>

          {/* 제6조: 회원가입 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제6조 (회원가입)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 가입 자격{'\n'}- 만 19세 이상의 성인{'\n'}- 본인인증을 완료한 자{'\n\n'}
              2. 가입 절차{'\n'}- 이용약관 및 개인정보처리방침 동의{'\n'}- 본인인증 (PASS 또는
              카카오 인증){'\n'}- 필수 정보 입력{'\n'}- 가입 완료{'\n\n'}
              3. 가입 거부 또는 취소 사유{'\n'}- 실명이 아닌 정보로 신청한 경우{'\n'}- 이전에
              이용자격을 상실한 적이 있는 경우{'\n'}- 기타 회사가 정한 이용요건을 충족하지 못한 경우
            </Text>
          </View>

          {/* 제7조: 회원탈퇴 및 자격상실 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제7조 (회원탈퇴 및 자격상실)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 회원 탈퇴{'\n'}- 회원은 언제든지 앱 내 "설정 {'>'} 계정관리 {'>'} 회원탈퇴" 메뉴를
              통해 탈퇴를 신청할 수 있습니다.{'\n'}- 탈퇴 시 개인정보는 관련 법령에 따라 일정 기간
              보관 후 파기됩니다.{'\n'}- 진행 중인 매칭이 있는 경우 해당 매칭 완료 후 탈퇴가
              가능합니다.{'\n\n'}
              2. 자격 상실{'\n'}- 다음의 경우 회원 자격이 상실될 수 있습니다.{'\n'}- 본 약관을
              위반한 경우{'\n'}- 서비스 운영을 고의로 방해한 경우{'\n'}- 공공질서 및 미풍양속에
              반하는 행위를 한 경우{'\n'}- 타인의 명예를 훼손하거나 불이익을 주는 행위를 한 경우
            </Text>
          </View>

          {/* 제8조: 서비스 이용제한 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제8조 (서비스 이용제한)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 이용제한 사유{'\n'}- 약관 위반, 허위정보 등록, 타인 권리 침해{'\n'}- 노쇼(No-show),
              무단 이탈 등 신뢰도 저하 행위{'\n'}- 불법 행위 또는 불법 행위에 대한 조장{'\n'}-
              서비스의 안정적 운영을 방해하는 행위{'\n\n'}
              2. 제한 절차{'\n'}- 1차 위반: 경고{'\n'}- 2차 위반: 7일 이용정지{'\n'}- 3차 위반: 30일
              이용정지{'\n'}- 4차 위반: 영구 이용정지{'\n'}※ 중대한 위반의 경우 즉시 영구 이용정지될
              수 있습니다.{'\n\n'}
              3. 이의신청{'\n'}- 이용제한 통보 후 7일 이내에 고객센터로 이의신청 가능{'\n'}- 회사는
              이의신청 접수 후 14일 이내에 결과를 통보
            </Text>
          </View>

          {/* 제9조: 회사의 의무 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제9조 (회사의 의무)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 회사는 관련 법령과 이 약관을 준수하며, 지속적이고 안정적으로 서비스를 제공하기 위해
              노력합니다.{'\n\n'}
              2. 회사는 회원의 개인정보를 보호하며, 개인정보처리방침에 따라 처리합니다.{'\n\n'}
              3. 회사는 회원의 불만 및 피해 구제 요청을 신속하게 처리하기 위해 노력합니다.
              {'\n\n'}
              4. 회사는 서비스 제공과 관련하여 알게 된 회원의 정보를 본인의 동의 없이 제3자에게
              제공하지 않습니다.
            </Text>
          </View>

          {/* 제10조: 서비스 중단 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제10조 (서비스 중단)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 회사는 다음의 경우 서비스 제공을 일시적으로 중단할 수 있습니다.{'\n'}- 시스템
              정기점검, 교체 및 고장{'\n'}- 천재지변, 국가비상사태 등 불가항력적 사유{'\n'}-
              기간통신사업자의 전기통신 서비스 중지{'\n\n'}
              2. 서비스 중단 시 사전에 공지합니다. 단, 긴급한 경우 사후에 공지할 수 있습니다.
              {'\n\n'}
              3. 회사는 무료로 제공되는 서비스의 중단으로 인해 회원에게 발생한 손해에 대해 책임지지
              않습니다.
            </Text>
          </View>

          {/* 제11조: 손해배상 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제11조 (손해배상)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 회사는 회사의 귀책사유로 인해 회원에게 손해가 발생한 경우, 그 손해를 배상할 책임이
              있습니다.{'\n\n'}
              2. 배상 범위{'\n'}- 직접적이고 현실적인 손해에 한함{'\n'}- 간접적, 부수적, 결과적
              손해는 제외{'\n\n'}
              3. 회원이 본 약관을 위반하여 회사에 손해를 끼친 경우, 해당 회원은 회사에 그 손해를
              배상해야 합니다.
            </Text>
          </View>

          {/* 제12조: 면책조항 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제12조 (면책조항)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 회사는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력적 사유로 서비스를
              제공할 수 없는 경우 책임이 면제됩니다.{'\n\n'}
              2. 회사는 회원의 귀책사유로 인한 서비스 이용장애에 대해 책임지지 않습니다.{'\n\n'}
              3. 회사는 회원 간 또는 회원과 제3자 간에 서비스를 매개로 발생한 분쟁에 대해 개입할
              의무가 없으며, 이로 인한 손해를 배상할 책임도 없습니다.{'\n\n'}
              4. 회사는 무료로 제공하는 서비스 이용과 관련하여 회원에게 발생한 손해에 대해 책임지지
              않습니다. 단, 회사의 고의 또는 중과실로 인한 경우는 제외합니다.{'\n\n'}
              5. 회사는 구인자와 구직자 간의 실제 근무 계약 이행 및 그 결과에 대해 책임지지
              않습니다.
            </Text>
          </View>

          {/* 제13조: 저작권 및 지식재산권 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제13조 (저작권 및 지식재산권)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 서비스에 대한 저작권 및 지식재산권은 회사에 귀속됩니다.{'\n\n'}
              2. 회원이 서비스 내에 게시한 콘텐츠의 저작권은 해당 회원에게 귀속됩니다.{'\n\n'}
              3. 회원은 서비스를 이용하면서 얻은 정보를 회사의 사전 동의 없이 복제, 전송, 출판,
              배포, 방송 등의 방법으로 영리 목적으로 이용하거나 제3자에게 이용하게 해서는 안 됩니다.
              {'\n\n'}
              4. 회사는 회원이 서비스 내에 게시한 콘텐츠를 서비스 운영, 개선, 홍보 등의 목적으로
              사용할 수 있습니다.
            </Text>
          </View>

          {/* 제14조: 분쟁해결 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제14조 (분쟁해결)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 이 약관에 명시되지 않은 사항은 대한민국 법률에 따릅니다.{'\n\n'}
              2. 서비스 이용과 관련하여 회사와 회원 간에 분쟁이 발생한 경우, 쌍방은 분쟁해결을 위해
              성실히 협의합니다.{'\n\n'}
              3. 협의가 이루어지지 않을 경우, 다음 기관에 분쟁조정을 신청할 수 있습니다.{'\n'}-
              한국인터넷진흥원 전자문서·전자거래분쟁조정위원회{'\n'}- 콘텐츠분쟁조정위원회{'\n\n'}
              4. 소송이 제기된 경우, 회사의 본사 소재지를 관할하는 법원을 전속 관할법원으로 합니다.
            </Text>
          </View>

          {/* 시행일 */}
          <View className="border-t border-gray-200 pt-4 dark:border-surface-overlay">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">부칙</Text>
            <Text className="mt-2 text-xs text-gray-500 dark:text-gray-500">
              - 공고일: 2025년 1월 25일{'\n'}- 시행일: 2025년 2월 1일{'\n'}- 버전: 1.0
            </Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
