export type DomainErrorCode =
  | 'INVALID_ID'
  | 'INVALID_TIMESTAMP'
  | 'INVALID_TIMEZONE'
  | 'INVALID_DURATION'
  | 'INVALID_NAME'
  | 'INVALID_WORKSPACE'
  | 'INVALID_MEMBERSHIP'
  | 'INVALID_TRANSITION'
  | 'OWNER_PROTECTED';

export type DomainError = Readonly<{
  code: DomainErrorCode;
  message: string;
}>;

export type Result<Value, Failure = DomainError> =
  | Readonly<{ ok: true; value: Value }>
  | Readonly<{ ok: false; error: Failure }>;

export function success<Value>(value: Value): Readonly<{ ok: true; value: Value }> {
  return Object.freeze({ ok: true, value });
}

export function failure<Failure>(error: Failure): Readonly<{ ok: false; error: Failure }> {
  return Object.freeze({ ok: false, error: Object.freeze(error) });
}

export function domainFailure(code: DomainErrorCode, message: string): Result<never> {
  return failure({ code, message });
}
