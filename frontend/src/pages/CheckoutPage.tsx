// frontend/src/pages/CheckoutPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';
import { useCheckoutStore } from '../store/checkoutStore';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../api/supabase';
import { toast } from 'react-hot-toast';
import { MessageCircle, MapPin, Phone, CreditCard, DollarSign, Store, Navigation, MapPinned } from 'lucide-react';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, subtotal, clearCart } = useCartStore();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const deliveryFeeTimer = useRef<NodeJS.Timeout | null>(null);

  const {
    formData,
    itemInstructions,
    fulfillmentMode,
    deliveryDetailsMode,
    customLocationSelected,
    deliveryAreas,
    deliveryAreasLoading,
    dynamicDeliveryFee,
    matchedDeliveryArea,
    deliveryFeeLoading,
    savedAddress,
    savedAddressLoading,
    step,
    error,
    effectiveDeliveryFee,
    pickupBranches,
    pickupBranchesLoading,
    selectedPickupBranchId,
    setFormData,
    setFulfillmentMode,
    setDeliveryDetailsMode,
    setCustomLocationSelected,
    setItemInstructions,
    updateInstruction,
    loadSavedAddress,
    loadDeliveryAreas,
    fetchDeliveryFee,
    submitCashOrder,
    initiatePaystackPayment,
    resetCheckout,
    setStep,
    setError,
    loadPickupBranches,
    setSelectedPickupBranchId,
    gpsLoading,
    setLocationInputMode,
    captureCurrentLocation,
    clearGpsLocation,
  } = useCheckoutStore();

  const locationInputMode = formData.locationInputMode;
  const hasGpsPin =
    formData.deliveryLatitude != null && formData.deliveryLongitude != null;

  const companyId = items[0]?.company_id;
  const deliveryFee = effectiveDeliveryFee(subtotal);
  const grandTotal = subtotal + deliveryFee;
  const isSubmitting = step === 'submitting' || step === 'redirecting';

  const normalize = (val: string) => (val || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizedCity = normalize(formData.city);

  const exactMatchedArea = normalizedCity && deliveryAreas.length > 0
    ? deliveryAreas.find(a => normalize(a.area_name) === normalizedCity) || null
    : null;

  const requiresCustomLocation =
    fulfillmentMode === 'delivery' &&
    !!normalizedCity &&
    deliveryAreas.length > 0 &&
    !exactMatchedArea &&
    !customLocationSelected;

  const citySuggestions = normalizedCity && deliveryAreas.length > 0
    ? deliveryAreas
        .filter(a => {
          const n = normalize(a.area_name);
          return n.includes(normalizedCity) || normalizedCity.includes(n);
        })
        .slice(0, 8)
    : [];

  // ── Auth check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setCheckingAuth(false);
      if (!session) {
        toast.error('Please login to complete your order', { duration: 3000, icon: '🔒' });
        navigate('/login', {
          state: { from: '/checkout', returnTo: '/checkout', message: 'Please login to complete your checkout' },
        });
        return;
      }
      if (items.length === 0) { toast.error('Your cart is empty'); navigate('/'); }
    };
    checkAuth();
  }, [navigate, items]);

  // ── Init form from user ──────────────────────────────────────────────────────
  useEffect(() => {
    if (user) {
      setFormData({ email: user.email || '', fullName: user.fullName || '' });
    }
  }, [user?.id]);

  // ── Init item instructions ───────────────────────────────────────────────────
  useEffect(() => {
    if (items.length > 0) {
      setItemInstructions(
        items.map(item => ({
          product_id: item.productId,   // ✅ FIX: use actual product UUID
          product_name: item.product.name,
          instruction: ''
        }))
      );
    }
  }, [items.length]);

  // ── Load saved address ───────────────────────────────────────────────────────
  useEffect(() => {
    if (user?.id) loadSavedAddress(user.id);
  }, [user?.id]);

  // ── Empty cart check ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (items.length === 0 && !checkingAuth) { toast.error('Your cart is empty'); navigate('/'); }
  }, [items.length, checkingAuth]);

  // ── Load delivery areas ──────────────────────────────────────────────────────
  useEffect(() => {
    if (companyId) loadDeliveryAreas(companyId);
  }, [companyId]);

  // ── Load pickup branches ─────────────────────────────────────────────────────
  useEffect(() => {
    if (companyId) loadPickupBranches(companyId);
  }, [companyId]);

  // ── Debounced delivery fee fetch ─────────────────────────────────────────────
  useEffect(() => {
    if (fulfillmentMode === 'pickup' || !companyId) return;
    if (deliveryFeeTimer.current) clearTimeout(deliveryFeeTimer.current);
    deliveryFeeTimer.current = setTimeout(() => {
      fetchDeliveryFee(companyId, formData.city);
    }, 400);
    return () => { if (deliveryFeeTimer.current) clearTimeout(deliveryFeeTimer.current); };
  }, [companyId, formData.city, fulfillmentMode]);

  // ── Show error toast ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (step === 'error' && error) {
      const isStock = error.toLowerCase().includes('insufficient stock') ||
        (error.toLowerCase().includes('only') && error.toLowerCase().includes('left'));
      toast.error(error, {
        duration: isStock ? 6000 : 4000,
        icon: isStock ? '🚫' : '❌',
        style: isStock ? { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' } : undefined,
      });
      if (isStock) setTimeout(() => navigate('/cart'), 3000);
      setStep('idle');
      setError(null);
    }
  }, [step, error]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'city') setCustomLocationSelected(false);
    setFormData({ [name]: value } as any);
  };

  const handleDeliveryModeChange = (mode: 'saved' | 'custom') => {
    setDeliveryDetailsMode(mode);
    setCityDropdownOpen(false);
    if (mode === 'saved' && savedAddress) {
      setCustomLocationSelected(false);
      setFormData({
        locationInputMode: 'manual',
        deliveryLatitude: null,
        deliveryLongitude: null,
        locationLabel: '',
        fullName: savedAddress.recipient_name?.trim() || formData.fullName,
        phone: savedAddress.phone?.trim() || formData.phone,
        address: savedAddress.street_address?.trim() || formData.address,
        city: savedAddress.city?.trim() || formData.city,
        region: savedAddress.region?.trim() || formData.region,
        landmark: savedAddress.landmark?.trim() || formData.landmark,
      });
    }
    if (mode === 'custom') setCustomLocationSelected(false);
  };

  const handleFulfillmentChange = (mode: 'delivery' | 'pickup') => {
    setFulfillmentMode(mode);
    if (mode === 'pickup' && user) {
      setFormData({
        fullName: savedAddress?.recipient_name?.trim() || user.fullName || formData.fullName,
        email: user.email || formData.email,
        phone: savedAddress?.phone?.trim() || formData.phone,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    if (fulfillmentMode === 'delivery') {
      if (locationInputMode === 'gps') {
        if (!hasGpsPin) {
          toast.error('Please capture your current location before placing the order.');
          return;
        }
        if (!formData.city?.trim()) {
          toast.error('Confirm your city / area for delivery pricing.');
          return;
        }
      } else if (!formData.address?.trim()) {
        toast.error('Enter your street address and landmark, or use current location.');
        return;
      }
    }

    try {
      if (formData.paymentMethod === 'cash') {
        const { orderId } = await submitCashOrder(items, grandTotal);
        await clearCart();
        toast.success('Order placed successfully!');
        navigate(`/orders/${orderId}`, { replace: true });
      } else {
        const { checkoutUrl } = await initiatePaystackPayment(items, grandTotal, companyId);
        window.location.href = checkoutUrl;
      }
    } catch {
      // Error handled by store's useEffect above
    }
  };

  // ── Loading screens ──────────────────────────────────────────────────────────
  if (checkingAuth) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
      </div>
    );
  }

  if (items.length === 0) return null;

  // ── JSX ──────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Fulfillment mode ── */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">How would you like to receive your order?</h2>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => handleFulfillmentChange('delivery')}
                className={`flex flex-col items-center gap-2 p-4 border-2 rounded-xl transition-all ${
                  fulfillmentMode === 'delivery' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <MapPin className={`w-6 h-6 ${fulfillmentMode === 'delivery' ? 'text-orange-600' : 'text-gray-400'}`} />
                <div className="text-center">
                  <p className={`font-semibold text-sm ${fulfillmentMode === 'delivery' ? 'text-orange-700' : 'text-gray-700'}`}>Delivery</p>
                  <p className="text-xs text-gray-500">We bring it to you</p>
                </div>
              </button>

              <button type="button" onClick={() => handleFulfillmentChange('pickup')}
                className={`flex flex-col items-center gap-2 p-4 border-2 rounded-xl transition-all ${
                  fulfillmentMode === 'pickup' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <Store className={`w-6 h-6 ${fulfillmentMode === 'pickup' ? 'text-orange-600' : 'text-gray-400'}`} />
                <div className="text-center">
                  <p className={`font-semibold text-sm ${fulfillmentMode === 'pickup' ? 'text-orange-700' : 'text-gray-700'}`}>Pickup</p>
                  <p className="text-xs text-gray-500">Free — no delivery fee</p>
                </div>
              </button>
            </div>
          </div>
           {/* ── Pickup branch selector (only when pickup mode) ── */}
                {fulfillmentMode === 'pickup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Pickup Branch
                </label>

                {pickupBranchesLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((n) => (
                      <div key={n} className="animate-pulse h-20 bg-gray-200 rounded-lg" />
                    ))}
                  </div>
                ) : pickupBranches.length > 0 ? (
                  <div className="space-y-2">
                    {pickupBranches.map((branch) => (
                      <label
                        key={branch.id}
                        className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedPickupBranchId === branch.id
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="pickupBranch"
                          value={branch.id}
                          checked={selectedPickupBranchId === branch.id}
                          onChange={() => setSelectedPickupBranchId(branch.id)}
                          className="mt-0.5 h-4 w-4 text-orange-600 focus:ring-orange-500"
                          required
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900">{branch.branch_name}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{branch.address}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {branch.phone ? (
                              <a href={`tel:${branch.phone}`} className="text-orange-600 hover:underline">
                                📞 {branch.phone}
                              </a>
                            ) : (
                              <span className="text-gray-400">📞 No phone provided</span>
                            )}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                    No pickup branches available for this restaurant. Please contact them.
                  </p>
                )}
              </div>
                )}
          {/* ── Contact & delivery info ── */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              {fulfillmentMode === 'pickup'
                ? <><Store className="w-5 h-5 text-orange-600" /> Your Contact Details</>
                : <><MapPin className="w-5 h-5 text-orange-600" /> Delivery Information</>
              }
            </h2>

            {fulfillmentMode === 'delivery' && !savedAddressLoading && savedAddress && (
              <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3">
                <p className="text-sm font-medium text-gray-900 mb-2">Use saved or custom delivery details.</p>
                <div className="flex gap-4">
                  {(['saved', 'custom'] as const).map(mode => (
                    <label key={mode} className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input type="radio" name="deliveryDetailsMode" checked={deliveryDetailsMode === mode}
                        onChange={() => handleDeliveryModeChange(mode)} className="text-orange-600" />
                      {mode === 'saved' ? 'Use saved details' : 'Use custom details'}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} required
                    readOnly={fulfillmentMode === 'delivery' && deliveryDetailsMode === 'saved' && !!savedAddress}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 ${
                      fulfillmentMode === 'delivery' && deliveryDetailsMode === 'saved' && savedAddress ? 'bg-gray-50 text-gray-600' : ''
                    }`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Phone className="w-4 h-4" /> Phone Number
                </label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} required
                  readOnly={fulfillmentMode === 'delivery' && deliveryDetailsMode === 'saved' && !!savedAddress}
                  placeholder="e.g., 0244 123 456"
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 ${
                    fulfillmentMode === 'delivery' && deliveryDetailsMode === 'saved' && savedAddress ? 'bg-gray-50 text-gray-600' : ''
                  }`} />
              </div>

              {/* Address fields — delivery only */}
              {fulfillmentMode === 'delivery' && (
                <>
                  <div className="rounded-lg border border-orange-100 bg-orange-50/80 p-3 space-y-3">
                    <p className="text-sm font-medium text-gray-900">How should we find you?</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setLocationInputMode('manual')}
                        disabled={deliveryDetailsMode === 'saved' && !!savedAddress}
                        className={`flex items-center gap-2 p-3 rounded-lg border-2 text-left text-sm transition-all ${
                          locationInputMode === 'manual'
                            ? 'border-orange-500 bg-white'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <MapPinned className="w-5 h-5 text-orange-600 shrink-0" />
                        <span>
                          <span className="font-semibold block">Street + landmark</span>
                          <span className="text-xs text-gray-500">e.g. opposite Pentecost Church</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLocationInputMode('gps')}
                        disabled={deliveryDetailsMode === 'saved' && !!savedAddress}
                        className={`flex items-center gap-2 p-3 rounded-lg border-2 text-left text-sm transition-all ${
                          locationInputMode === 'gps'
                            ? 'border-orange-500 bg-white'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <Navigation className="w-5 h-5 text-orange-600 shrink-0" />
                        <span>
                          <span className="font-semibold block">Use current location</span>
                          <span className="text-xs text-gray-500">Pin exact spot on the map</span>
                        </span>
                      </button>
                    </div>
                  </div>

                  {locationInputMode === 'manual' ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Street address <span className="text-orange-600">*</span>
                        </label>
                        <p className="text-xs text-gray-600 mb-2 leading-relaxed">
                          A clear <strong>street name and house number</strong> help your rider find you.
                          Add a well-known <strong>landmark</strong> below (e.g. opposite Pentecost Church)
                          so the map route lands at the right place.
                        </p>
                        <input
                          type="text"
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          required={locationInputMode === 'manual'}
                          readOnly={deliveryDetailsMode === 'saved' && !!savedAddress}
                          placeholder="Hse 12, Mango Street"
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 ${
                            deliveryDetailsMode === 'saved' && savedAddress ? 'bg-gray-50 text-gray-600' : ''
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Landmark (recommended)
                        </label>
                        <input
                          type="text"
                          name="landmark"
                          value={formData.landmark}
                          onChange={handleInputChange}
                          readOnly={deliveryDetailsMode === 'saved' && !!savedAddress}
                          placeholder="e.g. opposite Pentecost Church, near Melcom"
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 ${
                            deliveryDetailsMode === 'saved' && savedAddress ? 'bg-gray-50 text-gray-600' : ''
                          }`}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-600">
                        We will save your GPS pin for an exact delivery point on the map. Allow location
                        when your browser asks.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={gpsLoading || (deliveryDetailsMode === 'saved' && !!savedAddress)}
                          onClick={async () => {
                            if (!companyId) return;
                            try {
                              await captureCurrentLocation(companyId);
                              toast.success('Location captured — map will use this exact pin.');
                            } catch (err: any) {
                              toast.error(err?.message || 'Could not get your location.');
                            }
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                        >
                          <Navigation className="w-4 h-4" />
                          {gpsLoading ? 'Getting location…' : hasGpsPin ? 'Update location' : 'Use my current location'}
                        </button>
                        {hasGpsPin && (
                          <button
                            type="button"
                            onClick={clearGpsLocation}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      {hasGpsPin && (
                        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                          <p className="font-medium">Location captured</p>
                          <p className="text-xs mt-1 text-green-700 line-clamp-2">
                            {formData.locationLabel}
                          </p>
                          <p className="text-xs mt-1 text-green-600">
                            {formData.deliveryLatitude?.toFixed(5)}, {formData.deliveryLongitude?.toFixed(5)}
                          </p>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Landmark near you (optional)
                        </label>
                        <input
                          type="text"
                          name="landmark"
                          value={formData.landmark}
                          onChange={handleInputChange}
                          placeholder="e.g. blue gate, Shoprite signboard"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City / Area</label>
                    <div className="relative">
                      <input type="text" name="city" value={formData.city} onChange={handleInputChange}
                        readOnly={deliveryDetailsMode === 'saved' && !!savedAddress}
                        onFocus={() => { if (deliveryDetailsMode === 'custom') setCityDropdownOpen(true); }}
                        onBlur={() => setTimeout(() => setCityDropdownOpen(false), 150)}
                        required placeholder="e.g., Accra, East Legon, Osu"
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 ${
                          deliveryDetailsMode === 'saved' && savedAddress ? 'bg-gray-50 text-gray-600' : ''
                        }`} />

                      {cityDropdownOpen && normalizedCity && (
                        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
                          {deliveryAreasLoading ? (
                            <div className="p-3 text-sm text-gray-500">Loading delivery areas...</div>
                          ) : (
                            <>
                              {citySuggestions.length > 0 ? citySuggestions.map(area => (
                                <button key={area.id} type="button"
                                  onMouseDown={e => e.preventDefault()}
                                  onClick={() => { setCustomLocationSelected(false); setFormData({ city: area.area_name }); setCityDropdownOpen(false); }}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-50">
                                  <div className="flex justify-between gap-3">
                                    <span className="text-sm text-gray-900 font-medium">{area.area_name}</span>
                                    <span className="text-xs text-gray-500">₵{Number(area.delivery_fee || 0).toFixed(2)}</span>
                                  </div>
                                </button>
                              )) : (
                                <div className="p-3 text-sm text-gray-500">No matching areas.</div>
                              )}
                              {requiresCustomLocation && (
                                <button type="button" onMouseDown={e => e.preventDefault()}
                                  onClick={() => { setCustomLocationSelected(true); setCityDropdownOpen(false); }}
                                  className="w-full text-left px-3 py-2 bg-orange-50 hover:bg-orange-100">
                                  <div className="text-sm font-medium text-orange-700">Customize location</div>
                                  <div className="text-xs text-orange-600">Using: {formData.city}</div>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {requiresCustomLocation && (
                      <p className="text-xs text-amber-600 mt-1">
                        Not in configured areas. Select <span className="font-medium">Customize location</span> to continue.
                      </p>
                    )}
                  </div>
                </>
              )}

              
            </div>
          </div>

          {/* ── Special instructions ── */}
          <button type="button" onClick={() => setShowInstructionsModal(true)}
            className="w-full bg-white rounded-xl shadow-sm p-4 flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-orange-600" />
              <span className="text-gray-700">Add special instructions for each item</span>
            </div>
            <span className="text-orange-600 text-sm">
              {itemInstructions.some(i => i.instruction) ? 'Instructions added ✓' : 'Add'}
            </span>
          </button>

          {/* ── Additional notes ── */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Notes (Optional)</h2>
            <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={3}
              placeholder="Extra napkins, no cutlery needed, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600" />
          </div>

          {/* ── Order summary ── */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal ({items.length} {items.length === 1 ? 'item' : 'items'})</span>
                <span>₵{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>{fulfillmentMode === 'pickup' ? 'Pickup' : 'Delivery Fee'}</span>
                <span className={fulfillmentMode === 'pickup' ? 'text-green-600 font-medium' : ''}>
                  {fulfillmentMode === 'pickup' ? 'Free' : deliveryFee === 0 ? 'Free' : `₵${deliveryFee.toFixed(2)}`}
                </span>
              </div>
              {fulfillmentMode === 'delivery' && (
                <div className="text-xs">
                  {deliveryFeeLoading
                    ? <span className="text-gray-500">Checking delivery pricing...</span>
                    : matchedDeliveryArea
                    ? <span className="text-green-600">Area matched: {matchedDeliveryArea}</span>
                    : <span className="text-amber-600">Default delivery fee applied.</span>
                  }
                </div>
              )}
              <div className="border-t pt-3">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-orange-600">₵{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Payment method ── */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h2>
            <div className="space-y-3">
              {[
                {
                  value: 'cash',
                  icon: <DollarSign className="w-5 h-5 text-gray-500" />,
                  label: fulfillmentMode === 'pickup' ? 'Pay at Branch' : 'Cash on Delivery',
                  desc: fulfillmentMode === 'pickup' ? 'Pay when you pick up your order' : 'Pay in cash when your order arrives',
                },
                {
                  value: 'card',
                  icon: <CreditCard className="w-5 h-5 text-gray-500" />,
                  label: 'Card / Mobile Money',
                  desc: 'Visa, Mastercard, MTN MoMo, Vodafone Cash, AirtelTigo',
                },
              ].map(method => (
                <label key={method.value}
                  className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                    formData.paymentMethod === method.value ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                  <input type="radio" name="paymentMethod" value={method.value}
                    checked={formData.paymentMethod === method.value} onChange={handleInputChange}
                    className="w-4 h-4 text-orange-600" />
                  {method.icon}
                  <div>
                    <p className="text-gray-800 font-medium text-sm">{method.label}</p>
                    <p className="text-gray-500 text-xs">{method.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {formData.paymentMethod === 'card' && (
              <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-100 flex items-start gap-2">
                <svg className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="text-xs text-orange-700">
                  You'll be redirected to <span className="font-semibold">Paystack's</span> secure checkout.
                  All major cards and mobile money (MTN, Vodafone, AirtelTigo) are supported.
                </p>
              </div>
            )}
          </div>

          {/* ── Submit ── */}
          <button type="submit"
            disabled={isSubmitting || requiresCustomLocation}
            className="w-full bg-orange-600 text-white py-3 rounded-xl hover:bg-orange-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
            {isSubmitting ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                <span>{step === 'redirecting' ? 'Redirecting to Paystack...' : 'Placing Order...'}</span>
              </div>
            ) : requiresCustomLocation ? 'Select Customize Location to Continue'
              : formData.paymentMethod === 'card' ? `Pay ₵${grandTotal.toFixed(2)} via Paystack →`
              : fulfillmentMode === 'pickup' ? `Place Pickup Order • ₵${grandTotal.toFixed(2)}`
              : `Place Order • ₵${grandTotal.toFixed(2)}`
            }
          </button>

          <p className="text-center text-xs text-gray-400 -mt-2">
            {formData.paymentMethod === 'card'
              ? 'Secured by Paystack — your payment details are never stored on our servers'
              : 'By placing your order you agree to our terms of service'}
          </p>
        </form>
      </div>

      {/* ── Instructions modal ── */}
      {showInstructionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Special Instructions</h2>
                <button onClick={() => setShowInstructionsModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Let the restaurant know about allergies, preferences, or special requests.
              </p>
              <div className="space-y-4">
                {itemInstructions.map(item => (
                  <div key={item.product_id} className="border-b border-gray-100 pb-4">
                    <label className="block text-sm font-medium text-gray-900 mb-2">{item.product_name}</label>
                    <textarea value={item.instruction}
                      onChange={e => updateInstruction(item.product_id, e.target.value)}
                      placeholder="e.g., No onions, extra spicy, allergic to nuts..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 text-sm" />
                  </div>
                ))}
              </div>
              <button onClick={() => setShowInstructionsModal(false)}
                className="w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 mt-6">
                Save Instructions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}