/**
 * UNIQN Mobile - FAQ Screen
 * 자주 묻는 질문 화면
 */

import { useState, useCallback } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, EmptyState } from '@/components/ui';
import { FAQCategoryTabs, FAQList, type FAQCategoryFilter } from '@/components/support';
import { useFAQ } from '@/hooks/useInquiry';

export default function FAQScreen() {
  const [selectedCategory, setSelectedCategory] = useState<FAQCategoryFilter>('all');
  const { data: faqItems, isLoading } = useFAQ({ category: selectedCategory });

  const handleCategoryChange = useCallback((category: FAQCategoryFilter) => {
    setSelectedCategory(category);
  }, []);

  const handleInquiry = useCallback(() => {
    router.push('/(app)/support/create-inquiry');
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['bottom']}>
      {/* 카테고리 탭 */}
      <FAQCategoryTabs
        selectedCategory={selectedCategory}
        onSelectCategory={handleCategoryChange}
        className="border-b border-gray-200 bg-white dark:border-surface-overlay dark:bg-surface"
      />

      {/* FAQ 리스트 */}
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {isLoading ? (
          <View className="items-center justify-center py-12">
            <Text className="text-gray-500 dark:text-gray-400">로딩 중...</Text>
          </View>
        ) : faqItems && faqItems.length > 0 ? (
          <FAQList
            items={faqItems}
            selectedCategory={selectedCategory}
            emptyMessage="해당 카테고리에 FAQ가 없습니다."
          />
        ) : (
          <EmptyState title="FAQ가 없습니다" description="아직 등록된 FAQ가 없습니다." />
        )}

        {/* 문의하기 CTA */}
        <View className="mt-6 items-center">
          <Text className="mb-3 text-sm text-gray-500 dark:text-gray-400">
            원하는 답변을 찾지 못하셨나요?
          </Text>
          <Button onPress={handleInquiry} variant="outline" size="sm">
            1:1 문의하기
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
