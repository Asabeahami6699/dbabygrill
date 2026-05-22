// pages/LandingPage.tsx
import { MouseEvent, useEffect, useRef, useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useCartStore } from '../store/cartStore';
import { useProductStore, ProductWithCompany } from '../store/productStore'; // ✅ import from store
import type { Product } from '../types';

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse">
      <div className="h-44 bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="flex justify-between">
          <div className="h-4 bg-gray-200 rounded w-3/5" />
          <div className="h-4 bg-gray-200 rounded w-1/5" />
        </div>
        <div className="h-3 bg-gray-100 rounded w-1/3" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-4/5" />
        <div className="h-9 bg-gray-200 rounded-lg mt-2" />
      </div>
    </div>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
const HOW_STEPS = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    title: 'Browse & Pick',
    desc: 'Explore menus from top grill restaurants near you and pick your favourites.',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: 'Place Your Order',
    desc: 'Add to cart, choose your delivery address and pay securely in seconds.',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
      </svg>
    ),
    title: 'Live Delivery',
    desc: 'Track your rider live on the map as your hot meal heads straight to your door.',
  },
];

// ─── Animated Stat ────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1400) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - t, 3);
            setVal(Math.round(ease * target));
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { val, ref };
}

function StatItem({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { val, ref } = useCountUp(value);
  return (
    <div ref={ref} className="text-center">
      <p className="text-2xl sm:text-3xl font-extrabold text-orange-600">
        {val.toLocaleString()}{suffix}
      </p>
      <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

// ─── Back to Top ──────────────────────────────────────────────────────────────
function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-24 right-4 z-40 bg-white border border-gray-200 shadow-lg rounded-full w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all duration-200"
      aria-label="Back to top"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
}

// ─── Floating Cart FAB ────────────────────────────────────────────────────────
function FloatingCart({ count }: { count: number }) {
  const navigate = useNavigate();
  if (count === 0) return null;
  return (
    <button
      onClick={() => navigate('/cart')}
      className="fixed bottom-6 right-4 z-40 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-full shadow-xl px-5 py-3 flex items-center gap-2.5 transition-all duration-200"
      aria-label={`View cart — ${count} item${count !== 1 ? 's' : ''}`}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <span className="font-semibold text-sm">{count} item{count !== 1 ? 's' : ''}</span>
      <span className="bg-white text-orange-600 font-bold text-xs rounded-full w-5 h-5 flex items-center justify-center">→</span>
    </button>
  );
}

// ─── Seamless scroll hook ─────────────────────────────────────────────────────
function useSeamlessScroll(
  ref: React.RefObject<HTMLDivElement>,
  speed: number,
  active: boolean
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    let raf = 0, last = 0, paused = false;
    let resumeTimer: number | undefined;

    const step = (t: number) => {
      if (!last) last = t;
      const dt = Math.min(0.033, (t - last) / 1000);
      last = t;
      if (!paused) {
        const half = el.scrollWidth / 2;
        el.scrollLeft += speed * dt;
        if (el.scrollLeft >= half) {
          el.scrollLeft -= half;
          last = performance.now();
        }
      }
      raf = requestAnimationFrame(step);
    };

    const pause = () => { paused = true; if (resumeTimer) clearTimeout(resumeTimer); };
    const resumeSoon = () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => { paused = false; }, 1200);
    };

    raf = requestAnimationFrame(step);
    el.addEventListener('mouseenter', pause);
    el.addEventListener('mouseleave', resumeSoon);
    el.addEventListener('touchstart', pause, { passive: true });
    el.addEventListener('touchend', resumeSoon, { passive: true });
    el.addEventListener('pointerdown', pause, { passive: true });
    el.addEventListener('pointerup', resumeSoon, { passive: true });
    el.addEventListener('pointercancel', resumeSoon, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      if (resumeTimer) clearTimeout(resumeTimer);
      el.removeEventListener('mouseenter', pause);
      el.removeEventListener('mouseleave', resumeSoon);
      el.removeEventListener('touchstart', pause);
      el.removeEventListener('touchend', resumeSoon);
      el.removeEventListener('pointerdown', pause);
      el.removeEventListener('pointerup', resumeSoon);
      el.removeEventListener('pointercancel', resumeSoon);
    };
  }, [ref, speed, active]);
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const addToCart = useCartStore((state) => state.addItem);
  const cartItems = useCartStore((state) => state.items);
  const { products, categories, isLoading, fetchProducts } = useProductStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedVariants, setSelectedVariants] = useState<Record<string, { label: string; price: number }>>({});
  const [addingStates, setAddingStates] = useState<Record<string, boolean>>({});

  const location = useLocation();
  const promoStripRef = useRef<HTMLDivElement | null>(null);

  const cartCount = useMemo(
    () => (cartItems ?? []).reduce((sum: number, item: any) => sum + (item.quantity ?? 1), 0),
    [cartItems]
  );

  useEffect(() => { fetchProducts(true); }, [fetchProducts]);

  useEffect(() => {
    const initial: Record<string, { label: string; price: number }> = {};
    products.forEach((p: ProductWithCompany) => {
      if (p.variants?.length > 0) initial[p.id] = p.variants[0];
    });
    setSelectedVariants(initial);
  }, [products]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const s = params.get('search') ?? '';
    if (s) setSearchTerm(s);
  }, [location.search]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const promotedProducts = useMemo(() =>
    [...products]
      .filter(p => p.is_promoted && p.is_available && p.stock_quantity > 0)
      .sort((a, b) => {
        const ar = a.promo_rank ?? Infinity;
        const br = b.promo_rank ?? Infinity;
        return ar !== br ? ar - br : (b.stock_quantity ?? 0) - (a.stock_quantity ?? 0);
      })
      .slice(0, 12),
    [products]
  );

  // "New" badge — added within last 7 days
  const newProductIds = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return new Set(
      products
        .filter(p => p.created_at && new Date(p.created_at).getTime() > cutoff)
        .map(p => p.id)
    );
  }, [products]);

  const filteredProducts = useMemo(() =>
    products.filter(p => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.company_name ?? '').toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q);
      return matchSearch && (selectedCategory === 'all' || p.category === selectedCategory);
    }),
    [products, searchTerm, selectedCategory]
  );

  useSeamlessScroll(promoStripRef, 60, promotedProducts.length >= 2);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleVariantChange = (productId: string, variantLabel: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const variant = product.variants.find(v => v.label === variantLabel);
    if (variant) setSelectedVariants(prev => ({ ...prev, [productId]: variant }));
  };

  const handleAddToCart = async (product: ProductWithCompany, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const selectedVariant = selectedVariants[product.id];
    let finalPrice: number;
    let variantLabel: string | undefined;

    if (product.variants?.length && selectedVariant) {
      finalPrice = selectedVariant.price;
      variantLabel = selectedVariant.label;
    } else {
      finalPrice = product.base_price ?? product.price ?? 0;
    }

    setAddingStates(prev => ({ ...prev, [product.id]: true }));
    try {
      await addToCart(
        { ...product, price: finalPrice } as unknown as Product,
        product.company_id,
        product.company_name ?? '',
        variantLabel,
        finalPrice
      );
      toast.success(
        `${product.name}${variantLabel ? ` (${variantLabel})` : ''} added to cart!`,
        { duration: 2000 }
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to add item to cart');
    } finally {
      setAddingStates(prev => ({ ...prev, [product.id]: false }));
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSelectedCategory('all');
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderPromoCard = (product: ProductWithCompany, index: number) => {
    const isClone = index >= promotedProducts.length;
    const sv = selectedVariants[product.id];
    const hasVariants = product.variants?.length > 0;
    const price = hasVariants && sv ? sv.price : (product.base_price ?? product.price ?? 0);
    const isAdding = addingStates[product.id] || false;

    return (
      <div
        key={`promo-${product.id}-${index}`}
        aria-hidden={isClone || undefined}
        className="flex-shrink-0 min-w-[200px] sm:min-w-[220px] max-w-[240px] bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
      >
        <Link
          to={`/store/${product.company_id}/product/${product.id}`}
          tabIndex={isClone ? -1 : undefined}
          className="block"
        >
          <div className="relative h-28 bg-gray-100 overflow-hidden">
            {product.image_url
              ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" loading="lazy" />
              : <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                  <span className="text-white text-3xl font-bold">{product.name.charAt(0)}</span>
                </div>
            }
            <div className="absolute top-2 left-2 bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Promo</div>
          </div>
        </Link>
        <div className="p-3">
          <div className="flex items-start justify-between gap-1 mb-0.5">
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{product.name}</h3>
            <span className="text-orange-600 font-bold text-sm shrink-0">₵{Number(price).toFixed(2)}</span>
          </div>
          <p className="text-xs text-gray-400 line-clamp-1 mb-2">{product.company_name}</p>
          {hasVariants && (
            <select
              value={sv?.label || ''}
              onChange={e => handleVariantChange(product.id, e.target.value)}
              tabIndex={isClone ? -1 : undefined}
              className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg mb-2 bg-gray-50"
            >
              {product.variants.map(v => (
                <option key={v.label} value={v.label}>{v.label} – ₵{v.price}</option>
              ))}
            </select>
          )}
          <button
            onClick={e => handleAddToCart(product, e)}
            disabled={isAdding}
            tabIndex={isClone ? -1 : undefined}
            className="w-full bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 transition-colors text-xs font-medium disabled:opacity-50"
          >
            {isAdding ? 'Adding...' : 'Add to Cart'}
          </button>
        </div>
      </div>
    );
  };

  const renderProductCard = (product: ProductWithCompany) => {
    const sv = selectedVariants[product.id];
    const hasVariants = product.variants?.length > 0;
    const price = hasVariants && sv ? sv.price : (product.base_price ?? product.price ?? 0);
    const isAdding = addingStates[product.id] || false;
    const isNew = newProductIds.has(product.id);

    return (
      <div
        key={product.id}
        className="group bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 border border-gray-50"
      >
        <Link to={`/store/${product.company_id}/product/${product.id}`} className="block">
          <div className="relative h-36 xs:h-40 sm:h-44 md:h-48 overflow-hidden bg-gray-100">
            {product.image_url
              ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
              : <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                  <span className="text-white text-4xl font-bold">{product.name.charAt(0)}</span>
                </div>
            }
            <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
              <div className="flex flex-col gap-1">
                {isNew && <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">NEW</span>}
                {product.is_promoted && <span className="bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">PROMO</span>}
              </div>
            </div>
          </div>
        </Link>

        <div className="p-3 sm:p-4">
          <Link to={`/store/${product.company_id}/product/${product.id}`}>
            <div className="flex justify-between items-start gap-2 mb-1">
              <h2 className="text-sm sm:text-base font-semibold text-gray-900 line-clamp-1 flex-1 group-hover:text-orange-600 transition-colors">
                {product.name}
              </h2>
              <span className="text-orange-600 font-bold text-sm sm:text-base shrink-0">
                ₵{Number(price).toFixed(2)}
              </span>
            </div>
            {product.category && (
              <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-600 mb-1">
                {product.category}
              </span>
            )}
            <p className="text-xs text-gray-400 mb-2 line-clamp-2">
              {product.description || 'No description available'}
            </p>
          </Link>

          {hasVariants && (
            <div className="mb-3">
              <select
                value={sv?.label || ''}
                onChange={e => handleVariantChange(product.id, e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:border-orange-300"
              >
                {product.variants.map(v => (
                  <option key={v.label} value={v.label}>{v.label} – ₵{v.price}</option>
                ))}
              </select>
            </div>
          )}

          <Link to={`/store/${product.company_id}`}>
            <div className="flex items-center gap-1 text-gray-400 mb-2 hover:text-orange-500 transition-colors">
              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p className="text-xs truncate">{product.company_name}</p>
            </div>
          </Link>

          {product.company_location && (
            <div className="flex items-center gap-1 text-gray-400 mb-3">
              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-xs truncate">{product.company_location}</p>
            </div>
          )}

          <button
            onClick={e => handleAddToCart(product, e)}
            disabled={isAdding || product.stock_quantity === 0}
            className="w-full bg-orange-600 text-white px-3 py-2 rounded-lg hover:bg-orange-700 transition-colors text-xs sm:text-sm font-medium active:bg-orange-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isAdding ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : product.stock_quantity === 0 ? 'Out of Stock' : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Add to Cart
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 pb-28">


      {/* ── Promoted Meals Strip ──────────────────────────────────────────── */}
      {promotedProducts.length > 0 && (
        <section className="mb-8 promo-enter">
          <div className="flex items-end justify-between mb-3 px-1">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">🔥 Promoted Meals</h2>
              <p className="text-xs text-gray-500">Limited-time top picks</p>
            </div>
          </div>
          <div ref={promoStripRef} className="overflow-x-auto strip-scroll" aria-label="Promoted meals">
            <div className="flex gap-3 pb-2">
              {[...promotedProducts, ...promotedProducts].map(renderPromoCard)}
            </div>
          </div>
        </section>
      )}

      {/* ── Animated Stats ────────────────────────────────────────────────── */}
      {products.length > 0 && (
        <section className="grid grid-cols-3 gap-4 bg-white border border-gray-100 rounded-2xl shadow-sm px-6 py-5 mb-8">
          <StatItem value={products.length} suffix="+" label="Menu items" />
          <StatItem value={30} suffix=" min" label="Avg. delivery" />
          <StatItem value={100} suffix="%" label="Fresh grilled" />
        </section>
      )}

      {/* ── User Guide ────────────────────────────────────────────────────── */}
      <section className="guide-section mb-8 border border-gray-200 rounded-xl overflow-hidden">
        <div className="w-full flex items-center justify-between px-5 py-4 bg-white cursor-default select-none">
          <div className="flex items-center gap-2">
            <span className="text-lg">📖</span>
            <span className="text-sm sm:text-base font-bold text-gray-900">User Guide</span>
            <span className="hidden sm:inline text-xs text-gray-400 font-normal ml-1">— hover to see how ordering works</span>
          </div>
          <svg className="guide-chevron w-5 h-5 text-gray-400 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div className="guide-body">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-5 pb-5 pt-1">
            {HOW_STEPS.map((step, i) => (
              <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0">
                  {step.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-orange-600 bg-orange-100 rounded-full w-5 h-5 flex items-center justify-center">
                      {i + 1}
                    </span>
                    <h3 className="text-sm font-bold text-gray-900">{step.title}</h3>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Category Filters ──────────────────────────────────────────────── */}
      {categories.length > 1 && (
        <div className="mb-5 overflow-x-auto strip-scroll">
          <div className="flex gap-2 pb-1 px-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300 hover:text-orange-600'
                }`}
              >
                {cat === 'all' ? 'All meals' : cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Active filter bar ─────────────────────────────────────────────── */}
      {(searchTerm || selectedCategory !== 'all') && (
        <div className="flex items-center justify-between mb-4 px-1">
          <p className="text-xs sm:text-sm text-gray-500">
            {filteredProducts.length} result{filteredProducts.length !== 1 ? 's' : ''}
            {searchTerm ? ` for "${searchTerm}"` : ''}
            {selectedCategory !== 'all' ? ` in ${selectedCategory}` : ''}
          </p>
          <button onClick={clearSearch} className="text-xs text-orange-600 hover:text-orange-700 font-medium">
            Clear ×
          </button>
        </div>
      )}

      {/* ── Products Grid ─────────────────────────────────────────────────── */}
      <section>
        {!searchTerm && selectedCategory === 'all' && products.length > 0 && (
          <div className="flex items-end justify-between mb-4 px-1">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">All Meals</h2>
              <p className="text-xs text-gray-500">{products.length} items available</p>
            </div>
          </div>
        )}

        {isLoading && products.length === 0 ? (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map(renderProductCard)}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🍖</div>
            <p className="text-gray-500 text-lg font-semibold">No products yet</p>
            <p className="text-gray-400 text-sm mt-1">Check back soon for delicious items!</p>
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-gray-500 text-lg font-semibold">No items found</p>
            <p className="text-gray-400 text-sm mt-1">Try a different search or category</p>
            <button
              onClick={clearSearch}
              className="mt-5 bg-orange-600 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-orange-700 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        )}
      </section>

      <style>{`
        .promo-enter {
          animation: promoEnter 500ms ease-out both;
        }
        @keyframes promoEnter {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .strip-scroll {
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
        }
        .strip-scroll::-webkit-scrollbar { height: 3px; }
        .strip-scroll::-webkit-scrollbar-thumb {
          background: rgba(156,163,175,0.3);
          border-radius: 999px;
        }
        .guide-body {
          overflow: hidden;
          max-height: 0;
          transition: max-height 350ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .guide-section:hover .guide-body {
          max-height: 500px;
        }
        .guide-section:hover .guide-chevron {
          transform: rotate(180deg);
        }
      `}</style>

      <FloatingCart count={cartCount} />
      <BackToTop />
    </div>
  );
}