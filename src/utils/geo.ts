/**
 * Encodes latitude and longitude into a standard 9-character geohash string.
 * This supports native prefix-based spatial range queries in Firestore.
 */
export function encodeGeohash(lat: number, lng: number, precision = 9): string {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;
  let geohash = '';
  let bit = 0;
  let ch = 0;
  let isEven = true;

  while (geohash.length < precision) {
    if (isEven) {
      const mid = (minLng + maxLng) / 2;
      if (lng > mid) {
        ch |= (1 << (4 - bit));
        minLng = mid;
      } else {
        maxLng = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat > mid) {
        ch |= (1 << (4 - bit));
        minLat = mid;
      } else {
        maxLat = mid;
      }
    }
    isEven = !isEven;
    if (bit < 4) {
      bit++;
    } else {
      geohash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return geohash;
}

/**
 * Calculates the great-circle distance between two points using the Haversine formula (in kilometers).
 */
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Computes bounding geohash ranges for a given prefix.
 * In Firestore, a query for geohashes within a prefix is made using:
 * .where('location.geohash', '>=', geohashPrefix)
 * .where('location.geohash', '<=', geohashPrefix + '\uf8ff')
 */
export function getGeohashRange(prefix: string): { start: string; end: string } {
  return {
    start: prefix,
    end: prefix + '\uf8ff',
  };
}
