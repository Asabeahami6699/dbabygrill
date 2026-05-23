import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  useProfileStore,
  emptyProfile,
  type ProfileFormData,
} from '../store/profileStore';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, signOut, refreshUser } = useAuth();
  const {
    profile,
    isLoading,
    isRefreshing,
    fetchProfile,
    updateProfile,
  } = useProfileStore();

  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileFormData>(emptyProfile());

  useEffect(() => {
    if (!user?.id) return;
    fetchProfile(user.id, {
      fullName: user.fullName,
      phone: user.phone,
    });
  }, [user?.id, user?.fullName, user?.phone, fetchProfile]);

  useEffect(() => {
    if (profile && !editing) {
      setDraft(profile);
    }
  }, [profile, editing]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await updateProfile(draft);
      await refreshUser();
      toast.success('Profile updated successfully!');
      setEditing(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Error updating profile';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    if (profile) setDraft(profile);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const display = profile ?? draft;

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Not Logged In</h1>
        <p className="text-gray-600 mb-6">Please log in to view your profile.</p>
        <a
          href="/login"
          className="inline-block bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700"
        >
          Go to Login
        </a>
      </div>
    );
  }

  if (isLoading && !profile) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {isRefreshing && (
        <p className="text-xs text-gray-500 text-center mb-2">Updating profile…</p>
      )}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-8">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
              <span className="text-3xl font-bold text-orange-600">
                {display.fullName
                  ? display.fullName.charAt(0).toUpperCase()
                  : user.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {display.fullName || 'Welcome!'}
              </h1>
              <p className="text-orange-100">{user.email}</p>
              <p className="text-orange-100 text-sm mt-1 capitalize">
                Role: {user.role}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {!editing ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">
                  Profile Information
                </h2>
                <button
                  onClick={() => {
                    setDraft(profile ?? emptyProfile());
                    setEditing(true);
                  }}
                  className="text-orange-600 hover:text-orange-700 font-medium"
                >
                  Edit Profile
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Full Name
                  </label>
                  <p className="mt-1 text-gray-900">
                    {display.fullName || 'Not set'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Email
                  </label>
                  <p className="mt-1 text-gray-900">{user.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Phone Number
                  </label>
                  <p className="mt-1 text-gray-900">
                    {display.phone || 'Not set'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Address
                  </label>
                  <p className="mt-1 text-gray-900">
                    {display.address || 'Not set'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    City
                  </label>
                  <p className="mt-1 text-gray-900">
                    {display.city || 'Not set'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Landmark
                  </label>
                  <p className="mt-1 text-gray-900">
                    {display.landmark || 'Not set'}
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-500">
                Your saved address is used automatically at checkout.
              </p>

              <div className="border-t pt-6">
                <button
                  onClick={handleSignOut}
                  className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Edit Profile</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={draft.fullName}
                    onChange={(e) =>
                      setDraft({ ...draft, fullName: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={draft.phone}
                    onChange={(e) =>
                      setDraft({ ...draft, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Street address
                  </label>
                  <p className="text-xs text-gray-500 mb-1">
                    Include street name and house number for accurate delivery.
                  </p>
                  <input
                    type="text"
                    value={draft.address}
                    onChange={(e) =>
                      setDraft({ ...draft, address: e.target.value })
                    }
                    placeholder="Hse 12, Mango Street"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Landmark
                  </label>
                  <input
                    type="text"
                    value={draft.landmark}
                    onChange={(e) =>
                      setDraft({ ...draft, landmark: e.target.value })
                    }
                    placeholder="e.g. opposite Pentecost Church"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City / Area
                  </label>
                  <input
                    type="text"
                    value={draft.city}
                    onChange={(e) =>
                      setDraft({ ...draft, city: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="border border-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="mt-8 bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Orders</h2>
        <div className="text-center py-8">
          <p className="text-gray-500">View your order history on the Orders page.</p>
          <a href="/orders" className="inline-block mt-4 text-orange-600 hover:text-orange-700">
            Go to Orders
          </a>
        </div>
      </div>
    </div>
  );
}
