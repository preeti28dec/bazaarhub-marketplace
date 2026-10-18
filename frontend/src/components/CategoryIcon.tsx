import {
  BookOpen,
  Download,
  Dumbbell,
  Gem,
  HeartPulse,
  LayoutGrid,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

const icons: Record<string, LucideIcon> = {
  ShoppingBasket,
  Shirt,
  Smartphone,
  Sparkles,
  Sofa,
  HeartPulse,
  BookOpen,
  Dumbbell,
  Gem,
  Wrench,
  Download,
};

export function CategoryIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = (name && icons[name]) || LayoutGrid;
  return <Icon className={className} />;
}
