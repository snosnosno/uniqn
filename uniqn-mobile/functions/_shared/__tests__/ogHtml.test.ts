import { escapeHtml, isCrawlerUserAgent, buildOgHtml } from '../ogHtml';

describe('ogHtml', () => {
  it('HTML 특수문자를 이스케이프한다', () => {
    expect(escapeHtml('<script>"&\'')).toBe('&lt;script&gt;&quot;&amp;&#39;');
  });
  it('카톡/페북 등 크롤러 UA 를 식별한다', () => {
    expect(isCrawlerUserAgent('facebookexternalhit/1.1')).toBe(true);
    expect(isCrawlerUserAgent('kakaotalk-scrap/1.0')).toBe(true);
    expect(isCrawlerUserAgent('Mozilla/5.0 (iPhone)')).toBe(false);
    expect(isCrawlerUserAgent(null)).toBe(false);
  });
  it('OG 태그를 이스케이프해 삽입한다', () => {
    const html = buildOgHtml({
      title: '딜러 <b>모집</b>',
      description: '강남 · 7/17',
      image: 'https://cdn/x.png',
      url: 'https://uniqn.app/jobs/1',
    });
    expect(html).toContain('<meta property="og:title" content="딜러 &lt;b&gt;모집&lt;/b&gt;"');
    expect(html).toContain('<meta property="og:image" content="https://cdn/x.png"');
    expect(html).toContain('twitter:card');
  });
});
