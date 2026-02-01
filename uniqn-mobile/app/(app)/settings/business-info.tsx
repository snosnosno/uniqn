/**
 * UNIQN Mobile - Business Info Screen
 * 사업자정보 화면
 * 전자상거래법 준수를 위한 사업자 정보 표시
 */

import { ScrollView, Text, View, Linking, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/ui';

const BUSINESS_INFO = {
  companyName: '스노스튜디오',
  representative: '김승호',
  businessNumber: '000-00-00000', // TODO: 실제 사업자등록번호로 교체
  salesNumber: '제0000-서울강남-0000호', // TODO: 실제 통신판매업신고번호로 교체
  address: '서울특별시 강남구 테헤란로 00길 00, 0층', // TODO: 실제 주소로 교체
  email: 'uniqnkorea@gmail.com',
  phone: '010-9800-9039',
  customerServiceHours: '평일 10:00 ~ 18:00 (점심 12:00 ~ 13:00)',
};

interface InfoRowProps {
  label: string;
  value: string;
  onPress?: () => void;
  isLink?: boolean;
}

function InfoRow({ label, value, onPress, isLink }: InfoRowProps) {
  const content = (
    <View className="flex-row py-3">
      <Text className="w-28 text-sm text-gray-500 dark:text-gray-400">{label}</Text>
      <Text
        className={`flex-1 text-sm ${
          isLink ? 'text-purple-600 dark:text-purple-400' : 'text-gray-900 dark:text-gray-100'
        }`}
      >
        {value}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} className="active:opacity-70">
        {content}
      </Pressable>
    );
  }

  return content;
}

export default function BusinessInfoScreen() {
  const handleEmailPress = () => {
    Linking.openURL(`mailto:${BUSINESS_INFO.email}`);
  };

  const handlePhonePress = () => {
    Linking.openURL(`tel:${BUSINESS_INFO.phone}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        <Card className="mb-4">
          <Text className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
            사업자정보
          </Text>

          <View className="border-t border-gray-100 dark:border-gray-700">
            <InfoRow label="상호명" value={BUSINESS_INFO.companyName} />
          </View>

          <View className="border-t border-gray-100 dark:border-gray-700">
            <InfoRow label="대표자" value={BUSINESS_INFO.representative} />
          </View>

          <View className="border-t border-gray-100 dark:border-gray-700">
            <InfoRow label="사업자등록번호" value={BUSINESS_INFO.businessNumber} />
          </View>

          <View className="border-t border-gray-100 dark:border-gray-700">
            <InfoRow label="통신판매업신고" value={BUSINESS_INFO.salesNumber} />
          </View>

          <View className="border-t border-gray-100 dark:border-gray-700">
            <InfoRow label="사업장 주소" value={BUSINESS_INFO.address} />
          </View>

          <View className="border-t border-gray-100 dark:border-gray-700">
            <InfoRow label="이메일" value={BUSINESS_INFO.email} onPress={handleEmailPress} isLink />
          </View>

          <View className="border-t border-gray-100 dark:border-gray-700">
            <InfoRow
              label="고객센터"
              value={BUSINESS_INFO.phone}
              onPress={handlePhonePress}
              isLink
            />
          </View>

          <View className="border-t border-gray-100 dark:border-gray-700">
            <InfoRow label="운영시간" value={BUSINESS_INFO.customerServiceHours} />
          </View>
        </Card>

        <Text className="px-2 text-xs leading-5 text-gray-400 dark:text-gray-500">
          사업자정보 확인은 국세청 홈택스(www.hometax.go.kr)에서 가능합니다.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
