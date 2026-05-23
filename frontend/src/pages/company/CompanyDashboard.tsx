// src/pages/company/CompanyDashboard.tsx
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import CompanyGuide from '../../components/companyDashboard/guide/CompanyGuide';
import type { SettingsSubTab } from '../../components/companyDashboard/guide/companyGuideData';
import { Toaster } from 'react-hot-toast';
import { 
  useCompanyData, 
  useRealtimeOrders,
  CompanyHeader,
  Sidebar,
  MobileNavigation,
  DashboardOverview,
  ProductsManagement,
  RatingsManagement,
  OrdersManagement,
  CustomersList,
  Analytics,
  Settings,
  ProductModal,
  OrderDetailsModal
} from '../../components/companyDashboard';

// Mobile menu items (same as original)
const mobileMenuItems = [
  { id: 'ratings', name: 'Ratings', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z' },
  { id: 'analytics', name: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'settings', name: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
];

export default function CompanyDashboard() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { company, products, orders, loading, refreshData, refreshDataImmediate } = useCompanyData();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showOrderDetails, setShowOrderDetails] = useState<any>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [guideSettingsSubTab, setGuideSettingsSubTab] = useState<SettingsSubTab | null>(null);

  // Real-time order updates with fallback polling health state.
  const realtimeMode = useRealtimeOrders(company?.id, refreshDataImmediate);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Manual refresh handler – shows a spinner and prevents duplicate refreshes
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshData();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshData, isRefreshing]);

  const handleOpenOrderFromNotification = useCallback((orderId: string) => {
    setActiveTab('orders');
    const matched = orders.find((o) => o.id === orderId);
    if (matched) {
      setShowOrderDetails(matched);
      return;
    }
    refreshDataImmediate();
  }, [orders, refreshDataImmediate]);

  useEffect(() => {
    if (!loading && !isInitialized) {
      setIsInitialized(true);
    }
  }, [loading, isInitialized]);

  // Show initial loading only once
  if (loading && !isInitialized) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />

      {/* Mobile Bottom Navigation */}
      <MobileNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onMoreClick={() => setShowMobileMenu(!showMobileMenu)}
      />

      {/* Mobile Menu Drawer */}
      {showMobileMenu && (
        <div
          className="fixed inset-0 bg-black/50 z-[100] md:hidden transition-opacity duration-300"
          onClick={() => setShowMobileMenu(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl transform transition-transform duration-300 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white">
              <h3 className="font-semibold text-lg">Menu</h3>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-2">
              {mobileMenuItems.map((item) => (
                <button
                  key={item.id}
                  data-guide={`nav-${item.id}`}
                  onClick={() => {
                    setActiveTab(item.id);
                    setShowMobileMenu(false);
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    activeTab === item.id ? 'bg-orange-50 text-orange-600' : 'text-gray-700'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  <span>{item.name}</span>
                </button>
              ))}
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  handleSignOut();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg text-red-600 mt-2 border-t"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} onSignOut={handleSignOut} />

      <main className="md:ml-64 pb-20 md:pb-0">
        {/* Company Header with Refresh Button */}
        <CompanyHeader
          company={company}
          onAddItem={() => setShowProductModal(true)}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          realtimeMode={realtimeMode}
          onOpenOrderFromNotification={handleOpenOrderFromNotification}
        />

        <div className="p-3 sm:p-6">
          {activeTab === 'dashboard' && (
            <DashboardOverview
              orders={orders}
              products={products}
              onOrderClick={setShowOrderDetails}
            />
          )}
          {activeTab === 'products' && (
            <ProductsManagement
              products={products}
              onEdit={(product) => {
                setEditingProduct(product);
                setShowProductModal(true);
              }}
              onRefresh={handleRefresh}
            />
          )}
          {activeTab === 'ratings' && <RatingsManagement companyId={company?.id} />}
          {activeTab === 'orders' && (
            <OrdersManagement
              orders={orders}
              onUpdateStatus={handleRefresh}
              onViewDetails={setShowOrderDetails}
            />
          )}
          {activeTab === 'customers' && <CustomersList orders={orders} />}
          {activeTab === 'analytics' && <Analytics orders={orders} products={products} />}
          {activeTab === 'settings' && (
            <Settings
              company={company}
              onUpdate={handleRefresh}
              guideSubTab={guideSettingsSubTab}
            />
          )}
        </div>
      </main>

      {/* Modals */}
      <ProductModal
        isOpen={showProductModal}
        editingProduct={editingProduct}
        companyId={company?.id}
        onClose={() => {
          setShowProductModal(false);
          setEditingProduct(null);
        }}
        onSuccess={handleRefresh}
      />

      <OrderDetailsModal
        isOpen={!!showOrderDetails}
        order={showOrderDetails}
        onClose={() => setShowOrderDetails(null)}
        onUpdateStatus={handleRefresh}
      />

      <CompanyGuide
        userId={user?.id}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSettingsSubTabChange={(sub) => setGuideSettingsSubTab(sub as SettingsSubTab)}
        ready={isInitialized}
      />

      <style>{`
        @media (max-width: 768px) {
          .safe-area-bottom {
            padding-bottom: env(safe-area-inset-bottom);
          }
        }
      `}</style>
    </div>
  );
}