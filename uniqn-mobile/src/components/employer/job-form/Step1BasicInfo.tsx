/**
 * UNIQN Mobile - 공고 작성 Step 1: 기본 정보
 *
 * @description 제목, 장소, 상세주소, 연락처, 설명 입력
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Button, Input, FormField } from '@/components';
import { MapPinIcon, PhoneIcon } from '@/components/icons';
import { basicInfoSchema } from '@/schemas/jobPosting.schema';
import type { JobPostingFormData, Location } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface Step1BasicInfoProps {
  data: JobPostingFormData;
  onUpdate: (data: Partial<JobPostingFormData>) => void;
  onNext: () => void;
}

// 임시 장소 목록 (실제로는 Firebase에서 가져옴)
const MOCK_LOCATIONS: Location[] = [
  { name: '포커랜드 강남점', address: '서울시 강남구 테헤란로 123', district: '강남구' },
  { name: '포커클럽 홍대점', address: '서울시 마포구 홍대로 45', district: '마포구' },
  { name: '카지노홀덤 신촌점', address: '서울시 서대문구 신촌로 67', district: '서대문구' },
  { name: '홀덤펍 잠실점', address: '서울시 송파구 올림픽로 89', district: '송파구' },
];

// ============================================================================
// Component
// ============================================================================

export function Step1BasicInfo({ data, onUpdate, onNext }: Step1BasicInfoProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // 유효성 검증
  const validate = useCallback(() => {
    const result = basicInfoSchema.safeParse({
      title: data.title,
      location: data.location?.name || '',
      district: data.location?.district,
      detailedAddress: data.detailedAddress,
      description: data.description,
      contactPhone: data.contactPhone,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return false;
    }

    setErrors({});
    return true;
  }, [data]);

  // 다음 단계
  const handleNext = useCallback(() => {
    if (validate()) {
      onNext();
    }
  }, [validate, onNext]);

  // 장소 선택
  const handleSelectLocation = useCallback((location: Location) => {
    onUpdate({ location });
    setShowLocationPicker(false);
  }, [onUpdate]);

  return (
    <View className="flex-1 p-4">
      {/* 제목 */}
      <FormField label="공고 제목" required error={errors.title}>
        <Input
          placeholder="예: 강남 홀덤펍 딜러 구합니다"
          value={data.title}
          onChangeText={(title) => onUpdate({ title })}
          maxLength={25}
          autoFocus
        />
        <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-right">
          {data.title.length}/25
        </Text>
      </FormField>

      {/* 장소 선택 */}
      <FormField label="근무 장소" required error={errors.location} className="mt-4">
        <Pressable
          onPress={() => setShowLocationPicker(!showLocationPicker)}
          className="flex-row items-center px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <MapPinIcon size={20} color="#6B7280" />
          <Text
            className={`ml-3 flex-1 ${
              data.location
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {data.location?.name || '장소를 선택해주세요'}
          </Text>
        </Pressable>

        {/* 장소 선택 드롭다운 */}
        {showLocationPicker && (
          <View className="mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {MOCK_LOCATIONS.map((location, index) => (
              <Pressable
                key={index}
                onPress={() => handleSelectLocation(location)}
                className={`px-4 py-3 ${
                  index < MOCK_LOCATIONS.length - 1
                    ? 'border-b border-gray-100 dark:border-gray-700'
                    : ''
                } ${
                  data.location?.name === location.name
                    ? 'bg-primary-50 dark:bg-primary-900/30'
                    : ''
                }`}
              >
                <Text className="font-medium text-gray-900 dark:text-white">
                  {location.name}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {location.address}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </FormField>

      {/* 상세 주소 */}
      <FormField label="상세 주소" error={errors.detailedAddress} className="mt-4">
        <Input
          placeholder="건물명, 층수 등 (선택)"
          value={data.detailedAddress}
          onChangeText={(detailedAddress) => onUpdate({ detailedAddress })}
          maxLength={200}
        />
      </FormField>

      {/* 연락처 */}
      <FormField label="문의 연락처" required error={errors.contactPhone} className="mt-4">
        <View className="flex-row items-center">
          <View className="absolute left-4 z-10">
            <PhoneIcon size={20} color="#6B7280" />
          </View>
          <Input
            placeholder="010-0000-0000"
            value={data.contactPhone}
            onChangeText={(contactPhone) => onUpdate({ contactPhone })}
            keyboardType="phone-pad"
            maxLength={25}
            className="pl-12"
          />
        </View>
      </FormField>

      {/* 공고 설명 */}
      <FormField label="공고 설명" error={errors.description} className="mt-4">
        <TextInput
          placeholder="근무 환경, 우대 조건 등을 입력해주세요 (선택)"
          value={data.description}
          onChangeText={(description) => onUpdate({ description })}
          multiline
          numberOfLines={4}
          maxLength={500}
          textAlignVertical="top"
          className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white min-h-[100px]"
          placeholderTextColor="#9CA3AF"
        />
        <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-right">
          {data.description.length}/500
        </Text>
      </FormField>

      {/* 다음 버튼 */}
      <View className="mt-6">
        <Button variant="primary" size="lg" onPress={handleNext} fullWidth>
          다음 단계
        </Button>
      </View>
    </View>
  );
}
