/**
 * UNIQN Mobile - 공고 작성 기본 정보 섹션
 *
 * @description 공고 타입, 제목, 장소, 연락처 등 기본 정보 입력
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, memo } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Input, FormField } from '@/components';
import { MapPinIcon, PhoneIcon } from '@/components/icons';
import type { JobPostingFormData, Location, PostingType } from '@/types';
import { PostingTypeSelector } from '../shared';

// ============================================================================
// Types
// ============================================================================

interface BasicInfoSectionProps {
  data: JobPostingFormData;
  onUpdate: (data: Partial<JobPostingFormData>) => void;
  errors?: Record<string, string>;
}

// ============================================================================
// Component
// ============================================================================

export const BasicInfoSection = memo(function BasicInfoSection({
  data,
  onUpdate,
  errors = {},
}: BasicInfoSectionProps) {
  const [locationName, setLocationName] = useState(data.location?.name || '');
  const [locationAddress, setLocationAddress] = useState(data.location?.address || '');

  // 외부에서 data.location이 변경되면 (템플릿 불러오기 등) 로컬 상태 동기화
  useEffect(() => {
    setLocationName(data.location?.name || '');
    setLocationAddress(data.location?.address || '');
  }, [data.location]);

  // 장소 정보 업데이트
  const updateLocation = useCallback((name: string, address: string) => {
    if (name.trim()) {
      const location: Location = {
        name: name.trim(),
        address: address.trim(),
        district: '',
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

  // 공고 타입 변경 핸들러
  const handlePostingTypeChange = useCallback((type: PostingType) => {
    onUpdate({
      postingType: type,
      workDate: '',
      startTime: '',
      tournamentDates: [],
      daysPerWeek: 5,
    });
  }, [onUpdate]);

  // 연락처 포맷팅 (숫자만 입력하면 자동으로 - 추가)
  const formatPhoneNumber = useCallback((phoneNumber: string): string => {
    const cleaned = phoneNumber.replace(/\D/g, ''); // 숫자만 추출

    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 7) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    } else if (cleaned.length <= 10) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else {
      // 11자리 이상
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7, 11)}`;
    }
  }, []);

  // 연락처 변경 핸들러
  const handlePhoneChange = useCallback((phone: string) => {
    const formatted = formatPhoneNumber(phone);
    onUpdate({ contactPhone: formatted });
  }, [formatPhoneNumber, onUpdate]);

  return (
    <View>
      {/* 공고 타입 선택 */}
      <PostingTypeSelector
        value={data.postingType}
        onChange={handlePostingTypeChange}
      />

      {/* 제목 */}
      <FormField label="공고 제목" required error={errors.title} className="mt-4">
        <Input
          placeholder="예: 강남 홀덤펍 딜러 구합니다"
          value={data.title}
          onChangeText={(title) => onUpdate({ title })}
          maxLength={25}
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
          onChangeText={handlePhoneChange}
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
    </View>
  );
});

export default BasicInfoSection;
