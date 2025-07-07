import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

interface Event {
  id: string;
  name: string;
  // Let's be more flexible with date types from Firestore
  startDate: any;
  endDate: any;
  location: string;
  description: string;
}

const DealerEventsListPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  useEffect(() => {
    const q = query(collection(db, 'events'), where('status', '==', 'recruiting'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const eventsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Event[];
      setEvents(eventsList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching recruiting events: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Safely formats a date that could be a Firestore Timestamp, a Date object, or a date string.
   */
  const formatDate = (dateInput: any): string => {
    if (!dateInput) return t('dealerEvents.dateNotAvailable');
    
    const locale = i18n.language;

    // Check if it's a Firestore Timestamp and convert it
    if (typeof dateInput.toDate === 'function') {
      return dateInput.toDate().toLocaleDateString(locale, { dateStyle: 'medium' });
    }
    
    // Check if it's already a Date object
    if (dateInput instanceof Date) {
      return dateInput.toLocaleDateString(locale, { dateStyle: 'medium' });
    }

    // Try to parse it if it's a string
    const date = new Date(dateInput);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString(locale, { dateStyle: 'medium' });
    }

    return t('dealerEvents.dateInvalid');
  };
  
  if (loading) return <div className="p-6 text-center">{t('dealerEvents.loading')}</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">{t('dealerEvents.title')}</h1>
        {events.length > 0 ? (
          <div className="space-y-4">
            {events.map(event => (
              <div key={event.id} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <h2 className="text-xl font-bold text-gray-900">{event.name}</h2>
                <p className="text-sm text-gray-500 mt-1">{event.location}</p>
                <p className="text-sm text-gray-600 mt-2">
                  {formatDate(event.startDate)} - {formatDate(event.endDate)}
                </p>
                <p className="mt-4 text-gray-700">{event.description}</p>
                <div className="mt-4">
                  {/* TODO: Implement application logic */}
                  <button className="btn btn-primary">
                    {t('dealerEvents.applyButton')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">{t('dealerEvents.noEvents')}</p>
        )}
      </div>
    </div>
  );
};

export default DealerEventsListPage;
