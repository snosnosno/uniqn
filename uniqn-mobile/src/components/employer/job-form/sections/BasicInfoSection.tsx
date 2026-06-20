/**
 * UNIQN Mobile - 공고 작성 기본 정보 섹션
 *
 * @description 공고 타입, 제목, 장소, 연락처 등 기본 정보 입력
 * @version 1.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Input, FormField } from '@/components';
import { MapPinIcon, PhoneIcon, ChevronRightIcon } from '@/components/icons';
import type { JobPostingFormData, Location, PostingType } from '@/types';
import { PostingTypeSelector } from '../shared';
import { RegionSelectModal } from '../modals';
import { formatPhoneNumber } from '@/utils/phone';
import { findRegionByAddress, getRegionLabel } from '@/constants/regions';

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
  const [regionModalVisible, setRegionModalVisible] = useState(false);

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
  // region 은 default 를 두지 않는다 — 호출부가 보존/갱신/해제를 명시 전달(default 시 해제 불가).
  const handleUpdateLocation = useCallback(
    (
      name: string,
      address: string,
      detailedAddress: string = getDetailedAddressValue(dataRef.current),
      region?: string
    ) => {
      if (name.trim()) {
        const location: Location = {
          // Preserve in-progress whitespace while typing. Serialization trims before persistence.
          name,
          address,
          district: address,
          ...(region ? { region } : {}),
          ...(detailedAddress ? { detailedAddress } : {}),
        };
        onUpdate({ location, detailedAddress });
      } else {
        onUpdate({ location: null, detailedAddress });
      }
    },
    [onUpdate]
  );

  // 장소명 변경 (기존 지역 보존)
  const handleLocationNameChange = useCallback(
    (name: string) => {
      setLocationName(name);
      handleUpdateLocation(name, locationAddress, undefined, dataRef.current.location?.region);
    },
    [locationAddress, handleUpdateLocation]
  );

  // 장소 주소 변경 (지역 미설정 시 주소에서 자동 제안)
  const handleLocationAddressChange = useCallback(
    (address: string) => {
      setLocationAddress(address);
      const region = dataRef.current.location?.region ?? findRegionByAddress(address)?.slug;
      handleUpdateLocation(locationName, address, undefined, region);
    },
    [locationName, handleUpdateLocation]
  );

  // 지역 선택 (null = 해제)
  const handleRegionSelect = useCallback(
    (slug: string | null) => {
      handleUpdateLocation(locationName, locationAddress, undefined, slug ?? undefined);
    },
    [locationName, locationAddress, handleUpdateLocation]
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
      <FormField label="공고 제목" required error={errors.title}>
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
      <FormField label="근무 장소명" required error={errors.location}>
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
      <FormField label="근무 장소 주소" required error={errors.locationAddress}>
        <Input
          placeholder="예: 서울시 강남구 테헤란로 123"
          value={locationAddress}
          onChangeText={handleLocationAddressChange}
          accessibilityLabel="근무 장소 주소"
          testID="job-posting-location-address-input"
          maxLength={200}
        />
      </FormField>

      {/* 지역 선택 (선택) — 지역 필터 노출용. 주소 입력 시 자동 제안 */}
      <FormField label="지역" error={errors.region}>
        <Pressable
          onPress={() => setRegionModalVisible(true)}
          className="min-h-[44px] flex-row items-center justify-between rounded-lg border-2 border-secondary-300 bg-white px-4 py-3 active:opacity-70 dark:border-surface-overlay dark:bg-surface"
          accessibilityRole="button"
          accessibilityLabel="지역 선택"
          testID="job-posting-region-selector"
        >
          <View className="flex-row items-center">
            <MapPinIcon size={20} color={SECONDARY_PALETTE[500]} />
            <Text
              className={`ml-2 text-base font-sans ${
                data.location?.region
                  ? 'text-content-primary'
                  : 'text-secondary-400 dark:text-secondary-500'
              }`}
            >
              {getRegionLabel(data.location?.region) ?? '지역 선택 (선택 사항)'}
            </Text>
          </View>
          <ChevronRightIcon size={18} color={SECONDARY_PALETTE[400]} />
        </Pressable>
      </FormField>

      {/* 상세 주소 */}
      <FormField label="상세 주소" error={errors.detailedAddress}>
        <Input
          placeholder="건물명, 층수 등 (선택)"
          value={getDetailedAddressValue(data)}
          onChangeText={(detailedAddress) =>
            handleUpdateLocation(
              locationName,
              locationAddress,
              detailedAddress,
              dataRef.current.location?.region
            )
          }
          accessibilityLabel="상세 주소"
          testID="job-posting-detailed-address-input"
          maxLength={200}
        />
      </FormField>

      {/* 연락처 */}
      <FormField label="문의 연락처" required error={errors.contactPhone}>
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
      <FormField label="공고 설명" error={errors.description}>
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
          className="px-4 py-3 bg-surface-card border border-divider rounded-lg text-content-primary dark:text-off-white min-h-[100px]"
          placeholderTextColor={SECONDARY_PALETTE[400]}
        />
        <Text className="mt-1 text-xs text-secondary-500 dark:text-secondary-400 text-right font-sans">
          {data.description.length}/500
        </Text>
      </FormField>

      <RegionSelectModal
        visible={regionModalVisible}
        onClose={() => setRegionModalVisible(false)}
        onSelect={handleRegionSelect}
        selectedSlug={data.location?.region}
      />
    </View>
  );
});

export default BasicInfoSection;
