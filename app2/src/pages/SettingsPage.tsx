/**
 * 설정 페이지
 *
 * @description
 * 사용자 계정 및 앱 설정 통합 페이지
 * - 동의 관리 (선택 동의 변경)
 * - 보안 설정 (비밀번호 변경, 로그인 알림)
 * - 계정 관리 (회원 탈퇴)
 * - 알림 설정 (별도 페이지 링크)
 * - 언어 설정
 *
 * @version 1.0.0
 * @since 2025-10-23
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ShieldCheckIcon,
  BellIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { ConsentSettings } from '../components/settings/ConsentSettings';
import { SecuritySettings } from '../components/settings/SecuritySettings';
import { AccountDangerZone } from '../components/settings/AccountDangerZone';

/**
 * 설정 탭 타입
 */
type SettingsTab = 'consent' | 'security' | 'notifications' | 'language' | 'account';

/**
 * 설정 페이지 컴포넌트
 */
const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<SettingsTab>('consent');

  /**
   * 뒤로 가기
   */
  const handleGoBack = () => {
    navigate(-1);
  };

  /**
   * 알림 설정 페이지로 이동
   */
  const handleNavigateToNotifications = () => {
    navigate('/app/notification-settings');
  };

  /**
   * 언어 변경
   */
  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
  };

  /**
   * 탭 메뉴
   */
  const tabs: Array<{
    id: SettingsTab;
    label: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  }> = [
    {
      id: 'consent',
      label: t('settings.tabs.consent'),
      icon: DocumentTextIcon,
    },
    {
      id: 'security',
      label: t('settings.tabs.security'),
      icon: ShieldCheckIcon,
    },
    {
      id: 'notifications',
      label: t('settings.tabs.notifications'),
      icon: BellIcon,
    },
    {
      id: 'language',
      label: t('settings.tabs.language'),
      icon: GlobeAltIcon,
    },
    {
      id: 'account',
      label: t('settings.tabs.account'),
      icon: ExclamationTriangleIcon,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <button
              onClick={handleGoBack}
              className="mr-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label={t('common.back')}
            >
              <ArrowLeftIcon className="h-6 w-6 text-gray-900 dark:text-gray-100" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t('settings.title')}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 사이드바 탭 */}
          <div className="lg:col-span-1">
            <nav className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-2 space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (tab.id === 'notifications') {
                        handleNavigateToNotifications();
                      } else {
                        setActiveTab(tab.id);
                      }
                    }}
                    className={`
                      w-full flex items-center space-x-3 px-4 py-3 rounded-lg
                      transition-colors text-left
                      ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }
                    `}
                    aria-label={tab.label}
                  >
                    <Icon
                      className={`h-5 w-5 ${
                        isActive ? 'text-blue-700' : 'text-gray-500'
                      }`}
                    />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* 콘텐츠 영역 */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm p-6">
              {/* 동의 설정 */}
              {activeTab === 'consent' && (
                <div>
                  <h2 className="text-2xl font-semibold mb-6">
                    {t('settings.consent.title')}
                  </h2>
                  <ConsentSettings />
                </div>
              )}

              {/* 보안 설정 */}
              {activeTab === 'security' && (
                <div>
                  <h2 className="text-2xl font-semibold mb-6">
                    {t('settings.security.title')}
                  </h2>
                  <SecuritySettings />
                </div>
              )}

              {/* 언어 설정 */}
              {activeTab === 'language' && (
                <div>
                  <h2 className="text-2xl font-semibold mb-6">
                    {t('settings.language.title')}
                  </h2>
                  <p className="text-gray-600 mb-6">
                    {t('settings.language.description')}
                  </p>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name="language"
                        value="ko"
                        checked={i18n.language === 'ko'}
                        onChange={() => handleLanguageChange('ko')}
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">한국어</div>
                        <div className="text-sm text-gray-500">Korean</div>
                      </div>
                    </label>
                    <label className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name="language"
                        value="en"
                        checked={i18n.language === 'en'}
                        onChange={() => handleLanguageChange('en')}
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">English</div>
                        <div className="text-sm text-gray-500">영어</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* 계정 관리 (위험 영역) */}
              {activeTab === 'account' && (
                <div>
                  <h2 className="text-2xl font-semibold mb-6">
                    {t('settings.account.title')}
                  </h2>
                  <AccountDangerZone />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
