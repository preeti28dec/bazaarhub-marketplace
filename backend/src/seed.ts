/**
 * Idempotent seed. Always ensures an admin exists; demo data is added only when SEED_DEMO=true
 * and the database has no categories yet.
 */
import bcrypt from 'bcryptjs';
import type { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from './lib/prisma';
import { splitCommission } from './lib/pricing';

const img = (id: string) => `https://images.unsplash.com/${id}?w=800&q=80&auto=format&fit=crop`;
const rupees = (n: number) => Math.round(n * 100);

const CATEGORIES = [
  { slug: 'food-grocery', name: 'Food & Grocery', icon: 'ShoppingBasket', commission: 500, requiresApproval: true },
  { slug: 'fashion', name: 'Clothes & Fashion', icon: 'Shirt', commission: 1500 },
  { slug: 'electronics', name: 'Electronics & Gadgets', icon: 'Smartphone', commission: 800 },
  { slug: 'beauty', name: 'Beauty & Personal Care', icon: 'Sparkles', commission: 1200 },
  { slug: 'home-furniture', name: 'Home & Furniture', icon: 'Sofa', commission: 1000 },
  { slug: 'healthcare', name: 'Medicines & Healthcare', icon: 'HeartPulse', commission: 600, requiresApproval: true },
  { slug: 'books', name: 'Books & Stationery', icon: 'BookOpen', commission: 700 },
  { slug: 'sports', name: 'Sports & Fitness', icon: 'Dumbbell', commission: 1000 },
  { slug: 'jewellery', name: 'Jewellery & Accessories', icon: 'Gem', commission: 1300 },
  { slug: 'local-services', name: 'Local Services', icon: 'Wrench', commission: 1500, requiresApproval: true },
  { slug: 'digital', name: 'Digital Products', icon: 'Download', commission: 2000 },
];

const SUBCATEGORIES: Record<string, string[]> = {
  fashion: ['Men', 'Women', 'Footwear'],
  electronics: ['Mobiles', 'Laptops', 'Audio', 'Cameras'],
  'home-furniture': ['Furniture', 'Decor & Lighting'],
};

type P = [name: string, cat: string, merchant: string, price: number, mrp: number, stock: number, image: string, description: string, specs: Record<string, string>];

const PRODUCTS: P[] = [
  ['Aura ANC Wireless Headphones', 'electronics', 'urban', 2499, 4999, 42, 'photo-1505740420928-5e560c06d30e', 'Over-ear headphones with active noise cancellation, 40-hour battery life and plush memory-foam cushions for all-day comfort.', { Battery: '40 hours', Connectivity: 'Bluetooth 5.3', Warranty: '1 year' }],
  ['Nova 14 Ultrabook Laptop', 'electronics', 'urban', 54990, 69990, 8, 'photo-1496181133206-80ce9b88a853', 'A featherlight 14-inch laptop with a crisp 2.8K display, 16 GB RAM and 512 GB SSD — built for work, study and travel.', { Processor: 'Ryzen 7 7840U', RAM: '16 GB', Storage: '512 GB SSD', Display: '14" 2.8K' }],
  ['Orbit 5G Smartphone (128 GB)', 'electronics', 'urban', 17999, 22999, 25, 'photo-1511707171634-5f897ff02aa9', 'Fast 5G phone with a 120 Hz AMOLED display, 50 MP camera and 5000 mAh battery with 33 W fast charging.', { Display: '6.6" AMOLED 120Hz', Camera: '50 MP', Battery: '5000 mAh' }],
  ['Instant Film Camera', 'electronics', 'urban', 6499, 7999, 4, 'photo-1526170375885-4d8ecf77b99f', 'Point, shoot and hold your memories in seconds. Auto exposure and built-in selfie mirror.', { 'Film type': 'Instant mini', Flash: 'Auto' }],
  ['Essential Cotton Crew T-Shirt', 'fashion', 'urban', 399, 799, 120, 'photo-1521572163474-6864f9cf17ab', '100% combed cotton tee with a relaxed fit. Breathable, pre-shrunk and soft wash after wash.', { Fabric: '100% Cotton', Fit: 'Regular', Care: 'Machine wash' }],
  ['Velocity Running Sneakers', 'fashion', 'urban', 2799, 4499, 30, 'photo-1542291026-7eec264c27ff', 'Lightweight running shoes with responsive cushioning and a breathable knit upper.', { Sole: 'EVA foam', Upper: 'Knit mesh' }],
  ['Polarised Aviator Sunglasses', 'jewellery', 'urban', 999, 2499, 60, 'photo-1572635196237-14b3f281503f', 'Classic aviators with UV400 polarised lenses and a lightweight metal frame.', { Lens: 'Polarised UV400', Frame: 'Metal' }],
  ['Kundan Necklace Set (Gold-Plated)', 'jewellery', 'urban', 3299, 5999, 12, 'photo-1515562141207-7a88fb7ce338', 'Handcrafted gold-plated kundan necklace with matching earrings — perfect for festive occasions.', { Plating: '22K gold', Includes: 'Necklace + earrings' }],
  ['Classic Minimal Analog Watch', 'jewellery', 'urban', 1899, 3499, 3, 'photo-1523275335684-37898b6baf30', 'Clean dial, genuine leather strap and 3 ATM water resistance. Understated everyday style.', { Strap: 'Leather', 'Water resistance': '3 ATM' }],
  ['Farm Fresh Vegetable Basket (5 kg)', 'food-grocery', 'fresh', 449, 599, 50, 'photo-1542838132-92c53300491e', 'Seasonal vegetables sourced every morning from local farms. Washed, sorted and delivered fresh.', { Weight: '5 kg', Shelf: '3–5 days refrigerated' }],
  ['Cold-Pressed Groundnut Oil (1 L)', 'food-grocery', 'fresh', 329, 399, 80, 'photo-1474979266404-7eaacbcd87c5', 'Traditional wood-pressed groundnut oil with natural aroma and no added chemicals.', { Volume: '1 litre', Process: 'Wood-pressed' }],
  ['Organic Alphonso Mangoes (1 dozen)', 'food-grocery', 'fresh', 899, 1199, 0, 'photo-1553279768-865429fa0078', 'GI-tagged Ratnagiri Alphonso mangoes, naturally ripened without carbide.', { Origin: 'Ratnagiri', Count: '12 pcs' }],
  ['Vitamin C Glow Serum (30 ml)', 'beauty', 'glow', 549, 999, 70, 'photo-1556228578-8c89e6adf883', 'Brightening serum with 10% vitamin C and hyaluronic acid for an even, radiant complexion.', { Volume: '30 ml', 'Skin type': 'All' }],
  ['Oud Noir Eau de Parfum (100 ml)', 'beauty', 'glow', 1799, 2999, 22, 'photo-1541643600914-78b084683601', 'A rich, long-lasting fragrance with notes of oud, amber and saffron.', { Volume: '100 ml', Longevity: '8–10 hours' }],
  ['Nordic 3-Seater Fabric Sofa', 'home-furniture', 'glow', 24999, 39999, 5, 'photo-1555041469-a586c61ea9bc', 'Mid-century 3-seater with solid wood legs and stain-resistant fabric. Free installation.', { Material: 'Sheesham wood + fabric', Seating: '3' }],
  ['Ceramic Table Lamp', 'home-furniture', 'glow', 1499, 2199, 18, 'photo-1507473885765-e6ed057f782c', 'Hand-glazed ceramic base with a linen shade. Warm ambient light for bedrooms and living rooms.', { Height: '45 cm', Bulb: 'E27 (not included)' }],
  ['Bestseller Fiction Bundle (Set of 5)', 'books', 'glow', 1299, 2495, 35, 'photo-1512820790803-83ca734da794', 'Five chart-topping paperback novels — a perfect gift for book lovers.', { Format: 'Paperback', Language: 'English' }],
  ['Adjustable Dumbbell Set (20 kg)', 'sports', 'glow', 3499, 5499, 14, 'photo-1517836357463-d25dfeac3438', 'Space-saving adjustable dumbbells with anti-slip grip, ideal for home workouts.', { 'Total weight': '20 kg', Grip: 'Knurled' }],
  ['Daily Multivitamin Tablets (60)', 'healthcare', 'glow', 449, 699, 90, 'photo-1584308666744-24d5c474f2ae', 'Complete daily multivitamin with 24 essential nutrients for energy and immunity.', { Count: '60 tablets', Dosage: '1 per day' }],
];

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@shop.test').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
  const hasAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!hasAdmin) {
    await prisma.user.create({
      data: { email: adminEmail, name: 'Platform Admin', role: 'ADMIN', passwordHash: await bcrypt.hash(adminPassword, 12), emailVerified: true },
    });
    console.log(`Created admin ${adminEmail}`);
  }

  if (process.env.SEED_DEMO !== 'true' || (await prisma.category.count()) > 0) {
    console.log('Seed: nothing else to do');
    return;
  }
  console.log('Seeding demo data…');
  const hash = (p: string) => bcrypt.hash(p, 10);

  // Categories
  const cats: Record<string, { id: string; commissionBps: number }> = {};
  for (const [i, c] of CATEGORIES.entries()) {
    const created = await prisma.category.create({
      data: { slug: c.slug, name: c.name, icon: c.icon, commissionBps: c.commission, requiresApproval: c.requiresApproval ?? false, sortOrder: i },
    });
    cats[c.slug] = created;
    for (const [j, sub] of (SUBCATEGORIES[c.slug] ?? []).entries()) {
      await prisma.category.create({
        data: { slug: `${c.slug}-${sub.toLowerCase().replace(/[^a-z]+/g, '-')}`, name: sub, parentId: created.id, commissionBps: c.commission, sortOrder: j },
      });
    }
  }

  // Plans (all values editable later from Admin → Plans)
  const basic = await prisma.plan.create({
    data: { name: 'Basic', description: 'Start selling in one category', price: rupees(499), durationDays: 30, productLimit: 25, maxCategories: 1, features: ['basic_analytics'], sortOrder: 1 },
  });
  const growth = await prisma.plan.create({
    data: { name: 'Growth', description: 'Grow across multiple categories', price: rupees(1499), durationDays: 30, productLimit: 200, maxCategories: 3, features: ['basic_analytics', 'advanced_analytics', 'promotions'], sortOrder: 2 },
  });
  const premium = await prisma.plan.create({
    data: { name: 'Premium', description: 'All eligible categories, unlimited listings', price: rupees(3999), durationDays: 30, productLimit: 0, maxCategories: 0, features: ['basic_analytics', 'advanced_analytics', 'promotions', 'priority_support'], sortOrder: 3 },
  });

  const now = new Date();
  const activeSub = (planId: string, amount: number) => ({
    planId, amount, status: 'ACTIVE' as const, paymentRef: 'DEMO-SEED', startsAt: now, endsAt: new Date(now.getTime() + 30 * 86_400_000),
  });

  const makeMerchant = async (o: {
    email: string; owner: string; business: string; city: string; state: string; status: 'APPROVED' | 'PENDING';
    planId: string; amount: number; categories: string[]; description: string; subStatus?: 'ACTIVE' | 'PENDING_PAYMENT';
  }) => {
    const user = await prisma.user.create({
      data: {
        email: o.email, name: o.owner, role: 'MERCHANT', phone: '9876500000', passwordHash: await hash('Merchant@123'), emailVerified: true,
        merchant: {
          create: {
            businessName: o.business, phone: '9876500000', addressLine: '12, Market Road', city: o.city, state: o.state, pincode: '110001',
            pan: 'ABCDE1234F', status: o.status, description: o.description, businessHours: 'Mon–Sat, 9 AM – 8 PM',
            categoryAccess: {
              create: o.categories.map((slug) => ({ categoryId: cats[slug].id, status: o.status === 'APPROVED' ? ('APPROVED' as const) : ('PENDING' as const) })),
            },
            subscriptions: {
              create: o.subStatus === 'PENDING_PAYMENT' ? { planId: o.planId, amount: o.amount } : activeSub(o.planId, o.amount),
            },
          },
        },
      },
      include: { merchant: true },
    });
    return user.merchant!;
  };

  const merchants = {
    urban: await makeMerchant({
      email: 'merchant@shop.test', owner: 'Rahul Verma', business: 'UrbanKart Retail', city: 'New Delhi', state: 'Delhi', status: 'APPROVED',
      planId: growth.id, amount: growth.price, categories: ['electronics', 'fashion', 'jewellery'], description: 'Trendy gadgets, fashion and accessories at honest prices.',
    }),
    fresh: await makeMerchant({
      email: 'fresh@shop.test', owner: 'Sunita Patel', business: 'FreshBasket Grocers', city: 'Ahmedabad', state: 'Gujarat', status: 'APPROVED',
      planId: basic.id, amount: basic.price, categories: ['food-grocery'], description: 'Farm-fresh groceries delivered daily.',
    }),
    glow: await makeMerchant({
      email: 'glow@shop.test', owner: 'Ananya Iyer', business: 'GlowUp Lifestyle', city: 'Bengaluru', state: 'Karnataka', status: 'APPROVED',
      planId: premium.id, amount: premium.price, categories: ['healthcare'], description: 'Beauty, home, books and wellness — curated with care.',
    }),
  };
  await makeMerchant({
    email: 'pending@shop.test', owner: 'Mahesh Gupta', business: 'Shree Ganesh Traders', city: 'Jaipur', state: 'Rajasthan', status: 'PENDING',
    planId: basic.id, amount: basic.price, categories: ['home-furniture'], description: 'Handcrafted Rajasthani decor.', subStatus: 'PENDING_PAYMENT',
  });

  // Products
  const createProduct = (data: Prisma.ProductUncheckedCreateInput) =>
    prisma.product.create({ data, include: { category: true, merchant: true } });
  const products: Awaited<ReturnType<typeof createProduct>>[] = [];
  for (const [i, [name, cat, m, price, mrp, stock, image, description, specs]] of PRODUCTS.entries()) {
    products.push(
      await createProduct({
        name, description, specs, categoryId: cats[cat].id, merchantId: merchants[m as keyof typeof merchants].id,
        price: rupees(price), mrp: rupees(mrp), stock, images: [img(image)], status: 'APPROVED', featured: i % 3 === 0,
        createdAt: new Date(now.getTime() - i * 2 * 86_400_000),
      }),
    );
  }
  await prisma.product.create({
    data: {
      name: 'Boom Bluetooth Party Speaker', description: 'Portable 30 W speaker with RGB lights, deep bass and 12-hour playback.',
      categoryId: cats.electronics.id, merchantId: merchants.urban.id, price: rupees(2199), mrp: rupees(3999), stock: 20,
      images: [img('photo-1608043152269-423dbba4e7e1')], status: 'PENDING',
    },
  });

  // Customers, addresses, coupons
  const customerNames = [['customer@shop.test', 'Aarav Sharma'], ['priya@shop.test', 'Priya Nair'], ['rohan@shop.test', 'Rohan Mehta']];
  const customers = [];
  for (const [email, name] of customerNames) {
    customers.push(
      await prisma.user.create({
        data: {
          email, name, role: 'CUSTOMER', phone: '9812345678', passwordHash: await hash('Customer@123'), emailVerified: true,
          addresses: { create: { name, phone: '9812345678', line1: 'Flat 402, Lotus Residency', line2: 'Sector 21', city: 'Gurugram', state: 'Haryana', pincode: '122016', isDefault: true } },
        },
      }),
    );
  }
  await prisma.coupon.createMany({
    data: [
      { code: 'WELCOME10', description: '10% off up to ₹200 on orders above ₹499', type: 'PERCENT', value: 10, minOrder: rupees(499), maxDiscount: rupees(200) },
      { code: 'FLAT150', description: '₹150 off on orders above ₹999', type: 'FLAT', value: rupees(150), minOrder: rupees(999) },
    ],
  });

  // Historical orders for charts (deterministic pseudo-random)
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const address = { name: 'Aarav Sharma', phone: '9812345678', line1: 'Flat 402, Lotus Residency', city: 'Gurugram', state: 'Haryana', pincode: '122016' };
  for (let n = 0; n < 36; n++) {
    const daysAgo = Math.floor(rand() * 30);
    const createdAt = new Date(now.getTime() - daysAgo * 86_400_000 - Math.floor(rand() * 36_000_000));
    const status: OrderStatus = daysAgo > 6 ? 'DELIVERED' : daysAgo > 3 ? 'SHIPPED' : rand() > 0.5 ? 'CONFIRMED' : 'PLACED';
    const picks = [...new Set([Math.floor(rand() * products.length), Math.floor(rand() * products.length)])].slice(0, 1 + Math.floor(rand() * 2));
    const lines = picks.map((idx) => {
      const p = products[idx];
      const quantity = 1 + Math.floor(rand() * 2);
      const bps = p.merchant.commissionBps ?? p.category.commissionBps;
      return {
        productId: p.id, merchantId: p.merchantId, name: p.name, image: p.images[0], price: p.price, quantity,
        commissionBps: bps, ...splitCommission(p.price * quantity, bps), status,
      };
    });
    const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
    const shippingFee = subtotal >= 49_900 ? 0 : 4_000;
    const cod = rand() > 0.4;
    await prisma.order.create({
      data: {
        number: `ORD-DEMO${String(1000 + n)}`, userId: customers[n % customers.length].id, address, subtotal, shippingFee, total: subtotal + shippingFee,
        paymentMethod: cod ? 'COD' : 'RAZORPAY', paymentStatus: !cod || status === 'DELIVERED' ? 'PAID' : 'PENDING', status, createdAt,
        items: { create: lines },
      },
    });
    for (const l of lines) await prisma.product.update({ where: { id: l.productId }, data: { soldCount: { increment: l.quantity } } });
  }

  // Reviews
  const comments = ['Excellent quality, totally worth the price!', 'Delivered on time and well packed.', 'Good product, but packaging could be better.', 'Exactly as described. Would buy again.'];
  for (const [i, p] of products.entries()) {
    const count = 1 + (i % 3);
    for (let r = 0; r < count; r++) {
      await prisma.review.create({ data: { userId: customers[r].id, productId: p.id, rating: 5 - ((i + r) % 3 === 0 ? 1 : 0), comment: comments[(i + r) % comments.length] } });
    }
    const agg = await prisma.review.aggregate({ where: { productId: p.id }, _avg: { rating: true }, _count: true });
    await prisma.product.update({ where: { id: p.id }, data: { rating: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count } });
  }
  console.log('Demo data ready');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
