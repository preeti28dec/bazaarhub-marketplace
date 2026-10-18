import { BookOpen, Mail, Phone } from 'lucide-react';
import { PageHeader } from '@/components/ui';

const FAQ = [
  ['Why is my product "In review"?', 'Every new listing, and any change to name, description, images or category, is checked by our team. This usually takes a few hours.'],
  ['How is commission calculated?', 'Each category has a commission rate set by the admin (some sellers have custom rates). It is deducted from the item price when the order is placed.'],
  ['How do I sell in another category?', 'Go to Plan & categories and request access. If your plan limit is reached, upgrade your plan first.'],
  ['When do I get paid?', 'Earnings from delivered orders become “settled” and are paid out on the weekly payout cycle.'],
];

export default function SupportPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Help & support" subtitle="We are here to help you grow" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          [Mail, 'Email', 'sellers@bazaarhub.test'],
          [Phone, 'Phone', '1800-000-1111'],
          [BookOpen, 'Seller guide', 'Coming soon'],
        ].map(([Icon, title, text]) => {
          const I = Icon as typeof Mail;
          return (
            <div key={title as string} className="card p-5">
              <I className="h-5 w-5 text-brand-600" />
              <p className="mt-3 font-semibold">{title as string}</p>
              <p className="text-sm text-slate-500">{text as string}</p>
            </div>
          );
        })}
      </div>
      <div className="card mt-6 divide-y divide-slate-100">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group p-5">
            <summary className="cursor-pointer list-none font-medium text-slate-900">{q}</summary>
            <p className="mt-2 text-sm text-slate-600">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
