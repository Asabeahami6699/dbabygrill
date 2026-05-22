interface Props {
  available: number;
  active: number;
  completed: number;
}

export default function DeliveryStats({ available, active, completed }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-blue-50 rounded-xl p-3 text-center">
        <p className="text-2xl font-bold text-blue-600">{available}</p>
        <p className="text-xs text-gray-600">Available</p>
      </div>
      <div className="bg-orange-50 rounded-xl p-3 text-center">
        <p className="text-2xl font-bold text-orange-600">{active}</p>
        <p className="text-xs text-gray-600">Active</p>
      </div>
      <div className="bg-green-50 rounded-xl p-3 text-center">
        <p className="text-2xl font-bold text-green-600">{completed}</p>
        <p className="text-xs text-gray-600">Completed</p>
      </div>
    </div>
  );
}