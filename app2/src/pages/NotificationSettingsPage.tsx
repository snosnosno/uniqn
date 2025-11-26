/**
 * 알림 설정 페이지
 *
 * @description
 * 사용자별 알림 설정을 관리하는 페이지
 * - 전체 알림 ON/OFF
 * - 카테고리별 설정 (System, Work, Schedule)
 * - 타입별 세부 설정
 * - 조용한 시간대 설정
 *
 * @version 1.0.0
 * @since 2025-10-15
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, BellIcon, BellSlashIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useNotificationSettings } from '../hooks/useNotificationSettings';
import { NotificationCategory } from '../types/notification';
import { toast } from '../utils/toast';
import { logger } from '../utils/logger';

/**
 * 알림 설정 페이지
 */
const NotificationSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    settings,
    loading,
    error,
    updateCategorySettings,
    updateTypeSettings,
    updateQuietHours,
    toggleGlobalEnabled,
  } = useNotificationSettings();

  const [saving, setSaving] = useState(false);

  /**
   * 카테고리 이름 매핑
   */
  const getCategoryName = (category: NotificationCategory): string => {
    const names: Record<NotificationCategory, string> = {
      system: t('notifications.categories.system'),
      work: t('notifications.categories.work'),
      schedule: t('notifications.categories.schedule'),
    };
    return names[category] || category;
  };

  /**
   * 카테고리 설명 매핑
   */
  const getCategoryDescription = (category: NotificationCategory): string => {
    const descriptions: Record<NotificationCategory, string> = {
      system: t('notifications.descriptions.system'),
      work: t('notifications.descriptions.work'),
      schedule: t('notifications.descriptions.schedule'),
    };
    return descriptions[category] || '';
  };

  /**
   * 알림 타입 이름 매핑
   */
  const getTypeName = (type: string): string => {
    const names: Record<string, string> = {
      job_posting_announcement: t('notifications.types.job_posting_announcement'),
      new_job_posting: t('notifications.types.new_job_posting'),
      system_announcement: t('notifications.types.system_announcement'),
      app_update: t('notifications.types.app_update'),
      job_application: t('notifications.types.job_application'),
      staff_approval: t('notifications.types.staff_approval'),
      staff_rejection: t('notifications.types.staff_rejection'),
      schedule_change: t('notifications.types.schedule_change'),
    };
    return names[type] || type;
  };

  /**
   * 카테고리별 알림 타입 매핑
   */
  const getTypesByCategory = (category: NotificationCategory): string[] => {
    const typeMap: Record<NotificationCategory, string[]> = {
      system: ['job_posting_announcement', 'new_job_posting', 'system_announcement', 'app_update'],
      work: ['job_application', 'staff_approval', 'staff_rejection'],
      schedule: ['schedule_change'],
    };
    return typeMap[category] || [];
  };

  /**
   * 전체 알림 토글 핸들러
   */
  const handleToggleGlobal = async () => {
    try {
      setSaving(true);
      await toggleGlobalEnabled();
      toast.success(t('notifications.settings.updated'));
    } catch (err) {
      logger.error('전체 알림 토글 실패', err as Error);
      toast.error(t('notifications.settings.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * 카테고리 토글 핸들러
   */
  const handleToggleCategory = async (category: NotificationCategory) => {
    if (!settings) return;

    try {
      setSaving(true);
      const currentEnabled = settings.categories[category].enabled;
      await updateCategorySettings(category, { enabled: !currentEnabled });
      toast.success(t('notifications.settings.updated'));
    } catch (err) {
      logger.error('카테고리 설정 업데이트 실패', err as Error);
      toast.error(t('notifications.settings.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * 알림 타입 토글 핸들러
   */
  const handleToggleType = async (type: string) => {
    if (!settings) return;

    try {
      setSaving(true);
      const currentEnabled = settings.types?.[type] ?? true;
      await updateTypeSettings(type, !currentEnabled);
      toast.success(t('notifications.settings.updated'));
    } catch (err) {
      logger.error('알림 타입 설정 업데이트 실패', err as Error);
      toast.error(t('notifications.settings.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * 조용한 시간대 토글 핸들러
   */
  const handleToggleQuietHours = async () => {
    if (!settings?.quietHours) return;

    try {
      setSaving(true);
      await updateQuietHours({
        ...settings.quietHours,
        enabled: !settings.quietHours.enabled,
      });
      toast.success(t('notifications.settings.updated'));
    } catch (err) {
      logger.error('조용한 시간대 설정 업데이트 실패', err as Error);
      toast.error(t('notifications.settings.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * 조용한 시간대 시간 변경 핸들러
   */
  const handleQuietHoursTimeChange = async (field: 'start' | 'end', value: string) => {
    if (!settings?.quietHours) return;

    try {
      setSaving(true);
      await updateQuietHours({
        ...settings.quietHours,
        [field]: value,
      });
      toast.success(t('notifications.settings.updated'));
    } catch (err) {
      logger.error('조용한 시간대 시간 변경 실패', err as Error);
      toast.error(t('notifications.settings.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">
            {t('notifications.settings.loadFailed')}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-800 border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <button
              onClick={() => navigate(-1)}
              className="mr-4 p-2 hover:bg-gray-100 dark:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="h-6 w-6" />
            </button>
            <h1 className="text-xl font-semibold">{t('notifications.settings.title')}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* 전체 알림 설정 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {settings.enabled ? (
                <BellIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              ) : (
                <BellSlashIcon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
              )}
              <div>
                <h2 className="text-lg font-semibold">
                  {t('notifications.settings.globalEnabled')}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {t('notifications.settings.globalDescription')}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleGlobal}
              disabled={saving}
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full
                transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                ${settings.enabled ? 'bg-blue-600 dark:bg-blue-700' : 'bg-gray-200 dark:bg-gray-600'}
                ${saving ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-800 transition-transform
                  ${settings.enabled ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>
        </div>

        {/* 카테고리별 설정 */}
        {(['system', 'work', 'schedule'] as NotificationCategory[]).map((category) => (
          <div key={category} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            {/* 카테고리 헤더 */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{getCategoryName(category)}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {getCategoryDescription(category)}
                </p>
              </div>
              <button
                onClick={() => handleToggleCategory(category)}
                disabled={saving || !settings.enabled}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full
                  transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  ${settings.categories[category].enabled ? 'bg-blue-600 dark:bg-blue-700' : 'bg-gray-200 dark:bg-gray-600'}
                  ${saving || !settings.enabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-800 transition-transform
                    ${settings.categories[category].enabled ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>

            {/* 타입별 세부 설정 */}
            {settings.categories[category].enabled && (
              <div className="space-y-3 mt-4 pt-4 border-t">
                {getTypesByCategory(category).map((type) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-200">
                      {getTypeName(type)}
                    </span>
                    <button
                      onClick={() => handleToggleType(type)}
                      disabled={saving || !settings.enabled}
                      className={`
                        relative inline-flex h-5 w-9 items-center rounded-full
                        transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                        ${(settings.types?.[type] ?? true) ? 'bg-blue-600 dark:bg-blue-700' : 'bg-gray-200 dark:bg-gray-600'}
                        ${saving || !settings.enabled ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      <span
                        className={`
                          inline-block h-3 w-3 transform rounded-full bg-white dark:bg-gray-800 transition-transform
                          ${(settings.types?.[type] ?? true) ? 'translate-x-5' : 'translate-x-1'}
                        `}
                      />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* 조용한 시간대 설정 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <ClockIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="text-lg font-semibold">{t('notifications.settings.quietHours')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {t('notifications.settings.quietHoursDescription')}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleQuietHours}
              disabled={saving || !settings.enabled}
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full
                transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                ${settings.quietHours?.enabled ? 'bg-blue-600 dark:bg-blue-700' : 'bg-gray-200 dark:bg-gray-600'}
                ${saving || !settings.enabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-800 transition-transform
                  ${settings.quietHours?.enabled ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>

          {/* 시간 선택 */}
          {settings.quietHours?.enabled && (
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('notifications.settings.startTime')}
                </label>
                <input
                  type="time"
                  value={settings.quietHours.start}
                  onChange={(e) => handleQuietHoursTimeChange('start', e.target.value)}
                  disabled={saving || !settings.enabled}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('notifications.settings.endTime')}
                </label>
                <input
                  type="time"
                  value={settings.quietHours.end}
                  onChange={(e) => handleQuietHoursTimeChange('end', e.target.value)}
                  disabled={saving || !settings.enabled}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationSettingsPage;
