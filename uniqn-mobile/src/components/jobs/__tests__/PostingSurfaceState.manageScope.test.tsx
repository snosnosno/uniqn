/**
 * PostingSurfaceState — 관리 화면 스켈레톤 분기 (S2-9).
 *
 * 허브는 스켈레톤인데 자식 화면(지원자·정산·수정·취소요청)만 스피너라, 탭을 옮길 때마다
 * 로딩 표현이 바뀌어 같은 앱이 아닌 것처럼 보였다. 스켈레톤으로 통일하되 형상도 맞춘다 —
 * 관리 화면에 구직자 상세용(히어로+급여) 형상을 쓰면 로딩 중에 본 형태와 도착한 화면
 * (통계+액션 목록)이 달라 스켈레톤이 기대를 잘못 만든다.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { PostingSurfaceState } from '@/components/jobs';

describe('PostingSurfaceState — manage scope', () => {
  it('관리 화면 로딩은 스켈레톤을 낸다(스피너가 아니다)', () => {
    const { getByLabelText } = render(<PostingSurfaceState mode="loading" scope="manage" />);

    // 스켈레톤은 progressbar 로 읽힌다 — 스크린리더에 "로딩 중"이 전달되는지가 계약이다.
    expect(getByLabelText('로딩 중')).toBeTruthy();
  });

  it('구직자 상세 형상과 다른 트리를 낸다', () => {
    const manage = render(<PostingSurfaceState mode="loading" scope="manage" />).toJSON();
    const detail = render(<PostingSurfaceState mode="loading" scope="detail" />).toJSON();

    expect(JSON.stringify(manage)).not.toBe(JSON.stringify(detail));
  });

  it('로딩이 아닌 모드에서는 scope 가 형상을 바꾸지 않는다', () => {
    const { getByText } = render(
      <PostingSurfaceState mode="partial" scope="manage" title="정보가 최신이 아닐 수 있어요" />
    );

    expect(getByText('정보가 최신이 아닐 수 있어요')).toBeTruthy();
  });
});
