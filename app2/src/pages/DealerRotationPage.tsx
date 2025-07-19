import { collection, query } from 'firebase/firestore';
import React, { useMemo } from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { useTranslation } from 'react-i18next';
import { FaUserCircle, FaTable, FaMugHot, FaUserClock } from 'react-icons/fa';

import { db } from '../firebase';


interface Staff {
  id: string;
  name: string;
  role: string;
  status: 'on_table' | 'available' | 'on_break';
  assignedTableId?: string;
  photoURL?: string;
}

interface Table {
  id: string;
  tableNumber: number;
  assignedDealerId?: string;
}

const StaffCard = ({ staff }: { staff: Staff }) => (
  <div className="flex items-center bg-gray-100 p-3 rounded-lg shadow-sm">
    {staff.photoURL ? (
      <img src={staff.photoURL} alt={staff.name} className="w-10 h-10 rounded-full mr-3" />
    ) : (
      <FaUserCircle className="w-10 h-10 text-gray-400 mr-3" />
    )}
    <div>
      <p className="font-semibold text-gray-800">{staff.name}</p>
      <p className="text-sm text-gray-500">{staff.role}</p>
    </div>
  </div>
);

const DealerRotationPage: React.FC = () => {
  const { t } = useTranslation();
  const staffQuery = useMemo(() => query(collection(db, 'staff')), []);
  const tablesQuery = useMemo(() => query(collection(db, 'tables')), []);
  
  const [staffSnap, staffLoading] = useCollection(staffQuery);
  const [tablesSnap, tablesLoading] = useCollection(tablesQuery);

  const allStaff = useMemo(() => staffSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Staff[] | undefined, [staffSnap]);
  const tables = useMemo(() => tablesSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Table[] | undefined, [tablesSnap]);

  const dealers = useMemo(() => (allStaff?.filter(s => s.role === 'Dealer') as Staff[] || []), [allStaff]);
  
  const onTableDealers = useMemo(() => dealers.filter(d => d.status === 'on_table'), [dealers]);
  const availableDealers = useMemo(() => dealers.filter(d => d.status === 'available'), [dealers]);
  const onBreakDealers = useMemo(() => dealers.filter(d => d.status === 'on_break'), [dealers]);

  const tablesWithDealers = useMemo(() => {
    if (!tables) return [];
    return tables.map(table => {
      const dealer = onTableDealers.find(d => d.id === table.assignedDealerId);
      return { ...table, dealer };
    });
  }, [tables, onTableDealers]);

  const loading = staffLoading || tablesLoading;

  if (loading) {
    return <div className="p-4 text-center">{t('dealerRotation.loading')}</div>;
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">{t('dealerRotation.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-blue-600 flex items-center">
            <FaTable className="mr-2"/> {t('dealerRotation.onTables')} ({onTableDealers.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {tablesWithDealers.map(table => (
              <div key={table.id} className="border border-gray-200 p-4 rounded-lg">
                <p className="font-bold text-lg text-gray-700">{t('dealerRotation.tableName', { tableNumber: table.tableNumber })}</p>
                {table.dealer ? <StaffCard staff={table.dealer} /> : <p className="text-sm text-gray-500 mt-2">{t('dealerRotation.noDealerAssigned')}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-green-600 flex items-center">
              <FaUserClock className="mr-2"/> {t('dealerRotation.availableDealers')} ({availableDealers.length})
            </h2>
            <div className="space-y-3">
              {availableDealers.map(dealer => <StaffCard key={dealer.id} staff={dealer} />)}
              {availableDealers.length === 0 && <p className="text-sm text-gray-500">{t('dealerRotation.noDealersAvailable')}</p>}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-yellow-600 flex items-center">
              <FaMugHot className="mr-2"/> {t('dealerRotation.onBreak')} ({onBreakDealers.length})
            </h2>
            <div className="space-y-3">
              {onBreakDealers.map(dealer => <StaffCard key={dealer.id} staff={dealer} />)}
              {onBreakDealers.length === 0 && <p className="text-sm text-gray-500">{t('dealerRotation.noDealersOnBreak')}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DealerRotationPage;