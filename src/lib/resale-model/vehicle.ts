import type { Listing } from '@/types';

export type VehicleCategory = 'car' | 'truck_suv' | 'van';

export function categorise(listing: Listing): VehicleCategory {
  const m = listing.model.toLowerCase();
  const truckKeywords = [
    'f-150', 'f-250', 'f-350', 'silverado', 'ram', 'tundra', 'tahoe',
    'suburban', 'yukon', 'expedition', 'navigator', 'wrangler', 'cherokee',
    'explorer', 'bronco', 'escalade', 'sierra', 'canyon', 'tacoma', 'ranger',
  ];
  if (truckKeywords.some((k) => m.includes(k))) return 'truck_suv';
  return 'car';
}
