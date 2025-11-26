// Firebase Auth 모킹
export const getAuth = jest.fn(() => ({
  currentUser: null,
}));
export const signInWithEmailAndPassword = jest.fn(() =>
  Promise.resolve({
    user: { uid: 'test-user-id', email: 'test@example.com' },
  })
);
export const signOut = jest.fn(() => Promise.resolve());
export const sendPasswordResetEmail = jest.fn(() => Promise.resolve());
export const onAuthStateChanged = jest.fn((auth, callback) => {
  callback(null);
  return jest.fn(); // unsubscribe 함수
});
