/**
 * UNIQN Mobile - 우편번호 검색 패널 공용 계약
 *
 * @description 웹(`.web.tsx`)·네이티브(`.tsx`) 두 구현이 같은 props 를 갖도록 타입을 한 곳에 둔다.
 * 각 파일이 인터페이스를 따로 선언하면 한쪽만 고쳐도 tsc 가 침묵해 드리프트가 생긴다.
 */
import type { PostcodeResult } from '@/utils/address/postcodeAddress';

export interface PostcodeSearchProps {
  /** 패널 높이(px). 호출부가 시트 크롬을 뺀 예산을 계산해 넘긴다 — 넘치면 하단이 잘린다 */
  height: number;
  /** 주소 선택 완료 — 검증을 통과한 결과만 전달된다 */
  onComplete: (result: PostcodeResult) => void;
  /** 스크립트 로드 실패·페이로드 검증 실패 등. 호출부가 사용자에게 알리고 폴백을 준다 */
  onError: (message: string) => void;
}
