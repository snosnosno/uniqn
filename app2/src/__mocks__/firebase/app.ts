// Firebase App 모킹
export const initializeApp = jest.fn(() => ({
  name: '[DEFAULT]',
  options: {}
}));
export const getApp = jest.fn(() => ({
  name: '[DEFAULT]',
  options: {}
}));