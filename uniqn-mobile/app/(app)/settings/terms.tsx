/**
 * UNIQN Mobile - Terms of Service Screen
 * 이용약관 화면
 */

/* eslint-disable react/no-unescaped-entities */

import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/ui';

export default function TermsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        <Card className="mb-4">
          <Text className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
            UNIQN 이용약관
          </Text>

          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제1조 (목적)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              이 약관은 UNIQN(이하 "회사")이 제공하는 홀덤 스태프 매칭 서비스(이하 "서비스")의
              이용조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제2조 (정의)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. "서비스"란 회사가 제공하는 홀덤 토너먼트 스태프 매칭 플랫폼을 의미합니다.{'\n'}
              2. "회원"이란 이 약관에 동의하고 서비스를 이용하는 자를 의미합니다.{'\n'}
              3. "구인자"란 스태프를 모집하는 회원을 의미합니다.{'\n'}
              4. "구직자"란 스태프로 근무하고자 하는 회원을 의미합니다.
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제3조 (약관의 효력 및 변경)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 이 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이
              발생합니다.{'\n'}
              2. 회사는 필요한 경우 관련 법령을 위배하지 않는 범위에서 이 약관을 변경할 수 있습니다.
            </Text>
          </View>

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
              5. 기타 회사가 정하는 서비스
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제5조 (회원의 의무)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 회원은 서비스 이용 시 관련 법령과 이 약관을 준수해야 합니다.{'\n'}
              2. 회원은 타인의 권리를 침해하거나 허위 정보를 등록해서는 안 됩니다.{'\n'}
              3. 회원은 자신의 계정 정보를 안전하게 관리해야 합니다.
            </Text>
          </View>

          <View>
            <Text className="text-xs text-gray-400 dark:text-gray-500">
              본 약관은 2024년 1월 1일부터 시행됩니다.{'\n'}
              (실제 약관 내용은 법무팀 검토 후 업데이트 예정)
            </Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
