import { toCamelCase, toSnakeCase } from '@/utils/supabase';

describe('toCamelCase', () => {
  describe('기본 변환', () => {
    it('단순 snake_case → camelCase', () => {
      expect(toCamelCase({ user_id: '1', created_at: '2026-01-01' })).toEqual({
        userId: '1',
        createdAt: '2026-01-01',
      });
    });

    it('단일 단어 키는 변경 없음', () => {
      expect(toCamelCase({ id: '1', email: 'a@b.com' })).toEqual({
        id: '1',
        email: 'a@b.com',
      });
    });
  });

  describe('KNOWN_ACRONYMS — 키 끝 (End of key)', () => {
    it('photo_url → photoURL', () => {
      expect(toCamelCase({ photo_url: 'https://a.com/a.jpg' })).toEqual({
        photoURL: 'https://a.com/a.jpg',
      });
    });

    it('evidence_urls → evidenceURLs (복수형)', () => {
      expect(toCamelCase({ evidence_urls: ['a', 'b'] })).toEqual({
        evidenceURLs: ['a', 'b'],
      });
    });
  });

  describe('KNOWN_ACRONYMS — 키 중간 (Middle of key, followed by uppercase)', () => {
    it('photo_url_blurhash → photoURLBlurhash', () => {
      expect(toCamelCase({ photo_url_blurhash: 'LKO2' })).toEqual({
        photoURLBlurhash: 'LKO2',
      });
    });

    it('staff_photo_url_blurhash → staffPhotoURLBlurhash', () => {
      expect(toCamelCase({ staff_photo_url_blurhash: 'LKO2' })).toEqual({
        staffPhotoURLBlurhash: 'LKO2',
      });
    });

    it('applicant_photo_url_blurhash → applicantPhotoURLBlurhash', () => {
      expect(toCamelCase({ applicant_photo_url_blurhash: 'LKO2' })).toEqual({
        applicantPhotoURLBlurhash: 'LKO2',
      });
    });

    it('og_image_url_blurhash → ogImageURLBlurhash', () => {
      expect(toCamelCase({ og_image_url_blurhash: 'LKO2' })).toEqual({
        ogImageURLBlurhash: 'LKO2',
      });
    });

    it('image_url_blurhash → imageURLBlurhash', () => {
      expect(toCamelCase({ image_url_blurhash: 'LKO2' })).toEqual({
        imageURLBlurhash: 'LKO2',
      });
    });
  });

  describe('False-positive 방어', () => {
    it('단일 key url은 변환하지 않음 (camelKey === token.toLowerCase() 가드)', () => {
      expect(toCamelCase({ url: 'https://a.com' })).toEqual({
        url: 'https://a.com',
      });
    });

    it('단일 key urls도 변환하지 않음', () => {
      expect(toCamelCase({ urls: ['a', 'b'] })).toEqual({
        urls: ['a', 'b'],
      });
    });
  });

  describe('여러 키 동시 처리', () => {
    it('acronym + non-acronym 키 혼재', () => {
      expect(
        toCamelCase({
          user_id: '1',
          photo_url: 'https://a.com',
          photo_url_blurhash: 'LKO2',
          created_at: '2026-01-01',
        })
      ).toEqual({
        userId: '1',
        photoURL: 'https://a.com',
        photoURLBlurhash: 'LKO2',
        createdAt: '2026-01-01',
      });
    });
  });

  describe('값 보존', () => {
    it('null / undefined / 숫자 / 중첩 객체 값은 그대로 유지 (shallow)', () => {
      const nested = { nested_key: 'value' };
      expect(
        toCamelCase({
          count: 0,
          empty: null,
          missing: undefined,
          nested_obj: nested,
        })
      ).toEqual({
        count: 0,
        empty: null,
        missing: undefined,
        nestedObj: nested, // 중첩 객체는 변환 안 함 (키만 camelCase)
      });
    });
  });
});

describe('toSnakeCase', () => {
  it('camelCase → snake_case', () => {
    expect(toSnakeCase({ userId: '1', createdAt: '2026-01-01' })).toEqual({
      user_id: '1',
      created_at: '2026-01-01',
    });
  });

  it('연속 대문자 (acronym) 처리', () => {
    expect(toSnakeCase({ photoURL: 'https://a.com' })).toEqual({
      photo_url: 'https://a.com',
    });
  });

  it('중간 acronym 처리 — photoURLBlurhash → photo_url_blurhash (round-trip)', () => {
    expect(toSnakeCase({ photoURLBlurhash: 'LKO2' })).toEqual({
      photo_url_blurhash: 'LKO2',
    });
  });

  it('round-trip: snake → camel → snake 보존 (mid-acronym 포함)', () => {
    const original = {
      user_id: '1',
      photo_url: 'a',
      photo_url_blurhash: 'LKO2',
      created_at: '2026-01-01',
    };
    const camel = toCamelCase(original);
    const back = toSnakeCase(camel as Record<string, unknown>);
    expect(back).toEqual(original);
  });

  // 알려진 제약: toSnakeCase는 소문자 suffix를 가진 중간 acronym을 잘못 분할함.
  // 예: `evidenceURLs` → `evidence_ur_ls` (기대: `evidence_urls`).
  // 이 한계는 디자인 현대화 작업과 무관한 pre-existing 이슈로 별도 처리.
  it('알려진 한계: evidenceURLs의 복수형 acronym roundtrip', () => {
    const camel = toCamelCase({ evidence_urls: ['x'] });
    expect(camel).toEqual({ evidenceURLs: ['x'] });
    const back = toSnakeCase(camel as Record<string, unknown>);
    expect(back).toEqual({ evidence_ur_ls: ['x'] }); // 의도적 — 현재 동작을 문서화
  });
});
