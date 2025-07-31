import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { db } from '../../firebase';
import { callFunctionLazy } from '../../utils/firebase-dynamic';
import { JobPosting } from '../../types/jobPosting';

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
    const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
    const [selectedJobPosting, setSelectedJobPosting] = useState<string>('');
    const [payrolls, setPayrolls] = useState<Payroll[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchJobPostings = async () => {
            const jobPostingsCollection = collection(db, 'jobPostings');
            const jobPostingSnapshot = await getDocs(jobPostingsCollection);
            const jobPostingList = jobPostingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JobPosting));
            setJobPostings(jobPostingList);
        };
        fetchJobPostings();
    }, []);

    const handleFetchPayrolls = async () => {
        if (!selectedJobPosting) return;
        setLoading(true);
        setError(null);
        try {
            const result: any = await callFunctionLazy('getPayrolls', { jobPostingId: selectedJobPosting });
            
            const payrollsWithNames = await Promise.all(result.payrolls.map(async (p: Payroll) => {
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
        if (!selectedJobPosting) return;
        setLoading(true);
        setError(null);
        try {
            await callFunctionLazy('calculatePayrollsForJobPosting', { jobPostingId: selectedJobPosting });
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
                        value={selectedJobPosting}
                        onChange={(e) => setSelectedJobPosting(e.target.value)}
                        className="p-2 border rounded-md"
                    >
                        <option value="">공고 선택</option>
                        {jobPostings.map(jobPosting => (
                            <option key={jobPosting.id} value={jobPosting.id}>{jobPosting.title}</option>
                        ))}
                    </select>
                    <button onClick={handleFetchPayrolls} className="btn btn-primary" disabled={!selectedJobPosting || loading}>
                        {loading ? t('payrollAdmin.buttonLoading') : t('payrollAdmin.buttonLoadPayrolls')}
                    </button>
                    <button onClick={handleCalculatePayrolls} className="btn btn-secondary" disabled={!selectedJobPosting || loading}>
                        {loading ? t('payrollAdmin.buttonCalculating') : t('payrollAdmin.buttonCalculateAll')}
                    </button>
                </div>

                {error ? <p className="text-red-500">{error}</p> : null}

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
