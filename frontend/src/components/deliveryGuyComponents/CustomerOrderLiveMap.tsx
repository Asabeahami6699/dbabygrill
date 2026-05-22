import DeliveryMap from './DeliveryMap';
import { useDriverLocation } from './hooks/useDriverLocation';

interface Props {
  orderId: string;
  deliveryGuyId: string;
  deliveryAddress: string;
  destinationLat?: number | null;
  destinationLng?: number | null;
  height?: string;
}

/** Live map shown on the customer Orders page while order is out for delivery. */
export default function CustomerOrderLiveMap({
  orderId,
  deliveryGuyId,
  deliveryAddress,
  destinationLat,
  destinationLng,
  height = '260px',
}: Props) {
  const { location, isOnline, connected, error } = useDriverLocation({
    deliveryGuyId,
    orderId,
  });

  return (
    <div>
      {error && (
        <p className="text-xs text-amber-700 mb-2 px-1">{error}</p>
      )}
      {!connected && !error && (
        <p className="text-xs text-gray-500 mb-2 px-1">Connecting to live tracking…</p>
      )}
      <DeliveryMap
        driverLat={location?.latitude ?? null}
        driverLng={location?.longitude ?? null}
        driverSpeed={location?.speed ?? null}
        driverName="Your driver"
        isOnline={isOnline}
        deliveryAddress={deliveryAddress}
        destinationLat={destinationLat}
        destinationLng={destinationLng}
        destinationLabel="Delivery address"
        height={height}
        className="rounded-none"
      />
    </div>
  );
}
