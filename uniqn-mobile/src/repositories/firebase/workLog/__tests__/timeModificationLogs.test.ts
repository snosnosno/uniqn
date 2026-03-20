import { getDocs, Timestamp } from 'firebase/firestore';
import {
  hydrateWorkLogModificationHistory,
  hydrateWorkLogsModificationHistory,
  mergeTimeModificationHistory,
} from '../timeModificationLogs';

describe('timeModificationLogs helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deduplicates by signature and sorts newest entries first', () => {
    const authoritativeTimestamp = Timestamp.fromDate(new Date('2025-01-03T00:00:00.000Z'));
    const legacyTimestamp = '2025-01-02T00:00:00.000Z';

    const merged = mergeTimeModificationHistory(
      [
        {
          modifiedAt: authoritativeTimestamp,
          modifiedBy: 'owner-1',
          reason: 'shift update',
          previousStartTime: '2025-01-01T09:00:00.000Z',
          previousEndTime: null,
          newStartTime: '2025-01-01T10:00:00.000Z',
          newEndTime: null,
        },
      ],
      [
        {
          modifiedAt: legacyTimestamp,
          modifiedBy: 'owner-1',
          reason: 'shift update',
          previousStartTime: '2025-01-01T09:00:00.000Z',
          previousEndTime: null,
          newStartTime: '2025-01-01T10:00:00.000Z',
          newEndTime: null,
        },
        {
          modifiedAt: '2025-01-01T00:00:00.000Z',
          modifiedBy: 'owner-1',
          reason: 'manual note',
          previousStartTime: null,
          previousEndTime: null,
          newStartTime: null,
          newEndTime: null,
        },
      ]
    );

    expect(merged).toHaveLength(2);
    expect(merged[0]).toEqual(
      expect.objectContaining({
        reason: 'shift update',
        modifiedAt: authoritativeTimestamp,
      })
    );
    expect(merged[1]).toEqual(expect.objectContaining({ reason: 'manual note' }));
  });

  it('prefers authoritative subcollection logs and keeps unique legacy entries as fallback', async () => {
    const authoritativeTimestamp = Timestamp.fromDate(new Date('2025-01-03T00:00:00.000Z'));

    (getDocs as jest.Mock).mockResolvedValue({
      docs: [
        {
          data: () => ({
            workLogId: 'wl-1',
            modifiedAt: authoritativeTimestamp,
            modifiedBy: 'owner-1',
            reason: 'shift update',
            previousStartTime: '2025-01-01T09:00:00.000Z',
            previousEndTime: null,
            newStartTime: '2025-01-01T10:00:00.000Z',
            newEndTime: null,
          }),
        },
      ],
    });

    const hydrated = await hydrateWorkLogModificationHistory(
      {
        id: 'wl-1',
        modificationHistory: [
          {
            modifiedAt: '2025-01-02T00:00:00.000Z',
            modifiedBy: 'owner-1',
            reason: 'shift update',
            previousStartTime: '2025-01-01T09:00:00.000Z',
            previousEndTime: null,
            newStartTime: '2025-01-01T10:00:00.000Z',
            newEndTime: null,
          },
          {
            modifiedAt: '2025-01-01T00:00:00.000Z',
            modifiedBy: 'owner-1',
            reason: 'manual note',
            previousStartTime: null,
            previousEndTime: null,
            newStartTime: null,
            newEndTime: null,
          },
        ],
      } as any,
      { force: true }
    );

    expect(hydrated.modificationHistory).toHaveLength(2);
    expect(hydrated.modificationHistory?.[0]).toEqual(
      expect.objectContaining({
        reason: 'shift update',
        modifiedAt: authoritativeTimestamp,
      })
    );
    expect(hydrated.modificationHistory?.[1]).toEqual(
      expect.objectContaining({ reason: 'manual note' })
    );
  });

  it('keeps legacy history when authoritative log loading fails', async () => {
    (getDocs as jest.Mock).mockRejectedValue(new Error('collectionGroup failed'));

    const workLog = {
      id: 'wl-1',
      modificationHistory: [
        {
          modifiedAt: '2025-01-01T00:00:00.000Z',
          modifiedBy: 'owner-1',
          reason: 'manual note',
          previousStartTime: null,
          previousEndTime: null,
          newStartTime: null,
          newEndTime: null,
        },
      ],
    } as any;

    const hydrated = await hydrateWorkLogModificationHistory(workLog, { force: true });

    expect(hydrated.modificationHistory).toEqual(workLog.modificationHistory);
  });

  it('skips collectionGroup hydration for list rows without legacy modification history', async () => {
    const workLogs = [{ id: 'wl-1' }, { id: 'wl-2', modificationHistory: [] }] as any;

    const hydrated = await hydrateWorkLogsModificationHistory(workLogs);

    expect(getDocs).not.toHaveBeenCalled();
    expect(hydrated).toEqual(workLogs);
  });

  it('hydrates list rows that already expose legacy modification history during the bridge release', async () => {
    const authoritativeTimestamp = Timestamp.fromDate(new Date('2025-01-03T00:00:00.000Z'));

    (getDocs as jest.Mock).mockResolvedValue({
      docs: [
        {
          data: () => ({
            workLogId: 'wl-1',
            modifiedAt: authoritativeTimestamp,
            modifiedBy: 'owner-1',
            reason: 'shift update',
            previousStartTime: '2025-01-01T09:00:00.000Z',
            previousEndTime: null,
            newStartTime: '2025-01-01T10:00:00.000Z',
            newEndTime: null,
          }),
        },
      ],
    });

    const hydrated = await hydrateWorkLogsModificationHistory([
      {
        id: 'wl-1',
        modificationHistory: [
          {
            modifiedAt: '2025-01-02T00:00:00.000Z',
            modifiedBy: 'owner-1',
            reason: 'shift update',
            previousStartTime: '2025-01-01T09:00:00.000Z',
            previousEndTime: null,
            newStartTime: '2025-01-01T10:00:00.000Z',
            newEndTime: null,
          },
        ],
      },
      {
        id: 'wl-2',
      },
    ] as any);

    expect(getDocs).toHaveBeenCalledTimes(1);
    expect(hydrated[0].modificationHistory).toEqual([
      expect.objectContaining({
        reason: 'shift update',
        modifiedAt: authoritativeTimestamp,
      }),
    ]);
    expect(hydrated[1]).toEqual({ id: 'wl-2' });
  });
});
