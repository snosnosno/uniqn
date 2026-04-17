/**
 * announcement.schema — image 관련 파싱 커버리지
 *
 * impeccable v2 §18: `blurhash` 필드는 optional(레거시 호환).
 */

import { announcementImageSchema, createAnnouncementSchema } from '../announcement.schema';

describe('announcementImageSchema', () => {
  const base = {
    id: 'img-1',
    url: 'https://example.com/a.jpg',
    storagePath: 'announcements/a.jpg',
    order: 0,
  };

  it('accepts image without blurhash (legacy data)', () => {
    const parsed = announcementImageSchema.parse(base);
    expect(parsed.blurhash).toBeUndefined();
  });

  it('accepts image with blurhash string', () => {
    const parsed = announcementImageSchema.parse({
      ...base,
      blurhash: 'LjH.XM?bofay~qayayj[IUj[ayj@',
    });
    expect(parsed.blurhash).toBe('LjH.XM?bofay~qayayj[IUj[ayj@');
  });

  it('accepts null blurhash', () => {
    const parsed = announcementImageSchema.parse({ ...base, blurhash: null });
    expect(parsed.blurhash).toBeNull();
  });

  it('rejects non-string blurhash', () => {
    expect(() =>
      announcementImageSchema.parse({ ...base, blurhash: 123 as unknown as string })
    ).toThrow();
  });

  it('rejects invalid URL', () => {
    expect(() => announcementImageSchema.parse({ ...base, url: 'not-a-url' })).toThrow();
  });
});

describe('createAnnouncementSchema images[]', () => {
  const baseForm = {
    title: '공지 제목',
    content: '공지 내용을 10자 이상 작성합니다. 테스트 더미.',
    category: 'notice' as const,
    targetAudience: { type: 'all' as const },
  };

  it('accepts images with mixed blurhash presence', () => {
    const parsed = createAnnouncementSchema.parse({
      ...baseForm,
      images: [
        {
          id: 'img-1',
          url: 'https://example.com/a.jpg',
          storagePath: 'a.jpg',
          order: 0,
          blurhash: 'LKN]Rv%2Tw=w]~RBVZRi};RPxuwH',
        },
        {
          id: 'img-2',
          url: 'https://example.com/b.jpg',
          storagePath: 'b.jpg',
          order: 1,
          // legacy: no blurhash
        },
      ],
    });
    expect(parsed.images).toHaveLength(2);
    expect(parsed.images?.[0].blurhash).toBeDefined();
    expect(parsed.images?.[1].blurhash).toBeUndefined();
  });

  it('enforces the 10-image cap regardless of blurhash', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      id: `img-${i}`,
      url: `https://example.com/${i}.jpg`,
      storagePath: `${i}.jpg`,
      order: i,
    }));
    expect(() => createAnnouncementSchema.parse({ ...baseForm, images: many })).toThrow(
      /최대 10장/
    );
  });
});
