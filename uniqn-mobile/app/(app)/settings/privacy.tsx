/**
 * UNIQN Mobile - Privacy Policy Screen
 * 개인정보처리방침 화면
 */

import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/ui';

export default function PrivacyScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        <Card className="mb-4">
          <Text className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
            개인정보처리방침
          </Text>

          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제1조 (개인정보의 수집 항목)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.{'\n\n'}
              1. 필수 수집 항목: 이메일, 이름, 휴대폰 번호{'\n'}
              2. 선택 수집 항목: 프로필 사진, 경력 정보{'\n'}
              3. 자동 수집 항목: 접속 IP, 접속 일시, 서비스 이용 기록
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제2조 (개인정보의 수집 및 이용 목적)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 회원 가입 및 관리: 회원제 서비스 제공, 본인 확인, 서비스 부정 이용 방지{'\n'}
              2. 서비스 제공: 구인구직 매칭, 일정 관리, 정산 처리{'\n'}
              3. 고객 지원: 문의 응대, 공지사항 전달{'\n'}
              4. 서비스 개선: 통계 분석, 맞춤형 서비스 제공
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제3조 (개인정보의 보유 및 이용 기간)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 회원 탈퇴 시까지 보유하며, 탈퇴 후 즉시 파기합니다.{'\n'}
              2. 단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.{'\n'}
              - 계약 또는 청약철회 기록: 5년{'\n'}
              - 소비자 불만 또는 분쟁처리 기록: 3년{'\n'}
              - 접속 기록: 3개월
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제4조 (개인정보의 제3자 제공)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              회사는 원칙적으로 회원의 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의 경우에는
              예외로 합니다.{'\n\n'}
              1. 회원이 사전에 동의한 경우{'\n'}
              2. 법령의 규정에 의한 경우{'\n'}
              3. 서비스 제공을 위해 필요한 경우 (구인자-구직자 간 매칭)
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제5조 (개인정보의 안전성 확보 조치)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.{'\n\n'}
              1. 개인정보 암호화{'\n'}
              2. 해킹 등에 대비한 기술적 대책{'\n'}
              3. 개인정보 취급 직원의 최소화 및 교육{'\n'}
              4. 개인정보 접근 제한
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제6조 (정보주체의 권리)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              회원은 언제든지 다음의 권리를 행사할 수 있습니다.{'\n\n'}
              1. 개인정보 열람 요구{'\n'}
              2. 개인정보 정정 요구{'\n'}
              3. 개인정보 삭제 요구{'\n'}
              4. 개인정보 처리 정지 요구
            </Text>
          </View>

          <View>
            <Text className="text-xs text-gray-400 dark:text-gray-500">
              시행일: 2024년 1월 1일{'\n'}
              (실제 방침 내용은 법무팀 검토 후 업데이트 예정)
            </Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
