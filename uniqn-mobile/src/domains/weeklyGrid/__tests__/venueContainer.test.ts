/**
 * venueContainer — 운영처 컨테이너 경량 파서(순수)
 *
 * 컨테이너는 JobPosting(rigid posting document)으로 표현하지 않는다. 전용 경량 타입으로 파싱해
 * jobPostingDocumentSchema 의 strict 필수(location/schedule/compensation) 충돌(null 증발)을 회피한다.
 */
import { parseVenueContainer, parseVenueContainers } from '../venueContainer';

describe('parseVenueContainer', () => {
  const row = {
    id: 'c1',
    title: '강남홀덤',
    workspace_id: 'ws1',
    owner_id: 'o1',
    venue_id: 'c1',
    status: 'container',
    schedule: { kind: 'dated', softTargets: { '2026-07-01': 3 } },
  };

  it('컨테이너 행을 VenueContainer 로 파싱한다', () => {
    expect(parseVenueContainer(row)).toEqual({
      id: 'c1',
      name: '강남홀덤',
      workspaceId: 'ws1',
      ownerId: 'o1',
      venueId: 'c1',
      kind: 'dated',
      softTargets: { '2026-07-01': 3 },
      roleSalaries: [],
    });
  });

  it('softTargets 가 없으면 빈 맵', () => {
    expect(parseVenueContainer({ ...row, schedule: { kind: 'dated' } })?.softTargets).toEqual({});
  });

  it('필수 필드(id/title/workspace_id)가 없으면 null', () => {
    expect(parseVenueContainer({ foo: 1 })).toBeNull();
  });

  it('parseVenueContainers 는 비정상 행을 거른다', () => {
    expect(parseVenueContainers([row, { bad: 1 }])).toHaveLength(1);
  });
});
