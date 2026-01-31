/**
 * UNIQN Mobile - Employer Terms of Service Screen
 * 구인자 이용약관 화면
 */

/* eslint-disable react/no-unescaped-entities */

import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackHeader } from '@/components/headers';
import { Card } from '@/components/ui';

export default function EmployerTermsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['top']}>
      <StackHeader title="구인자 이용약관" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Card className="mb-4">
          <Text className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
            UNIQN 구인자 이용약관
          </Text>

          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제1조 (목적)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              이 약관은 UNIQN(이하 "회사")이 제공하는 구인자 서비스 이용에 관한 사항을 규정함을
              목적으로 합니다. 구인자란 UNIQN 플랫폼을 통해 홀덤 토너먼트 스태프를 모집하는
              회원을 의미합니다.
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제2조 (구인자의 자격)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 구인자로 등록하려면 본인인증을 완료해야 합니다.{'\n'}
              2. 구인자는 실제 스태프를 고용할 의사와 능력이 있어야 합니다.{'\n'}
              3. 허위 또는 과장된 공고를 등록해서는 안 됩니다.
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제3조 (구인자의 의무)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 구인자는 공고 내용을 정확하게 작성해야 합니다.{'\n'}
              2. 확정된 스태프에 대한 급여를 약속된 기한 내에 지급해야 합니다.{'\n'}
              3. 스태프의 안전한 근무 환경을 보장해야 합니다.{'\n'}
              4. 관련 법령(근로기준법 등)을 준수해야 합니다.{'\n'}
              5. 스태프의 개인정보를 보호하고 목적 외 사용을 금지합니다.
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제4조 (공고 등록 및 관리)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 구인자는 상세하고 정확한 공고를 등록해야 합니다.{'\n'}
              2. 공고에는 근무 일시, 장소, 급여, 업무 내용 등을 명시해야 합니다.{'\n'}
              3. 허위 공고 등록 시 서비스 이용이 제한될 수 있습니다.{'\n'}
              4. 공고 마감 후에도 지원자 관리 의무가 있습니다.
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제5조 (수수료 및 정산)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 구인자는 회사가 정한 서비스 수수료를 부담할 수 있습니다.{'\n'}
              2. 수수료율은 별도 고지하며, 변경 시 사전 통지합니다.{'\n'}
              3. 정산은 회사가 정한 절차에 따라 진행됩니다.
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제6조 (이용 제한)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              다음의 경우 구인자 서비스 이용이 제한될 수 있습니다.{'\n\n'}
              1. 허위 공고를 반복적으로 등록하는 경우{'\n'}
              2. 스태프에게 급여를 지급하지 않는 경우{'\n'}
              3. 스태프에 대한 부당한 대우가 확인되는 경우{'\n'}
              4. 기타 관련 법령 또는 이 약관을 위반하는 경우
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
