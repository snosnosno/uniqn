import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import { useTranslation } from 'react-i18next';
import { callFunctionLazy } from '../utils/firebase-dynamic';

import Modal from './Modal';

interface Staff {
  id: string;
  name: string;
  email: string;
  role: string;
  experience?: string;
  history?: string;
  notes?: string;
  nationality?: string;
  age?: number;
  bankName?: string;
  bankAccount?: string;
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: Staff | null;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ isOpen, onClose, user }) => {
  const { t } = useTranslation();
  
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
      { code: 'ES', name: 'Spain', flag: '🇪🇸' }
    ];
  
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    experience: '',
    history: '',
    notes: '',
    nationality: '',
    age: '',
    bankName: '',
    bankAccount: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const experienceLevels = [
    "1년 미만",
    "1년",
    "2년",
    "3년",
    "4년",
    "5년 이상",
    "10년 이상"
  ];

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        role: user.role || '',
        experience: user.experience || '',
        history: user.history || '',
        notes: user.notes || '',
        nationality: user.nationality || '',
        age: user.age ? user.age.toString() : '',
        bankName: user.bankName || '',
        bankAccount: user.bankAccount || '',
      });
    }
  }, [user]);

  if (!user) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await callFunctionLazy('updateUser', { uid: user.id, ...formData });
      alert(t('editUserModal.updateSuccess'));
      onClose();
    } catch (err: any) {
      logger.error('Error updating user:', err instanceof Error ? err : new Error(String(err)), { component: 'EditUserModal' });
      setError(err.message || t('editUserModal.updateError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('editUserModal.title')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">{t('editUserModal.labelName')}</label>
            <input
              type="text"
              name="name"
              id="name"
              value={formData.name}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">{t('editUserModal.labelEmail')}</label>
            <input
              type="email"
              name="email"
              id="email"
              value={user.email}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100"
              disabled
            />
          </div>
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700">{t('editUserModal.labelRole')}</label>
            <select
              name="role"
              id="role"
              value={formData.role}
              onChange={handleChange}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md"
            >
              <option value="dealer">{t('roles.dealer')}</option>
              <option value="manager">{t('roles.manager')}</option>
              <option value="admin">{t('roles.admin')}</option>
              <option value="pending_manager">{t('roles.pending_manager')}</option>
            </select>
          </div>
          <div>
            <label htmlFor="nationality" className="block text-sm font-medium text-gray-700">{t('profilePage.nationality', '국적')}</label>
            <select
              name="nationality"
              id="nationality"
              value={formData.nationality}
              onChange={handleChange}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md"
            >
              <option value="">{t('profilePage.selectNationality', '국적을 선택하세요')}</option>
              {countries.map(country => (
                <option key={country.code} value={country.code}>
                  {country.flag} {country.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="age" className="block text-sm font-medium text-gray-700">{t('profilePage.age', '나이')}</label>
            <input
              type="number"
              name="age"
              id="age"
              value={formData.age}
              onChange={handleChange}
              min="18"
              max="100"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
            />
          </div>
          <div>
            <label htmlFor="bankName" className="block text-sm font-medium text-gray-700">{t('profilePage.bankName', '은행명')}</label>
            <input
              type="text"
              name="bankName"
              id="bankName"
              value={formData.bankName}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
            />
          </div>
          <div>
            <label htmlFor="bankAccount" className="block text-sm font-medium text-gray-700">{t('profilePage.bankAccount', '계좌번호')}</label>
            <input
              type="text"
              name="bankAccount"
              id="bankAccount"
              value={formData.bankAccount}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
            />
          </div>
          <div>
            <label htmlFor="experience" className="block text-sm font-medium text-gray-700">{t('profilePage.experience')}</label>
            <select
                name="experience"
                id="experience"
                value={formData.experience}
                onChange={handleChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md"
            >
                <option value="">{t('profilePage.selectExperience', '경력을 선택하세요')}</option>
                {experienceLevels.map(level => (
                    <option key={level} value={level}>{level}</option>
                ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="history" className="block text-sm font-medium text-gray-700">{t('profilePage.history')}</label>
            <textarea
              name="history"
              id="history"
              value={formData.history}
              onChange={handleChange}
              rows={4}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              placeholder={t('profilePage.historyPlaceholder')}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">{t('profilePage.notes', '기타 사항')}</label>
            <textarea
              name="notes"
              id="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
            />
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end space-x-4 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isSubmitting ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default EditUserModal;