/**
 * UserDetailModal - 사용자 상세 정보 모달
 *
 * 사용자 정보를 읽기 전용으로 표시합니다.
 *
 * @version 1.0
 * @since 2025-01-01
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { logger } from '../../utils/logger';
import Modal, { ModalFooter } from '../ui/Modal';
import { UserCircleIcon } from '@heroicons/react/24/outline';

/** 사용자 기본 정보 (UserManagementPage에서 전달) */
interface UserBasic {
  id: string;
  name: string;
  email: string;
  role: string;
}

/** 확장된 사용자 프로필 정보 */
interface UserProfile extends UserBasic {
  phone?: string;
  profileImageUrl?: string;
  experience?: string;
  nationality?: string;
  age?: number;
  history?: string;
  notes?: string;
  bankName?: string;
  bankAccount?: string;
}

interface UserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserBasic | null;
}

/** 국가 목록 */
const countries = [
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
];

const UserDetailModal: React.FC<UserDetailModalProps> = ({ isOpen, onClose, user }) => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  // 사용자 프로필 로드
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;

      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', user.id));
        if (userDoc.exists()) {
          setProfile({
            id: userDoc.id,
            ...userDoc.data(),
          } as UserProfile);
        } else {
          setProfile(user as UserProfile);
        }
      } catch (error) {
        logger.error(
          '사용자 프로필 로드 오류',
          error instanceof Error ? error : new Error(String(error)),
          { component: 'UserDetailModal', userId: user.id }
        );
        setProfile(user as UserProfile);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && user) {
      fetchProfile();
    }
  }, [isOpen, user]);

  if (!user) return null;

  const displayProfile = profile || (user as UserProfile);

  /** 국적 표시 */
  const getNationalityDisplay = (nationality?: string) => {
    if (!nationality) return t('userDetail.noData');
    const country = countries.find((c) => c.code === nationality);
    return country ? `${country.flag} ${country.name}` : nationality;
  };

  /** 역할 표시 */
  const getRoleDisplay = (role?: string) => {
    if (!role) return t('userDetail.noData');
    const roleMap: Record<string, string> = {
      admin: t('roles.admin', '관리자'),
      employer: t('roles.employer', '구인자'),
      staff: t('roles.staff', '스태프'),
    };
    return roleMap[role] || role;
  };

  /** 정보 표시 행 */
  const InfoRow = ({
    label,
    value,
    isMultiline = false,
  }: {
    label: string;
    value?: string | number | null;
    isMultiline?: boolean;
  }) => (
    <div className={isMultiline ? 'col-span-2' : ''}>
      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd
        className={`mt-1 text-sm text-gray-900 dark:text-gray-100 ${isMultiline ? 'whitespace-pre-wrap' : ''}`}
      >
        {value || t('userDetail.noData')}
      </dd>
    </div>
  );

  const footerButtons = (
    <ModalFooter>
      <button
        onClick={onClose}
        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
      >
        {t('common.close')}
      </button>
    </ModalFooter>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('userDetail.title')}
      size="lg"
      footer={footerButtons}
      aria-label={t('userDetail.title')}
    >
      <div className="space-y-6">
        {/* 로딩 */}
        {loading && (
          <div className="absolute inset-0 bg-white dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400" />
          </div>
        )}

        {/* 프로필 헤더 */}
        <div className="flex items-center space-x-4">
          {displayProfile.profileImageUrl ? (
            <img
              src={displayProfile.profileImageUrl}
              alt={displayProfile.name}
              className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <UserCircleIcon className="w-12 h-12 text-gray-400 dark:text-gray-500" />
            </div>
          )}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {displayProfile.name}
            </h3>
            <span className="inline-block mt-1 px-2 py-1 text-sm rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              {getRoleDisplay(displayProfile.role)}
            </span>
          </div>
        </div>

        {/* 기본 정보 */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {t('userDetail.basicInfo')}
          </h4>
          <dl className="grid grid-cols-2 gap-4">
            <InfoRow label={t('common.email')} value={displayProfile.email} />
            <InfoRow label={t('common.phone')} value={displayProfile.phone} />
            <InfoRow
              label={t('profilePage.nationality', '국적')}
              value={getNationalityDisplay(displayProfile.nationality)}
            />
            <InfoRow
              label={t('profilePage.age', '나이')}
              value={displayProfile.age ? `${displayProfile.age}세` : undefined}
            />
          </dl>
        </div>

        {/* 경력 정보 */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {t('userDetail.experience')}
          </h4>
          <dl>
            <InfoRow label={t('profilePage.experience')} value={displayProfile.experience} />
          </dl>
        </div>

        {/* 히스토리 */}
        {displayProfile.history && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {t('userDetail.history')}
            </h4>
            <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
              {displayProfile.history}
            </p>
          </div>
        )}

        {/* 은행 정보 */}
        {(displayProfile.bankName || displayProfile.bankAccount) && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {t('userDetail.bankInfo')}
            </h4>
            <dl className="grid grid-cols-2 gap-4">
              <InfoRow
                label={t('profilePage.bankName', '은행명')}
                value={displayProfile.bankName}
              />
              <InfoRow
                label={t('profilePage.bankAccount', '계좌번호')}
                value={displayProfile.bankAccount}
              />
            </dl>
          </div>
        )}

        {/* 비고 */}
        {displayProfile.notes && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {t('userDetail.notes')}
            </h4>
            <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
              {displayProfile.notes}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default UserDetailModal;
