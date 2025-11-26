// AuthContext 모킹
export const mockAuthContextValue = {
  currentUser: {
    uid: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
    photoURL: null,
    emailVerified: true,
    isAnonymous: false,
    metadata: {} as any,
    providerData: [],
    refreshToken: '',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => '',
    getIdTokenResult: async () => ({}) as any,
    reload: async () => {},
    toJSON: () => ({}),
    phoneNumber: null,
    providerId: 'firebase',
    region: 'kr',
  },
  loading: false,
  isAdmin: true,
  role: 'admin',
  signOut: jest.fn(),
  signIn: jest.fn(),
  sendPasswordReset: jest.fn(),
  signInWithGoogle: jest.fn(),
};

export const useAuth = () => mockAuthContextValue;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};
