import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { logger } from '../../utils/logger';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import UserDetailModal from '../../components/modals/UserDetailModal';
import PenaltyModal from '../../components/modals/PenaltyModal';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

const UserManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const [userList, setUserList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAdmin } = useAuth();

  // 모달 상태
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPenaltyModalOpen, setIsPenaltyModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'users'), where('role', 'in', ['admin', 'staff', 'employer']));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const list: User[] = [];
        querySnapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as User);
        });
        setUserList(list);
        setLoading(false);
      },
      (err) => {
        logger.error(
          'Error fetching user list: ',
          err instanceof Error ? err : new Error(String(err)),
          { component: 'UserManagementPage' }
        );
        setError(t('userManagement.fetchError'));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAdmin, t]);

  // 상세 모달 열기
  const handleViewDetail = (user: User) => {
    setSelectedUser(user);
    setIsDetailModalOpen(true);
  };

  // 패널티 모달 열기
  const handleOpenPenalty = (user: User) => {
    setSelectedUser(user);
    setIsPenaltyModalOpen(true);
  };

  // 모달 닫기
  const handleCloseDetailModal = () => {
    setSelectedUser(null);
    setIsDetailModalOpen(false);
  };

  const handleClosePenaltyModal = () => {
    setSelectedUser(null);
    setIsPenaltyModalOpen(false);
  };

  if (loading) {
    return <div className="p-6">{t('userManagement.loading')}</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500 dark:text-red-400">{error}</div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-red-500 dark:text-red-400">{t('userManagement.accessDenied')}</div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
            {t('userManagement.title')}
          </h1>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {userList.length > 0 ? (
              userList.map((user) => (
                <li key={user.id} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{user.name}</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm capitalize text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full">
                      {user.role}
                    </span>
                    <button
                      onClick={() => handleViewDetail(user)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                    >
                      {t('common.detail')}
                    </button>
                    <button
                      onClick={() => handleOpenPenalty(user)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                    >
                      {t('penalty.button')}
                    </button>
                  </div>
                </li>
              ))
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                {t('userManagement.noUsersFound')}
              </p>
            )}
          </ul>
        </div>
      </div>

      {/* 상세 모달 */}
      <UserDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        user={selectedUser}
      />

      {/* 패널티 모달 */}
      <PenaltyModal
        isOpen={isPenaltyModalOpen}
        onClose={handleClosePenaltyModal}
        user={selectedUser}
      />
    </div>
  );
};

export default UserManagementPage;
