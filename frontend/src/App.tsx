// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import { useEffect, useState } from 'react';
import { useCartStore } from './store/cartStore';
import { useAuth } from './context/AuthContext';
import { useBrowserNotifications } from './hooks/useBrowserNotifications';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { Toaster } from 'react-hot-toast';
import { supabase } from './api/supabase';
import { useProductStore } from './store/productStore';
import { useOrderStore } from './store/orderStore';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrdersPage from './pages/OrdersPage';
import ProductDetailPage from './pages/ProductDetailPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/admin/AdminDashboard';
import CompanyDashboard from './pages/company/CompanyDashboard';
import PaymentCallback from './pages/PaymentCallback';
import DeliveryDashboard from './pages/deliveryGuy/Deliverydashboard';

// ── Browser push permission (free Web Notifications API) ─────────────────────
function BrowserNotificationBootstrap() {
  useBrowserNotifications();
  return null;
}

function NetworkStatusBootstrap() {
  useNetworkStatus();
  return null;
}

// ── Cart initializer ───────────────────────────────────────────────────────────
function CartInitializer() {
  const loadCart = useCartStore((state) => state.loadCart);
  const { user, loading: authLoading } = useAuth();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (authLoading || initialized) return;
    if (user) {
      console.log('User authenticated, loading cart from backend...');
      loadCart();
    } else {
      console.log('No user, keeping local cart from localStorage');
    }
    setInitialized(true);
  }, [user, authLoading, loadCart, initialized]);

  return null;
}

// ── Global realtime cache busting ─────────────────────────────────────────────
function GlobalRealtimeChannels() {
  useEffect(() => {
    const productsChannel = supabase
      .channel('global-products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        useProductStore.getState().invalidateCache();
      })
      .subscribe();

    const ordersChannel = supabase
      .channel('global-orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        useOrderStore.getState().invalidateCache();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(ordersChannel);
    };
  }, []);

  return null;
}

// ── Role-based catch-all redirect ─────────────────────────────────────────────
// Prevents delivery_guy (and others) landing on a blank/wrong page
function RoleBasedRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  switch (user.role) {
    case 'delivery_guy':  return <Navigate to="/delivery/dashboard" replace />;
    case 'company_admin': return <Navigate to="/company/dashboard" replace />;
    case 'admin':         return <Navigate to="/admin/dashboard" replace />;
    default:              return <Navigate to="/" replace />;
  }
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
        <NetworkStatusBootstrap />
        <BrowserNotificationBootstrap />
        <CartInitializer />
        <GlobalRealtimeChannels />
        <Routes>

          {/* Delivery dashboard — full screen, no Navbar/Footer */}
          <Route
            path="/delivery/dashboard"
            element={
              <ProtectedRoute allowedRoles={['delivery_guy']}>
                <DeliveryDashboard />
              </ProtectedRoute>
            }
          />

          {/* All other routes — with Navbar and Footer */}
          <Route
            path="*"
            element={
              <div className="min-h-screen bg-gray-50 flex flex-col">
                <Navbar />
                <main className="flex-grow">
                  <Routes>
                    {/* Public */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/cart" element={<CartPage />} />
                    <Route path="/orders" element={<OrdersPage />} />
                    <Route path="/orders/:id" element={<OrdersPage />} />
                    <Route path="/payment/callback" element={<PaymentCallback />} />
                    <Route path="/store/:companyId/product/:productId" element={<ProductDetailPage />} />

                    {/* Protected */}
                    <Route path="/checkout" element={
                      <ProtectedRoute>
                        <CheckoutPage />
                      </ProtectedRoute>
                    } />
                    <Route path="/profile" element={
                      <ProtectedRoute>
                        <ProfilePage />
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/dashboard" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminDashboard />
                      </ProtectedRoute>
                    } />
                    <Route path="/company/dashboard" element={
                      <ProtectedRoute allowedRoles={['company_admin']}>
                        <CompanyDashboard />
                      </ProtectedRoute>
                    } />

                    {/* Catch-all — redirects each role to their correct page */}
                    <Route path="*" element={<RoleBasedRedirect />} />
                  </Routes>
                </main>
                <Footer />
              </div>
            }
          />

        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;