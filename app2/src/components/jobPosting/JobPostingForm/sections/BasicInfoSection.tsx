/**
 * BasicInfoSection - 구인공고 기본 정보 섹션
 *
 * 제목, 장소, 설명, 공고 타입 입력 UI
 *
 * @see app2/src/types/jobPosting/basicInfoProps.ts
 *
 * @example
 * ```tsx
 * // 사용 예시
 * const basicInfoData = {
 *   title: '강남 토너먼트 딜러 모집',
 *   location: '강남',
 *   district: '역삼동',
 *   description: '경력 1년 이상',
 *   postingType: 'regular' as const
 * };
 *
 * const basicInfoHandlers = {
 *   onFormChange: (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value })),
 *   onLocationChange: (location, district) => setFormData(prev => ({ ...prev, location, district })),
 *   onPostingTypeChange: (type) => setFormData(prev => ({ ...prev, postingType: type }))
 * };
 *
 * <BasicInfoSection
 *   data={basicInfoData}
 *   handlers={basicInfoHandlers}
 *   validation={{ errors: {}, touched: {} }}
 * />
 * ```
 */

import React from 'react';
import { BasicInfoSectionProps } from '../../../../types/jobPosting/basicInfoProps';
import Input from '../../../ui/Input';
import { Select } from '../../../common/Select';
import { LOCATIONS } from '../../../../utils/jobPosting/jobPostingHelpers';

/**
 * BasicInfoSection 컴포넌트 (React.memo 적용)
 *
 * Props Grouping 패턴:
 * - data: 기본 정보 데이터 (title, location, description, postingType)
 * - handlers: 이벤트 핸들러 (onFormChange, onLocationChange, onPostingTypeChange)
 * - validation: 검증 에러 (errors, touched) - 선택적
 *
 * @component
 * @param {BasicInfoSectionProps} props - Props Grouping 패턴
 * @param {BasicInfoData} props.data - 기본 정보 데이터
 * @param {BasicInfoHandlers} props.handlers - 이벤트 핸들러
 * @param {BasicInfoValidation} [props.validation] - 검증 상태 (선택)
 * @returns {React.ReactElement} 기본 정보 입력 섹션
 */
const BasicInfoSection: React.FC<BasicInfoSectionProps> = React.memo(({
  data,
  handlers,
  validation
}) => {
  return (
    <div className="space-y-4">
      {/* 제목 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          공고 제목 <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <Input
          type="text"
          name="title"
          value={data.title}
          onChange={handlers.onFormChange}
          placeholder="예: 강남 토너먼트 딜러 모집"
          maxLength={100}
          required
        />
        {validation?.errors.title && validation?.touched.title && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {validation.errors.title}
          </p>
        )}
      </div>

      {/* 공고 타입 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          공고 타입 <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* 정기 공고 */}
          <label className={`
            relative flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all
            ${data.postingType === 'regular'
              ? 'border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }
          `}>
            <input
              type="radio"
              name="postingType"
              value="regular"
              checked={data.postingType === 'regular'}
              onChange={handlers.onFormChange}
              className="sr-only"
            />
            <div className="text-center">
              <div className="text-2xl mb-1">🔁</div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">정기</div>
            </div>
          </label>

          {/* 고정 공고 */}
          <label className={`
            relative flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all
            ${data.postingType === 'fixed'
              ? 'border-yellow-500 dark:border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }
          `}>
            <input
              type="radio"
              name="postingType"
              value="fixed"
              checked={data.postingType === 'fixed'}
              onChange={handlers.onFormChange}
              className="sr-only"
            />
            <div className="text-center">
              <div className="text-2xl mb-1">📌</div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">고정</div>
              <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">유료</div>
            </div>
          </label>

          {/* 대회 공고 */}
          <label className={`
            relative flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all
            ${data.postingType === 'tournament'
              ? 'border-purple-500 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }
          `}>
            <input
              type="radio"
              name="postingType"
              value="tournament"
              checked={data.postingType === 'tournament'}
              onChange={handlers.onFormChange}
              className="sr-only"
            />
            <div className="text-center">
              <div className="text-2xl mb-1">🏆</div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">대회</div>
              <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">승인 필요</div>
            </div>
          </label>

          {/* 긴급 공고 */}
          <label className={`
            relative flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all
            ${data.postingType === 'urgent'
              ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }
          `}>
            <input
              type="radio"
              name="postingType"
              value="urgent"
              checked={data.postingType === 'urgent'}
              onChange={handlers.onFormChange}
              className="sr-only"
            />
            <div className="text-center">
              <div className="text-2xl mb-1">🚨</div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">긴급</div>
              <div className="text-xs text-red-600 dark:text-red-400 mt-1">5칩</div>
            </div>
          </label>
        </div>
        {validation?.errors.postingType && validation?.touched.postingType && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {validation.errors.postingType}
          </p>
        )}
      </div>

      {/* 지역 및 상세 주소 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            지역 <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <Select
            name="location"
            value={data.location}
            onChange={(value) => handlers.onLocationChange(value, data.district)}
            options={LOCATIONS.map(location => ({ value: location, label: location }))}
            required
          />
          {validation?.errors.location && validation?.touched.location && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {validation.errors.location}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            시/군/구
          </label>
          <Input
            type="text"
            name="district"
            value={data.district || ''}
            onChange={(e) => handlers.onLocationChange(data.location, e.target.value)}
            placeholder="시/군/구를 입력하세요"
            maxLength={25}
          />
        </div>
      </div>

      {/* 상세 주소 */}
      {data.detailedAddress !== undefined && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            상세 주소
          </label>
          <Input
            type="text"
            name="detailedAddress"
            value={data.detailedAddress || ''}
            onChange={handlers.onFormChange}
            placeholder="상세 주소를 입력하세요"
            maxLength={200}
          />
        </div>
      )}

      {/* 공고 설명 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          공고 설명 <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <textarea
          name="description"
          value={data.description}
          onChange={handlers.onFormChange}
          placeholder="근무 조건, 업무 내용 등을 상세히 작성해주세요"
          rows={5}
          maxLength={2000}
          required
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
        />
        {validation?.errors.description && validation?.touched.description && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {validation.errors.description}
          </p>
        )}
      </div>

      {/* 문의 연락처 */}
      {data.contactPhone !== undefined && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            문의 연락처
          </label>
          <Input
            type="text"
            name="contactPhone"
            value={data.contactPhone || ''}
            onChange={handlers.onFormChange}
            placeholder="010-0000-0000"
            maxLength={25}
          />
        </div>
      )}
    </div>
  );
});

BasicInfoSection.displayName = 'BasicInfoSection';

export default BasicInfoSection;
