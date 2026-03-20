import { userRepository } from '@/repositories';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import type { UserProfile } from './authTypes';

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    return await userRepository.getById(uid);
  } catch (error) {
    throw handleServiceError(error, {
      operation: 'get user profile',
      component: 'authService',
      context: { uid },
    });
  }
}
