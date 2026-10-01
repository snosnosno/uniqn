import { describe, expect, it } from 'vitest';
import { EVENT_LABEL } from '@/core/historyLabels';
import type { OpsEventType } from '@/core/types/ops';
import { eventCategory, filterEvents } from './historyFilter';

describe('eventCategory', () => {
  it.each<[OpsEventType, string]>([
    ['player_busted', 'player'],
    ['player_registered', 'player'],
    ['player_moved', 'seat'],
    ['seat_freed', 'seat'],
    ['table_redraw', 'seat'],
    ['table_staff_assigned', 'setup'],
    ['level_play', 'clock'],
    ['prize_paid', 'prize'],
    ['posting_linked', 'setup'],
    ['tournament_created', 'setup'],
  ])('%s → %s', (type, cat) => {
    expect(eventCategory(type)).toBe(cat);
  });

  it('모든 이벤트 종류가 어딘가로 분류된다(라벨표 전수)', () => {
    for (const type of Object.keys(EVENT_LABEL) as OpsEventType[]) {
      expect(['player', 'seat', 'clock', 'prize', 'setup']).toContain(eventCategory(type));
    }
  });
});

describe('filterEvents', () => {
  const list = [{ type: 'player_busted' as const }, { type: 'level_play' as const }];
  it('전체는 그대로, 분류는 그 종류만', () => {
    expect(filterEvents(list, 'all')).toHaveLength(2);
    expect(filterEvents(list, 'clock')).toEqual([{ type: 'level_play' }]);
  });
});
