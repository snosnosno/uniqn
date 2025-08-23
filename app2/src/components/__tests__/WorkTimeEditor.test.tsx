import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkTimeEditor from '../WorkTimeEditor';
import { render } from '../../test-utils/test-utils';
import { updateDoc, setDoc, Timestamp } from 'firebase/firestore';

// Firebase 함수 모킹
jest.mock('firebase/firestore', () => ({
  updateDoc: jest.fn(() => Promise.resolve()),
  setDoc: jest.fn(() => Promise.resolve()),
  getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
  doc: jest.fn(() => ({ id: 'mock-doc' })),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ 
      toDate: () => new Date(),
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0
    })),
    fromDate: jest.fn((date: Date) => ({ 
      toDate: () => date,
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0
    }))
  }
}));

// firebase 모킹
jest.mock('../../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-user' } }
}));

// useAttendanceStatus 모킹
jest.mock('../../hooks/useAttendanceStatus', () => ({
  useAttendanceStatus: jest.fn(() => ({
    getStaffAttendanceStatus: jest.fn(() => ({
      status: 'checked_in',
      actualStartTime: new Date('2024-07-25T09:00:00'),
      actualEndTime: null
    }))
  }))
}));

// useToast 모킹
jest.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    showSuccess: jest.fn(),
    showError: jest.fn()
  })
}));

// logger 모킹
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('WorkTimeEditor', () => {
  const mockWorkLog = {
    id: 'work-log-1',
    eventId: 'event-1',
    staffId: 'staff-1',
    date: '2024-07-25',
    scheduledStartTime: Timestamp.fromDate(new Date('2024-07-25T09:00:00')),
    scheduledEndTime: Timestamp.fromDate(new Date('2024-07-25T18:00:00')),
    actualStartTime: null,
    actualEndTime: null,
    status: 'not_started' as const
  };

  const mockOnUpdate = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders with work log data', () => {
    render(
      <WorkTimeEditor
        workLog={mockWorkLog}
        isOpen={true}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByLabelText(/근무 일자/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/예정 시작/i)).toHaveValue('09:00');
    expect(screen.getByLabelText(/예정 종료/i)).toHaveValue('18:00');
  });

  test('updates scheduled time', async () => {
    const user = userEvent.setup();
    
    render(
      <WorkTimeEditor
        workLog={mockWorkLog}
        isOpen={true}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    );

    const startTimeInput = screen.getByLabelText(/예정 시작/i);
    await user.clear(startTimeInput);
    await user.type(startTimeInput, '10:00');

    const saveButton = screen.getByText(/저장/i);
    await user.click(saveButton);

    await waitFor(() => {
      expect(updateDoc).toHaveBeenCalled();
    });
    
    expect(mockOnUpdate).toHaveBeenCalled();
  });

  test('creates new work log if not exists', async () => {
    const user = userEvent.setup();
    const workLogWithoutId: any = { ...mockWorkLog, id: undefined };

    render(
      <WorkTimeEditor
        workLog={workLogWithoutId}
        isOpen={true}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    );

    const saveButton = screen.getByText(/저장/i);
    await user.click(saveButton);

    await waitFor(() => {
      expect(setDoc).toHaveBeenCalled();
    });
    
    expect(mockOnUpdate).toHaveBeenCalled();
  });

  test('cancels editing', async () => {
    const user = userEvent.setup();
    
    render(
      <WorkTimeEditor
        workLog={mockWorkLog}
        isOpen={true}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    );

    const cancelButton = screen.getByText(/취소/i);
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  test('validates time format', async () => {
    const user = userEvent.setup();
    
    render(
      <WorkTimeEditor
        workLog={mockWorkLog}
        isOpen={true}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    );

    const startTimeInput = screen.getByLabelText(/예정 시작/i);
    await user.clear(startTimeInput);
    await user.type(startTimeInput, '25:00'); // Invalid time

    const saveButton = screen.getByText(/저장/i);
    await user.click(saveButton);

    // Should not call updateDoc with invalid time
    expect(updateDoc).not.toHaveBeenCalled();
  });

  test('handles actual time inputs', async () => {
    const user = userEvent.setup();
    
    render(
      <WorkTimeEditor
        workLog={mockWorkLog}
        isOpen={true}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
      />
    );

    const actualStartInput = screen.getByLabelText(/실제 시작/i);
    await user.type(actualStartInput, '09:05');

    const saveButton = screen.getByText(/저장/i);
    await user.click(saveButton);

    await waitFor(() => {
      expect(updateDoc).toHaveBeenCalled();
    });
  });
});