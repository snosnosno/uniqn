/**
 * UNIQN Mobile - 공고 작성 Step 1: 기본 정보
 *
 * @description 제목, 장소, 상세주소, 연락처, 설명 입력
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput } from 'react-native';
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


// ============================================================================
// Component
// ============================================================================

export function Step1BasicInfo({ data, onUpdate, onNext }: Step1BasicInfoProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [locationName, setLocationName] = useState(data.location?.name || '');
  const [locationAddress, setLocationAddress] = useState(data.location?.address || '');

  // 장소 정보 업데이트
  const updateLocation = useCallback((name: string, address: string) => {
    if (name.trim()) {
      const location: Location = {
        name: name.trim(),
        address: address.trim(),
        district: '', // 주소에서 추출하거나 별도 입력
      };
      onUpdate({ location });
    } else {
      onUpdate({ location: null });
    }
  }, [onUpdate]);

  // 장소명 변경
  const handleLocationNameChange = useCallback((name: string) => {
    setLocationName(name);
    updateLocation(name, locationAddress);
  }, [locationAddress, updateLocation]);

  // 장소 주소 변경
  const handleLocationAddressChange = useCallback((address: string) => {
    setLocationAddress(address);
    updateLocation(locationName, address);
  }, [locationName, updateLocation]);

  // 유효성 검증
  const validate = useCallback(() => {
    const result = basicInfoSchema.safeParse({
      title: data.title,
      location: locationName || '',
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
  }, [data, locationName]);

  // 다음 단계
  const handleNext = useCallback(() => {
    if (validate()) {
      onNext();
    }
  }, [validate, onNext]);

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

      {/* 장소명 입력 */}
      <FormField label="근무 장소명" required error={errors.location} className="mt-4">
        <Input
          placeholder="예: 홀덤펍 강남점"
          value={locationName}
          onChangeText={handleLocationNameChange}
          maxLength={50}
          leftIcon={<MapPinIcon size={20} color="#6B7280" />}
        />
      </FormField>

      {/* 장소 주소 입력 */}
      <FormField label="근무 장소 주소" required error={errors.locationAddress} className="mt-4">
        <Input
          placeholder="예: 서울시 강남구 테헤란로 123"
          value={locationAddress}
          onChangeText={handleLocationAddressChange}
          maxLength={200}
        />
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
        <Input
          placeholder="010-0000-0000"
          value={data.contactPhone}
          onChangeText={(contactPhone) => onUpdate({ contactPhone })}
          keyboardType="phone-pad"
          maxLength={25}
          leftIcon={<PhoneIcon size={20} color="#6B7280" />}
        />
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
