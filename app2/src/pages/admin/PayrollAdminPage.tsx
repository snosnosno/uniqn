import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { useTranslation } from 'react-i18next';

interface Event {
    id: string;
    name: string;
}

interface Payroll {
    id: string;
    dealerId: string;
    dealerName?: string; 
    amount: number;
    status: string;
    workHours: number;
}

const PayrollAdminPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<string>('');
    const [payrolls, setPayrolls] = useState<Payroll[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchEvents = async () => {
            const eventsCollection = collection(db, 'events');
            const eventSnapshot = await getDocs(eventsCollection);
            const eventList = eventSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
            setEvents(eventList);
        };
        fetchEvents();
    }, []);

    const handleFetchPayrolls = async () => {
        if (!selectedEvent) return;
        setLoading(true);
        setError(null);
        try {
            const getPayrollsFunc = httpsCallable(functions, 'getPayrolls');
            const result: any = await getPayrollsFunc({ eventId: selectedEvent });
            
            const payrollsWithNames = await Promise.all(result.data.payrolls.map(async (p: Payroll) => {
                const userDocRef = doc(db, 'users', p.dealerId);
                const userDoc = await getDoc(userDocRef);
                return { ...p, dealerName: userDoc.exists() ? userDoc.data().name : t('payrollAdmin.unknownDealer') };
            }));
            setPayrolls(payrollsWithNames);

        } catch (err) {
            console.error('Error fetching payrolls:', err);
            setError(t('payrollAdmin.errorFetch'));
        } finally {
            setLoading(false);
        }
    };
    
    const handleCalculatePayrolls = async () => {
        if (!selectedEvent) return;
        setLoading(true);
        setError(null);
        try {
            const calculatePayrollsFunc = httpsCallable(functions, 'calculatePayrollsForEvent');
            await calculatePayrollsFunc({ eventId: selectedEvent });
            alert(t('payrollAdmin.alertSuccess'));
            handleFetchPayrolls(); // Refresh the list
        } catch (err) {
            console.error('Error calculating payrolls:', err);
            setError(t('payrollAdmin.errorCalculate'));
        } finally {
            setLoading(false);
        }
    };
    
    const formatCurrency = (amount: number) => {
        const locale = i18n.language === 'ko' ? 'ko-KR' : 'en-US';
        const currency = i18n.language === 'ko' ? 'KRW' : 'USD';
        return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
    }

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="max-w-6xl mx-auto bg-white p-8 rounded-lg shadow-xl">
                <h1 className="text-3xl font-bold text-gray-800 mb-6">{t('payrollAdmin.title')}</h1>
                
                <div className="flex items-center space-x-4 mb-6">
                    <select
                        value={selectedEvent}
                        onChange={(e) => setSelectedEvent(e.target.value)}
                        className="p-2 border rounded-md"
                    >
                        <option value="">{t('payrollAdmin.selectEvent')}</option>
                        {events.map(event => (
                            <option key={event.id} value={event.id}>{event.name}</option>
                        ))}
                    </select>
                    <button onClick={handleFetchPayrolls} className="btn btn-primary" disabled={!selectedEvent || loading}>
                        {loading ? t('payrollAdmin.buttonLoading') : t('payrollAdmin.buttonLoadPayrolls')}
                    </button>
                    <button onClick={handleCalculatePayrolls} className="btn btn-secondary" disabled={!selectedEvent || loading}>
                        {loading ? t('payrollAdmin.buttonCalculating') : t('payrollAdmin.buttonCalculateAll')}
                    </button>
                </div>

                {error && <p className="text-red-500">{error}</p>}

                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="py-2 px-4 border-b">{t('payrollAdmin.tableHeaderName')}</th>
                                <th className="py-2 px-4 border-b">{t('payrollAdmin.tableHeaderHours')}</th>
                                <th className="py-2 px-4 border-b">{t('payrollAdmin.tableHeaderAmount')}</th>
                                <th className="py-2 px-4 border-b">{t('payrollAdmin.tableHeaderStatus')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payrolls.map(payroll => (
                                <tr key={payroll.id}>
                                    <td className="py-2 px-4 border-b text-center">{payroll.dealerName}</td>
                                    <td className="py-2 px-4 border-b text-center">{payroll.workHours.toFixed(2)}</td>
                                    <td className="py-2 px-4 border-b text-center">{formatCurrency(payroll.amount)}</td>
                                    <td className="py-2 px-4 border-b text-center">{t(`payrollAdmin.status.${payroll.status.toLowerCase()}`)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PayrollAdminPage;
