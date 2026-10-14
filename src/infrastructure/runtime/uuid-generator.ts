import { randomUUID } from 'node:crypto';
import type { EntityId, EntityKind, IdGenerator } from '../../domain/shared/identifiers.js';

export class UuidGenerator implements IdGenerator {
  generate<Kind extends EntityKind>(_kind: Kind): EntityId<Kind> {
    return randomUUID() as EntityId<Kind>;
  }
}
