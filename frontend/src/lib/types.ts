export type Role = 'ADMIN' | 'MERCHANT' | 'CUSTOMER';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  merchant?: { id: string; businessName: string; status: MerchantStatus } | null;
};

export type MerchantStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';
export type ProductStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PLACED'
  | 'CONFIRMED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURN_REQUESTED'
  | 'RETURNED';

export type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  commissionBps: number;
  requiresApproval: boolean;
  active: boolean;
  sortOrder: number;
  parentId: string | null;
  children?: Category[];
  _count?: { products: number; merchantAccess?: number };
};

export type ProductCard = {
  id: string;
  name: string;
  price: number;
  mrp: number;
  images: string[];
  rating: number;
  ratingCount: number;
  stock: number;
  featured: boolean;
  merchant: { id: string; businessName: string };
  category: { name: string; slug: string };
};

export type Review = { id: string; rating: number; comment: string; createdAt: string; user: { name: string } };

export type ProductDetail = ProductCard & {
  description: string;
  specs: Record<string, string> | null;
  category: { id: string; name: string; slug: string };
  merchant: ProductCard['merchant'] & {
    description: string | null;
    city: string;
    state: string;
    deliveryDays: number;
    createdAt: string;
  };
  reviews: Review[];
};

export type Plan = {
  id: string;
  name: string;
  description: string;
  price: number;
  durationDays: number;
  productLimit: number;
  maxCategories: number;
  features: string[];
  active: boolean;
  sortOrder: number;
  _count?: { subscriptions: number };
};

export type Quote = { subtotal: number; discount: number; shippingFee: number; total: number; coupon: string | null };

export type CartItem = {
  id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    mrp: number;
    images: string[];
    stock: number;
    status: ProductStatus;
    merchant: { businessName: string; status: MerchantStatus };
  };
};

export type Cart = { items: CartItem[]; quote: Quote; count: number };

export type Address = {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
};

export type OrderItem = {
  id: string;
  productId: string;
  name: string;
  image: string | null;
  price: number;
  quantity: number;
  status: OrderStatus;
  commission: number;
  merchantEarning: number;
  merchant: { businessName: string };
};

export type Order = {
  id: string;
  number: string;
  createdAt: string;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  couponCode: string | null;
  paymentMethod: 'COD' | 'RAZORPAY';
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  status: OrderStatus;
  address: Omit<Address, 'id' | 'isDefault'>;
  items: OrderItem[];
  user?: { name: string; email?: string };
};

export type Paged<T> = { total: number; page: number; pages: number } & T;
