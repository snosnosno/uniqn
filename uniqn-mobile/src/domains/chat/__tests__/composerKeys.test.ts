/**
 * composerKeyAction · insertNewlineAt — 웹 채팅 입력창 키 규칙(09-26 QA)
 */
import { composerKeyAction, insertNewlineAt } from '../composerKeys';

describe('composerKeyAction', () => {
  it('Enter = 전송', () => {
    expect(composerKeyAction({ key: 'Enter' })).toBe('send');
  });

  it('Alt+Enter = 직접 줄바꿈 · Shift+Enter = 브라우저 기본(줄바꿈)', () => {
    expect(composerKeyAction({ key: 'Enter', altKey: true })).toBe('newline');
    expect(composerKeyAction({ key: 'Enter', shiftKey: true })).toBe('default');
    expect(composerKeyAction({ key: 'Enter', shiftKey: true, altKey: true })).toBe('default');
  });

  it('한글 조합 중 Enter 는 건드리지 않는다 — isComposing 또는 keyCode 229(Safari)', () => {
    expect(composerKeyAction({ key: 'Enter', isComposing: true })).toBe('default');
    expect(composerKeyAction({ key: 'Enter', keyCode: 229 })).toBe('default');
    expect(composerKeyAction({ key: 'Enter', altKey: true, isComposing: true })).toBe('default');
  });

  it('터치 기기 웹(가상 키보드)은 Enter 를 가로채지 않는다 — 줄바꿈 수단이 사라지므로', () => {
    expect(composerKeyAction({ key: 'Enter', coarsePointer: true })).toBe('default');
    expect(composerKeyAction({ key: 'Enter', altKey: true, coarsePointer: true })).toBe('default');
  });

  it('Enter 가 아닌 키는 기본 동작', () => {
    expect(composerKeyAction({ key: 'a' })).toBe('default');
    expect(composerKeyAction({ key: 'Backspace', altKey: true })).toBe('default');
  });
});

describe('insertNewlineAt', () => {
  it('커서 자리에 줄바꿈을 넣고 커서는 그 뒤', () => {
    expect(insertNewlineAt('ab', 1, 1)).toEqual({ value: 'a\nb', cursor: 2 });
  });

  it('선택 영역은 줄바꿈으로 바뀐다', () => {
    expect(insertNewlineAt('abcd', 1, 3)).toEqual({ value: 'a\nd', cursor: 2 });
  });

  it('범위를 벗어난 위치는 값 안으로 자른다', () => {
    expect(insertNewlineAt('ab', 5, 9)).toEqual({ value: 'ab\n', cursor: 3 });
    expect(insertNewlineAt('ab', -1, 0)).toEqual({ value: '\nab', cursor: 1 });
  });
});
