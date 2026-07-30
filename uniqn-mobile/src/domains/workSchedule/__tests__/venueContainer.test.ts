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
      location: null,
      contactPhone: null,
      description: null,
    });
  });

  // S1 — 지점 프로필 3종. 여기서 파싱을 빠뜨리면 값이 저장돼 있어도 화면에 안 나온다.
  describe('지점 프로필(location/contact_phone/description)', () => {
    it('세 필드를 왕복 파싱한다', () => {
      const parsed = parseVenueContainer({
        ...row,
        location: { name: '강남역 2번 출구', district: '강남구', detailedAddress: '3층' },
        contact_phone: '02-123-4567',
        description: '역삼역 도보 2분',
      });
      expect(parsed?.location).toEqual({
        name: '강남역 2번 출구',
        district: '강남구',
        detailedAddress: '3층',
      });
      expect(parsed?.contactPhone).toBe('02-123-4567');
      expect(parsed?.description).toBe('역삼역 도보 2분');
    });

    // DB 기본값이 '{}' 라 "미설정"이 빈 객체로 온다 — 소비처가 truthy 검사만 해도 되도록 null.
    it('빈 객체 location 은 null 로 정규화한다', () => {
      expect(parseVenueContainer({ ...row, location: {} })?.location).toBeNull();
    });

    it('location 이 없거나 배열·문자열이면 null', () => {
      expect(parseVenueContainer(row)?.location).toBeNull();
      expect(parseVenueContainer({ ...row, location: [] })?.location).toBeNull();
      expect(parseVenueContainer({ ...row, location: 'seoul' })?.location).toBeNull();
    });

    it('빈 문자열 값은 키를 만들지 않는다(전부 비면 null)', () => {
      expect(parseVenueContainer({ ...row, location: { name: '' } })?.location).toBeNull();
    });

    // 미래에 서버가 키를 추가해도 read 가 증발하면 안 된다(#194 클래스) — 모르는 키는 무시만.
    it('모르는 키가 섞여 있어도 알려진 키는 살아남는다', () => {
      expect(
        parseVenueContainer({ ...row, location: { name: '강남', geoLat: 37.5 } })?.location
      ).toEqual({ name: '강남' });
    });

    it('contact_phone/description 이 null 이면 null 로 유지한다', () => {
      const parsed = parseVenueContainer({ ...row, contact_phone: null, description: null });
      expect(parsed?.contactPhone).toBeNull();
      expect(parsed?.description).toBeNull();
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
