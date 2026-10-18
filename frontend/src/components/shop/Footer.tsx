import Link from 'next/link';
import { ShieldCheck, RotateCcw, Truck, Headphones } from 'lucide-react';

const perks = [
  { icon: Truck, title: 'Fast delivery', text: 'Across 19,000+ pincodes' },
  { icon: ShieldCheck, title: 'Secure payments', text: 'UPI, cards, net banking & COD' },
  { icon: RotateCcw, title: 'Easy returns', text: '7-day hassle-free returns' },
  { icon: Headphones, title: '24×7 support', text: 'We are here to help' },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="container-page grid gap-6 border-b border-slate-100 py-8 sm:grid-cols-2 lg:grid-cols-4">
        {perks.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-center gap-3">
            <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{title}</p>
              <p className="text-xs text-slate-500">{text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="container-page grid gap-8 py-10 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-lg font-extrabold">
            Bazaar<span className="text-brand-600">Hub</span>
          </p>
          <p className="mt-2 text-slate-500">India&apos;s marketplace for trusted local and national sellers.</p>
        </div>
        <FooterCol title="Shop" links={[['All products', '/products'], ['Electronics', '/products?category=electronics'], ['Fashion', '/products?category=fashion'], ['Grocery', '/products?category=food-grocery']]} />
        <FooterCol title="Account" links={[['My orders', '/orders'], ['Wishlist', '/wishlist'], ['Cart', '/cart'], ['Profile', '/account']]} />
        <FooterCol title="Sell with us" links={[['Become a seller', '/sell'], ['Seller dashboard', '/merchant'], ['Seller login', '/login?next=/merchant']]} />
      </div>
      <div className="border-t border-slate-100 py-5 text-center text-xs text-slate-400">© {new Date().getFullYear()} BazaarHub. Demo marketplace.</div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="font-semibold text-slate-900">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-slate-500 hover:text-brand-700">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
