import { expect } from 'chai';
import {
  buildOGDescription,
  buildOGTitle,
  hasOGRelevantChange,
} from '../src/triggers/onJobPostingOGSync';

describe('onJobPostingOGSync helpers', () => {
  it('builds OG description from v3 dated schedule fields', () => {
    const description = buildOGDescription({
      postingType: 'regular',
      compensation: {
        defaultSalary: {
          type: 'daily',
          amount: 150000,
        },
      },
      schedule: {
        kind: 'dated',
        primaryDate: '2026-04-10',
        allDates: ['2026-04-10', '2026-04-11'],
        requirements: [
          {
            date: '2026-04-10',
            timeSlots: [
              {
                startTime: '18:00',
                roles: [
                  { role: 'dealer', count: 2 },
                  { role: 'floor', count: 1 },
                ],
              },
            ],
          },
          {
            date: '2026-04-11',
            timeSlots: [
              {
                startTime: '17:00',
                roles: [{ role: 'dealer', count: 2 }],
              },
            ],
          },
        ],
      },
      roleCatalog: [{ role: 'dealer' }, { role: 'floor' }],
    } as never);

    expect(description).to.contain('150,000');
    expect(description).to.contain('18:00');
    expect(description).to.contain('외 1일');
    expect(description).to.contain('딜러 4명');
    expect(description).to.contain('플로어 1명');
  });

  it('builds OG description from fixed schedule fields', () => {
    const description = buildOGDescription({
      postingType: 'fixed',
      compensation: {
        defaultSalary: {
          type: 'monthly',
          amount: 3000000,
        },
      },
      schedule: {
        kind: 'fixed',
        daysPerWeek: 3,
        isStartTimeNegotiable: true,
        roleRequirements: [{ role: 'manager', count: 1 }],
      },
    } as never);

    expect(description).to.contain('3,000,000');
    expect(description).to.contain('주 3일');
    expect(description).to.contain('시간 협의');
    expect(description).to.contain('매니저 1명');
  });

  it('falls back to legacy schedule fields when v3 fields are missing', () => {
    const description = buildOGDescription({
      postingType: 'regular',
      defaultSalary: {
        type: 'hourly',
        amount: 12000,
      },
      workDate: '2026-04-10',
      timeSlot: '09:00 - 18:00',
      roles: [{ role: 'serving', count: 2 }],
    } as never);

    expect(description).to.contain('12,000');
    expect(description).to.contain('09:00~18:00');
    expect(description).to.contain('서빙 2명');
  });

  it('treats v3 schedule changes as OG-relevant', () => {
    const before = {
      title: 'Spring Open',
      schedule: {
        kind: 'dated',
        primaryDate: '2026-04-10',
        allDates: ['2026-04-10'],
        requirements: [],
      },
    };
    const after = {
      title: 'Spring Open',
      schedule: {
        kind: 'dated',
        primaryDate: '2026-04-10',
        allDates: ['2026-04-10'],
        requirements: [
          {
            date: '2026-04-10',
            timeSlots: [{ startTime: '18:00', roles: [{ role: 'dealer', count: 2 }] }],
          },
        ],
      },
    };

    expect(hasOGRelevantChange(before, after)).to.equal(true);
  });

  it('builds OG title from the location name', () => {
    expect(
      buildOGTitle({
        title: 'Main Event',
        location: { name: 'Gangnam Poker Lounge' },
      } as never)
    ).to.equal('[Gangnam Poker Lounge] Main Event');
  });
});
