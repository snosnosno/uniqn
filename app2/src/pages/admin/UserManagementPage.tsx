import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { logger } from '../../utils/logger';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import EditUserModal from '../../components/EditUserModal';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { callFunctionLazy } from '../../utils/firebase-dynamic';

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
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    if (!isAdmin) {
        setLoading(false);
        return;
    };

    const q = query(collection(db, 'users'), where('role', 'in', ['admin', 'dealer', 'manager', 'pending_manager']));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const list: User[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as User);
      });
      setUserList(list);
      setLoading(false);
    }, (err) => {
        logger.error('Error fetching user list: ', err instanceof Error ? err : new Error(String(error)), { component: 'UserManagementPage' });
        setError(t('userManagement.fetchError'));
        setLoading(false);
    });

    return () => unsubscribe();
  }, [isAdmin, t]);

  const handleDelete = async (userId: string) => {
    if (!window.confirm(t('userManagement.confirmDelete'))) {
        return;
    }
    
    setError(null);
    try {
        await callFunctionLazy('deleteUser', { uid: userId });
        alert(t('userManagement.deleteSuccess'));
    } catch (err: any) {
        logger.error('Error deleting user:', err instanceof Error ? err : new Error(String(err)), { component: 'UserManagementPage' });
        setError(err.message || t('userManagement.deleteError'));
    }
  };

  const handleOpenEditModal = (user: User) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setSelectedUser(null);
    setIsEditModalOpen(false);
  };

  if (loading) {
    return <div className="p-6">{t('userManagement.loading')}</div>;
  }

  if (error) {
      return <div className="p-6 text-red-500">{error}</div>
  }

  if (!isAdmin) {
      return <div className="p-6 text-red-500">{t('userManagement.accessDenied')}</div>
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">{t('userManagement.title')}</h1>
                <Link to="/admin/staff/new" className="btn btn-primary">
                    {t('userManagement.addNew')}
                </Link>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md">
                <ul className="divide-y divide-gray-200">
                    {userList.length > 0 ? userList.map(user => (
                        <li key={user.id} className="p-4 flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-gray-900">{user.name}</p>
                                <p className="text-sm text-gray-500">{user.email}</p>
                            </div>
                            <div className="flex items-center space-x-4">
                                <span className="text-sm capitalize text-gray-600 bg-gray-200 px-2 py-1 rounded-full">{user.role}</span>
                                <button onClick={() => handleOpenEditModal(user)} className="text-blue-600 hover:text-blue-800">{t('userManagement.edit')}</button>
                                <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-red-800">{t('userManagement.delete')}</button>
                            </div>
                        </li>
                    )) : (
                        <p className="text-center text-gray-500 py-4">{t('userManagement.noUsersFound')}</p>
                    )}
                </ul>
            </div>
        </div>
        
        {isEditModalOpen && selectedUser ? <EditUserModal 
                isOpen={isEditModalOpen}
                onClose={handleCloseEditModal}
                user={selectedUser}
            /> : null}
    </div>
  );
};

export default UserManagementPage;
