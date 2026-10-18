import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export async function audit(
  actorId: string | undefined,
  action: string,
  entity: string,
  entityId: string,
  meta?: Prisma.InputJsonValue,
) {
  await prisma.auditLog.create({ data: { actorId, action, entity, entityId, meta } });
}
