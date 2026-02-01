/**
 * UNIQN Mobile - Liability Waiver Screen
 * 서약서 (면책 동의) 화면
 */

/* eslint-disable react/no-unescaped-entities */

import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackHeader } from '@/components/headers';
import { Card } from '@/components/ui';

export default function LiabilityWaiverScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
      <StackHeader title="서약서" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Card className="mb-4">
          <Text className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
            UNIQN 구인자 서약서
          </Text>

          <View className="mb-6 rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
            <Text className="text-sm font-medium leading-6 text-amber-800 dark:text-amber-200">
              본 서약서는 UNIQN 플랫폼을 통한 구인자 활동과 관련하여 발생할 수 있는 책임 소재를
              명확히 하기 위한 것입니다. 구인자로 등록하기 전에 아래 내용을 주의 깊게 읽어주시기
              바랍니다.
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제1조 (책임의 귀속)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              UNIQN은 구인자와 스태프 간의 중개 서비스만을 제공하며, 다음 사항에 대한 책임은
              구인자 또는 해당 업체에게 있습니다.{'\n\n'}
              1. 스태프 채용 및 근로 관계에서 발생하는 모든 법적 책임{'\n'}
              2. 근무 현장에서 발생하는 안전사고 및 인명피해{'\n'}
              3. 급여 지급 및 4대 보험 등 근로 관련 의무 이행{'\n'}
              4. 스태프 개인정보의 수집, 이용, 보관 및 파기
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제2조 (불법행위에 대한 책임)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              구인자 또는 업체의 불법적인 행위나 사고에 대한 모든 민형사상 책임은 UNIQN이 아닌
              해당 구인자 또는 업체에게 있습니다.{'\n\n'}
              불법행위의 예시:{'\n'}
              - 불법 도박장 운영 또는 방조{'\n'}
              - 스태프에 대한 성희롱, 폭행 등 위법 행위{'\n'}
              - 임금 체불 또는 부당 노동행위{'\n'}
              - 기타 관련 법령 위반 행위
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제3조 (현장 사고에 대한 책임)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              근무 현장에서 발생하는 다음 사항에 대한 책임은 구인자에게 있습니다.{'\n\n'}
              1. 스태프의 안전사고 및 부상{'\n'}
              2. 시설물 파손 및 물적 피해{'\n'}
              3. 제3자에 대한 피해{'\n'}
              4. 천재지변 외의 사유로 인한 이벤트 취소 시 스태프 보상
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제4조 (정보 제공의 정확성)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              구인자는 공고 등록 시 제공하는 모든 정보(업체 정보, 근무 조건, 급여 등)의 정확성에
              대해 책임지며, 허위 또는 과장된 정보로 인해 발생하는 피해에 대한 책임은 구인자에게
              있습니다.
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제5조 (UNIQN의 면책)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              UNIQN은 다음 사항에 대해 책임을 지지 않습니다.{'\n\n'}
              1. 구인자와 스태프 간의 분쟁{'\n'}
              2. 구인자의 위법 행위로 인한 피해{'\n'}
              3. 구인자가 제공한 정보의 정확성{'\n'}
              4. 근무 현장에서 발생하는 사고{'\n'}
              5. 제3자의 권리 침해{'\n\n'}
              단, UNIQN은 분쟁 해결을 위한 중재 노력을 할 수 있으며, 이는 법적 책임의 인정을
              의미하지 않습니다.
            </Text>
          </View>

          <View className="mb-6 rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
            <Text className="text-sm font-medium leading-6 text-red-800 dark:text-red-200">
              본 서약서에 동의함으로써, 구인자는 위 내용을 충분히 이해하였으며, 관련 책임이
              구인자 본인 또는 해당 업체에게 있음을 인정합니다.
            </Text>
          </View>

          <View>
            <Text className="text-xs text-gray-400 dark:text-gray-500">
              본 서약서는 2024년 1월 1일부터 시행됩니다.{'\n'}
              (실제 서약서 내용은 법무팀 검토 후 업데이트 예정)
            </Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
