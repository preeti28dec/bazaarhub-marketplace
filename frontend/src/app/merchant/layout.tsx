import { redirect } from 'next/navigation';
import { Shell, type NavItem } from '@/components/dashboard/Shell';
import { getCurrentUser } from '@/lib/server';

const nav: NavItem[] = [
  { href: '/merchant', label: 'Overview', icon: 'LayoutDashboard' },
  { href: '/merchant/products', label: 'Products', icon: 'Package' },
  { href: '/merchant/orders', label: 'Orders', icon: 'ShoppingBag' },
  { href: '/merchant/earnings', label: 'Earnings', icon: 'Wallet' },
  { href: '/merchant/plan', label: 'Plan & categories', icon: 'BadgeCheck' },
  { href: '/merchant/store', label: 'Store settings', icon: 'Settings' },
  { href: '/merchant/support', label: 'Help & support', icon: 'LifeBuoy' },
];

/** Server-side guard: the page is never rendered for non-merchants. The API enforces the same rule independently. */
export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/merchant');
  if (user.role !== 'MERCHANT') redirect('/');

  const status = user.merchant?.status;
  const banner =
    status && status !== 'APPROVED' ? (
      <div className={`px-4 py-3 text-sm sm:px-6 lg:px-8 ${status === 'PENDING' ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-800'}`}>
        {status === 'PENDING'
          ? 'Your seller account is under review. You can explore the dashboard; listing products unlocks once an admin approves your account.'
          : `Your seller account is ${status.toLowerCase()}. Contact support for help.`}
      </div>
    ) : null;

  return (
    <Shell nav={nav} title="Seller Central" banner={banner}>
      {children}
    </Shell>
  );
}
