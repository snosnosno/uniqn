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
  it('NAVER 인앱 브라우저는 크롤러로 오분류하지 않는다(리다이렉트 루프 방지)', () => {
    expect(
      isCrawlerUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 NAVER(inapp; search; 1234; 12.0.0)'
      )
    ).toBe(false);
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
  it('buildOgHtml 은 url 의 </script> 브레이크아웃을 차단한다', () => {
    const html = buildOgHtml({
      title: '딜러 모집',
      description: '강남',
      image: 'https://cdn/x.png',
      url: 'https://uniqn.app/jobs/x</script><svg onload=alert(1)>',
    });
    // 스크립트 본문에 리터럴 </script> 브레이크아웃이 없어야 한다 (정상 닫는 태그 1개만 허용)
    expect(html).not.toContain('</script><svg');
    expect(html).toContain('\\u003c/script'); // location.replace 인자 안에서 이스케이프됨
  });
});
