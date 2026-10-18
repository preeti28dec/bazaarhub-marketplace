import { redirect } from 'next/navigation';
import { Shell, type NavItem } from '@/components/dashboard/Shell';
import { getCurrentUser } from '@/lib/server';

const nav: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/admin/merchants', label: 'Merchants', icon: 'Store' },
  { href: '/admin/access', label: 'Category access', icon: 'KeyRound' },
  { href: '/admin/plans', label: 'Plans & subscriptions', icon: 'BadgeCheck' },
  { href: '/admin/products', label: 'Products', icon: 'Package' },
  { href: '/admin/categories', label: 'Categories', icon: 'FolderTree' },
  { href: '/admin/orders', label: 'Orders & returns', icon: 'ShoppingBag' },
  { href: '/admin/customers', label: 'Customers', icon: 'Users' },
  { href: '/admin/coupons', label: 'Coupons', icon: 'TicketPercent' },
  { href: '/admin/audit', label: 'Audit log', icon: 'ScrollText' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin');
  if (user.role !== 'ADMIN') redirect('/');
  return (
    <Shell nav={nav} title="Admin Console">
      {children}
    </Shell>
  );
}
