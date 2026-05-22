import { DeliveryGuyProfile } from '../../pages/deliveryGuy/Deliverydashboard';
interface Props {
  profile: DeliveryGuyProfile;
  onClose: () => void;
  onSignOut: () => void;
}

export default function DeliveryProfile({ profile, onClose, onSignOut }: Props) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-sm w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Profile</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-gray-500">Name</p>
            <p className="font-medium">{profile.full_name}</p>
          </div>
          <div>
            <p className="text-gray-500">Email</p>
            <p className="font-medium">{profile.email}</p>
          </div>
          {profile.phone && (
            <div>
              <p className="text-gray-500">Phone</p>
              <p className="font-medium">{profile.phone}</p>
            </div>
          )}
          <div>
            <p className="text-gray-500">Status</p>
            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
              profile.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {profile.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onSignOut}
            className="flex-1 bg-red-50 text-red-600 py-2 rounded-lg hover:bg-red-100 text-sm font-medium"
          >
            Sign Out
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}