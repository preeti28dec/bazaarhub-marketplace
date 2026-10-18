import { prisma } from './prisma';
import { HttpError } from './http';

export function activeSubscription(merchantId: string) {
  return prisma.subscription.findFirst({
    where: { merchantId, status: 'ACTIVE', endsAt: { gt: new Date() } },
    include: { plan: true },
    orderBy: { endsAt: 'desc' },
  });
}

/**
 * A merchant may list in a category when:
 *  - they hold an APPROVED grant for it (or its parent), or
 *  - their active plan covers all categories AND the category doesn't require an explicit grant.
 */
export async function assertCategoryAccess(merchantId: string, categoryId: string) {
  const category = await prisma.category.findUnique({ where: { id: categoryId }, include: { parent: true } });
  if (!category || !category.active || (category.parent && !category.parent.active)) {
    throw new HttpError(400, 'This category is not available');
  }
  const ids = [category.id, ...(category.parentId ? [category.parentId] : [])];
  const grant = await prisma.merchantCategory.findFirst({
    where: { merchantId, categoryId: { in: ids }, status: 'APPROVED' },
  });
  if (grant) return category;

  const sub = await activeSubscription(merchantId);
  const root = category.parent ?? category;
  if (sub && sub.plan.maxCategories === 0 && !root.requiresApproval) return category;

  throw new HttpError(403, `You are not authorised to sell in "${root.name}". Request access or upgrade your plan.`);
}
