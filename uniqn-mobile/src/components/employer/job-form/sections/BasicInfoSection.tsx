/**
 * UNIQN Mobile - 공고 작성 기본 정보 섹션
 *
 * @description 공고 타입, 제목, 장소, 연락처 등 기본 정보 입력
 * @version 1.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Input, FormField } from '@/components';
import { MapPinIcon, PhoneIcon } from '@/components/icons';
import type { JobPostingFormData, Location, PostingType } from '@/types';
import { PostingTypeSelector } from '../shared';
import { formatPhoneNumber } from '@/utils/phone';

// ============================================================================
// Types
// ============================================================================

interface BasicInfoSectionProps {
  data: JobPostingFormData;
  onUpdate: (data: Partial<JobPostingFormData>) => void;
  errors?: Record<string, string>;
  /** 수정 모드 여부 (공고 타입 변경 불가) */
  isEdit?: boolean;
}

function getLocationAddressValue(location?: Location | null): string {
  return location?.address || location?.district || '';
}

function getDetailedAddressValue(data: JobPostingFormData): string {
  return data.location?.detailedAddress ?? data.detailedAddress ?? '';
}

// ============================================================================
// Component
// ============================================================================

export const BasicInfoSection = memo(function BasicInfoSection({
  data,
  onUpdate,
  errors = {},
  isEdit = false,
}: BasicInfoSectionProps) {
  const [locationName, setLocationName] = useState(data.location?.name || '');
  const [locationAddress, setLocationAddress] = useState(getLocationAddressValue(data.location));

  // 외부에서 data.location이 변경되면 (템플릿 불러오기 등) 로컬 상태 동기화
  // 주의: data.location은 draftToFormData() 호출마다 새 객체를 생성하므로 객체 자체가 아닌
  //       primitive 값(문자열)을 의존성으로 사용해야 무한 루프를 방지할 수 있습니다.
  const locationNameFromProps = data.location?.name || '';
  const locationAddressFromProps = getLocationAddressValue(data.location);
  useEffect(() => {
    setLocationName(locationNameFromProps);
    setLocationAddress(locationAddressFromProps);
  }, [locationNameFromProps, locationAddressFromProps]);

  // dataRef: data prop을 매 렌더마다 최신화해 두고, useCallback 의존성 배열은 onUpdate만 유지합니다.
  // 이 패턴은 stale closure가 아닙니다 — handleUpdateLocation 호출 시점에
  // dataRef.current는 항상 최신 data를 가리키므로 안전합니다.
  const dataRef = useRef(data);
  dataRef.current = data;

  // 장소 정보 업데이트
  const handleUpdateLocation = useCallback(
    (
      name: string,
      address: string,
      detailedAddress: string = getDetailedAddressValue(dataRef.current)
    ) => {
      if (name.trim()) {
        const location: Location = {
          // Preserve in-progress whitespace while typing. Serialization trims before persistence.
          name,
          address,
          district: address,
          ...(detailedAddress ? { detailedAddress } : {}),
        };
        onUpdate({ location, detailedAddress });
      } else {
        onUpdate({ location: null, detailedAddress });
      }
    },
    [onUpdate]
  );

  // 장소명 변경
  const handleLocationNameChange = useCallback(
    (name: string) => {
      setLocationName(name);
      handleUpdateLocation(name, locationAddress);
    },
    [locationAddress, handleUpdateLocation]
  );

  // 장소 주소 변경
  const handleLocationAddressChange = useCallback(
    (address: string) => {
      setLocationAddress(address);
      handleUpdateLocation(locationName, address);
    },
    [locationName, handleUpdateLocation]
  );

  // 공고 타입 변경 핸들러
  const handlePostingTypeChange = useCallback(
    (type: PostingType) => {
      onUpdate({
        postingType: type,
        workDate: '',
        startTime: '',
        daysPerWeek: 5,
      });
    },
    [onUpdate]
  );

  // 연락처 변경 핸들러
  const handlePhoneChange = useCallback(
    (phone: string) => {
      const formatted = formatPhoneNumber(phone);
      onUpdate({ contactPhone: formatted });
    },
    [onUpdate]
  );

  return (
    <View>
      {/* 공고 타입 선택 */}
      <PostingTypeSelector
        value={data.postingType}
        onChange={handlePostingTypeChange}
        disabled={isEdit}
      />

      {/* 제목 */}
      <FormField label="공고 제목" required error={errors.title} className="mt-4">
        <Input
          placeholder="예: 강남 홀덤펍 딜러 구합니다"
          value={data.title}
          onChangeText={(title) => onUpdate({ title })}
          accessibilityLabel="공고 제목"
          testID="job-posting-title-input"
          maxLength={25}
        />
        <Text className="mt-1 text-xs text-secondary-500 dark:text-secondary-400 text-right font-sans">
          {data.title.length}/25
        </Text>
      </FormField>

      {/* 장소명 입력 */}
      <FormField label="근무 장소명" required error={errors.location} className="mt-4">
        <Input
          placeholder="예: 홀덤펍 강남점"
          value={locationName}
          onChangeText={handleLocationNameChange}
          accessibilityLabel="근무 장소명"
          testID="job-posting-location-name-input"
          maxLength={50}
          leftIcon={<MapPinIcon size={20} color={SECONDARY_PALETTE[500]} />}
        />
      </FormField>

      {/* 장소 주소 입력 */}
      <FormField label="근무 장소 주소" required error={errors.locationAddress} className="mt-4">
        <Input
          placeholder="예: 서울시 강남구 테헤란로 123"
          value={locationAddress}
          onChangeText={handleLocationAddressChange}
          accessibilityLabel="근무 장소 주소"
          testID="job-posting-location-address-input"
          maxLength={200}
        />
      </FormField>

      {/* 상세 주소 */}
      <FormField label="상세 주소" error={errors.detailedAddress} className="mt-4">
        <Input
          placeholder="건물명, 층수 등 (선택)"
          value={getDetailedAddressValue(data)}
          onChangeText={(detailedAddress) =>
            handleUpdateLocation(locationName, locationAddress, detailedAddress)
          }
          accessibilityLabel="상세 주소"
          testID="job-posting-detailed-address-input"
          maxLength={200}
        />
      </FormField>

      {/* 연락처 */}
      <FormField label="문의 연락처" required error={errors.contactPhone} className="mt-4">
        <Input
          placeholder="010-0000-0000"
          value={data.contactPhone}
          onChangeText={handlePhoneChange}
          accessibilityLabel="문의 연락처"
          testID="job-posting-contact-phone-input"
          keyboardType="phone-pad"
          maxLength={25}
          leftIcon={<PhoneIcon size={20} color={SECONDARY_PALETTE[500]} />}
        />
      </FormField>

      {/* 공고 설명 */}
      <FormField label="공고 설명" error={errors.description} className="mt-4">
        <TextInput
          placeholder="근무 환경, 우대 조건 등을 입력해주세요 (선택)"
          value={data.description}
          onChangeText={(description) => onUpdate({ description })}
          accessibilityLabel="공고 설명"
          testID="job-posting-description-input"
          multiline
          numberOfLines={4}
          maxLength={500}
          textAlignVertical="top"
          className="px-4 py-3 bg-white dark:bg-surface border border-divider rounded-lg text-content-primary dark:text-off-white min-h-[100px]"
          placeholderTextColor={SECONDARY_PALETTE[400]}
        />
        <Text className="mt-1 text-xs text-secondary-500 dark:text-secondary-400 text-right font-sans">
          {data.description.length}/500
        </Text>
      </FormField>
    </View>
  );
});

export default BasicInfoSection;
