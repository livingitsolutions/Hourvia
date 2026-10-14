import type { AuthenticationProvider, AuthenticationError, AuthenticatedPrincipal } from '../../application/identity/authentication.js';
import { failure } from '../../domain/shared/result.js';
import type { Result } from '../../domain/shared/result.js';

export class DisabledAuthentication implements AuthenticationProvider {
  async authenticate(_credential: string | null): Promise<Result<AuthenticatedPrincipal, AuthenticationError>> {
    return failure({ code: 'AUTHENTICATION_UNAVAILABLE', message: 'Authentication is not enabled in Sprint 0.' });
  }
}
