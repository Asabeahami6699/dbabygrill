import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCartStore } from '../../store/cartStore';
import { useProductStore } from '../../store/productStore';
import CartIcon from '../cart/CartIcon';
import NotificationBell from '../companyDashboard/NotificationBell';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Suggestion {
  type: 'product' | 'category';
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  image?: string;
}

// ─── Search Box with Suggestions ─────────────────────────────────────────────
function SearchBox({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate();
  const { products } = useProductStore();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Build suggestions from live product store data
  const suggestions = useMemo<Suggestion[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];

    const results: Suggestion[] = [];
    const seenCategories = new Set<string>();

    for (const p of products) {
      if (results.length >= 8) break;

      // Product match
      if (
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q)
      ) {
        results.push({
          type: 'product',
          id: p.id,
          label: p.name,
          sublabel: p.company_name,
          href: `/store/${p.company_id}/product/${p.id}`,
          image: p.image_url ?? undefined,
        });
      }

      // Category match (deduplicated)
      if (
        p.category &&
        !seenCategories.has(p.category) &&
        p.category.toLowerCase().includes(q)
      ) {
        seenCategories.add(p.category);
        results.push({
          type: 'category',
          id: `cat-${p.category}`,
          label: p.category,
          sublabel: 'Category',
          href: `/?category=${encodeURIComponent(p.category)}`,
        });
      }
    }

    return results.slice(0, 7);
  }, [query, products]);

  const showDropdown = open && query.trim().length > 0;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCursor(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const commit = (suggestion?: Suggestion) => {
    if (suggestion) {
      navigate(suggestion.href);
    } else if (query.trim()) {
      navigate(`/?search=${encodeURIComponent(query.trim())}`);
    }
    setQuery('');
    setOpen(false);
    setCursor(-1);
    onClose?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) {
      if (e.key === 'Enter') commit();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commit(cursor >= 0 ? suggestions[cursor] : undefined);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setCursor(-1);
    }
  };

  const typeIcon = (type: Suggestion['type']) => {
    if (type === 'category') return (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    );
    return (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    );
  };

  const typeBadgeClass = (type: Suggestion['type']) => {
    if (type === 'category') return 'bg-purple-50 text-purple-600';
    return 'bg-orange-50 text-orange-600';
  };

  // Highlight matched text
  const highlight = (text: string, q: string) => {
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return <span>{text}</span>;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-orange-100 text-orange-700 rounded px-0.5 not-italic font-semibold">
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div ref={boxRef} className="relative w-full">
      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search restaurants or dishes..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setCursor(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full px-4 py-2 pl-10 pr-8 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm transition-all"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
        />
        {/* Search icon */}
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {/* Clear button */}
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setOpen(false); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Clear search"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[999]"
          role="listbox"
        >
          {suggestions.length > 0 ? (
            <>
              <ul className="py-1">
                {suggestions.map((s, i) => (
                  <li key={s.id} role="option" aria-selected={cursor === i}>
                    <button
                      type="button"
                      onMouseEnter={() => setCursor(i)}
                      onMouseDown={e => { e.preventDefault(); commit(s); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        cursor === i ? 'bg-orange-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* Thumbnail or icon */}
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden ${typeBadgeClass(s.type)}`}>
                        {s.image ? (
                          <img src={s.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          typeIcon(s.type)
                        )}
                      </div>

                      {/* Labels */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {highlight(s.label, query.trim())}
                        </p>
                        {s.sublabel && (
                          <p className="text-xs text-gray-400 truncate">{s.sublabel}</p>
                        )}
                      </div>

                      {/* Type badge */}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 capitalize ${typeBadgeClass(s.type)}`}>
                        {s.type}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {/* Footer — full search */}
              <div className="border-t border-gray-100">
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); commit(); }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-orange-600 hover:bg-orange-50 transition-colors font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search all results for <span className="font-bold ml-1">"{query.trim()}"</span>
                </button>
              </div>
            </>
          ) : (
            /* No matches */
            <div className="px-4 py-6 text-center">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-sm font-medium text-gray-700">No matches for "{query}"</p>
              <p className="text-xs text-gray-400 mt-1">Try a different word or browse all meals</p>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); commit(); }}
                className="mt-3 text-xs text-orange-600 hover:text-orange-700 font-semibold underline"
              >
                Search anyway
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
export default function Navbar() {
  const { user, signOut } = useAuth();
  const { totalItems } = useCartStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDesktopDropdownOpen, setIsDesktopDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsDesktopDropdownOpen(false);
  }, [location]);

  // Close desktop dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.desktop-dropdown')) {
        setIsDesktopDropdownOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setIsMobileMenuOpen(false);
    setIsDesktopDropdownOpen(false);
    navigate('/');
  };

  const handleCartClick = () => {
    navigate('/cart');
    setIsMobileMenuOpen(false);
  };

  const getProfileLink = () => {
    if (user?.role === 'admin') return '/admin/dashboard';
    if (user?.role === 'company_admin') return '/company/dashboard';
    return '/profile';
  };

  const getProfileLabel = () => {
    if (user?.role === 'admin') return 'Admin Dashboard';
    if (user?.role === 'company_admin') return 'Restaurant Dashboard';
    return 'My Profile';
  };

  const isDashboardPage = location.pathname.includes('/dashboard');
  if (isDashboardPage) return null;

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 bg-white z-50 transition-shadow duration-300 ${
        isScrolled ? 'shadow-lg' : 'shadow-md'
      }`}>
        <div className="container mx-auto px-3 sm:px-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 sm:py-3 gap-2 sm:gap-0">

            {/* Left — hamburger + logo */}
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <div className="flex items-center gap-2 sm:hidden">
                <button
                  onClick={() => setIsMobileMenuOpen(o => !o)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Toggle menu"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isMobileMenuOpen
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
                  </svg>
                </button>
                <NotificationBell />
              </div>

              <Link to="/" className="text-xl sm:text-2xl font-bold text-orange-600 shrink-0">
                D-BABY GRILLS
              </Link>
            </div>

            {/* Centre — Search (desktop uses SearchBox component) */}
            <div className="w-full sm:flex-1 sm:max-w-md sm:mx-4">
              <SearchBox onClose={() => setIsMobileMenuOpen(false)} />
            </div>

            {/* Right — desktop only */}
            <div className="hidden sm:flex sm:items-center sm:gap-2">
              <NotificationBell />

              <div onClick={handleCartClick} className="cursor-pointer">
                <CartIcon />
              </div>

              {user ? (
                <div className="relative desktop-dropdown">
                  <button
                    onClick={() => setIsDesktopDropdownOpen(o => !o)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {user.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isDesktopDropdownOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isDesktopDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden z-50">
                      <div className="px-4 py-3 bg-gray-50 border-b">
                        <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                        <p className="text-xs text-gray-500 capitalize mt-0.5">{user.role?.replace('_', ' ')}</p>
                      </div>
                      <div className="py-1">
                        <Link to={getProfileLink()} onClick={() => setIsDesktopDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {getProfileLabel()}
                        </Link>
                        <Link to="/orders" onClick={() => setIsDesktopDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          My Orders
                        </Link>
                        <Link to="/cart" onClick={() => setIsDesktopDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          My Cart
                          {totalItems > 0 && (
                            <span className="ml-auto bg-orange-600 text-white text-xs px-1.5 py-0.5 rounded-full">{totalItems}</span>
                          )}
                        </Link>
                        <hr className="my-1" />
                        <button onClick={handleSignOut}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link to="/login"
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium">
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`md:hidden bg-white border-t border-gray-100 transition-all duration-300 overflow-hidden ${
          isMobileMenuOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <div className="container mx-auto px-4 py-3 space-y-2">
            <div className="flex items-center justify-between py-3 px-3 bg-gray-50 rounded-lg mb-2">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="font-medium text-gray-900">Notifications</span>
              </div>
              <span className="text-xs text-gray-500">Use top bell</span>
            </div>

            <button onClick={handleCartClick}
              className="w-full flex items-center justify-between py-3 px-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors mb-2">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="font-medium text-gray-900">My Cart</span>
              </div>
              {totalItems > 0 && (
                <span className="bg-orange-600 text-white text-xs font-bold px-2 py-1 rounded-full">{totalItems}</span>
              )}
            </button>

            {user ? (
              <>
                <div className="py-2 px-3 bg-gray-50 rounded-lg mb-2">
                  <p className="text-xs text-gray-500">Signed in as</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                  <p className="text-xs text-orange-600 capitalize mt-1">{user.role?.replace('_', ' ')}</p>
                </div>
                <Link to={getProfileLink()} onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 py-2 px-3 text-gray-700 hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {getProfileLabel()}
                </Link>
                <Link to="/orders" onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 py-2 px-3 text-gray-700 hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  My Orders
                </Link>
                <button onClick={handleSignOut}
                  className="w-full flex items-center gap-3 py-2 px-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}
                  className="block py-2 px-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-center font-medium">
                  Sign In
                </Link>
                <Link to="/register" onClick={() => setIsMobileMenuOpen(false)}
                  className="block py-2 px-3 text-gray-700 hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-colors text-center">
                  Create Account
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Spacer */}
      <div className="h-16 sm:h-20 lg:h-24" />
    </>
  );
}