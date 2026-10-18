'use client';

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money } from '@/lib/format';

const short = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const compact = (paise: number) => {
  const r = paise / 100;
  if (r >= 1e5) return `₹${(r / 1e5).toFixed(1)}L`;
  if (r >= 1e3) return `₹${(r / 1e3).toFixed(0)}k`;
  return `₹${r.toFixed(0)}`;
};

export function RevenueChart({ data, dataKey }: { data: { date: string; [k: string]: number | string }[]; dataKey: string }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={short} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tickFormatter={compact} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} width={56} />
          <Tooltip
            formatter={(v: number) => [money(v), 'Sales']}
            labelFormatter={(l: string) => short(l)}
            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
          />
          <Area type="monotone" dataKey={dataKey} stroke="#4f46e5" strokeWidth={2} fill="url(#rev)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OrdersBar({ data }: { data: { date: string; orders: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={short} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} width={32} />
          <Tooltip labelFormatter={(l: string) => short(l)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} />
          <Bar dataKey="orders" fill="#f59e0b" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
