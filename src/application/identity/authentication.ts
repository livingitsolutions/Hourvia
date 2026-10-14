import type { UserId } from '../../domain/shared/identifiers.js';
import type { Result } from '../../domain/shared/result.js';

export type AuthenticatedPrincipal = Readonly<{ userId: UserId }>;
export type AuthenticationError = Readonly<{
  code: 'UNAUTHENTICATED' | 'AUTHENTICATION_UNAVAILABLE';
  message: string;
}>;

export interface AuthenticationProvider {
  authenticate(credential: string | null): Promise<Result<AuthenticatedPrincipal, AuthenticationError>>;
}
