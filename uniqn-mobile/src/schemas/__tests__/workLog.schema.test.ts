import { Timestamp } from 'firebase/firestore';
import { parseWorkLogDocument } from '../workLog.schema';

describe('workLog.schema fixed compatibility', () => {
  it('parses canonical fixed worklogs with null date/timeSlot and keeps the fixed flag', () => {
    const parsed = parseWorkLogDocument({
      id: 'wl-fixed',
      staffId: 'staff-1',
      jobPostingId: 'job-1',
      date: null,
      staffName: 'Alice',
      staffNickname: null,
      staffPhotoURL: null,
      checkInTime: null,
      checkOutTime: null,
      status: 'scheduled',
      role: 'dealer',
      customRole: null,
      notes: null,
      timeSlot: null,
      isFixedPosting: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    expect(parsed).toEqual(
      expect.objectContaining({
        id: 'wl-fixed',
        date: '',
        timeSlot: undefined,
        isFixedPosting: true,
        customRole: undefined,
      })
    );
  });
});
