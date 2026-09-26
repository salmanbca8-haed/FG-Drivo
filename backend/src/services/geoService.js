const { DINDIGUL_CENTER, DINDIGUL_LANDMARKS } = require('../config/dindigulGeo');

/**
 * Calculates distance in kilometers between two lat/lng coordinates using Haversine formula
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10; // 1 decimal precision
}

/**
 * Validates if coordinates lie within the configured Dindigul service boundary
 */
function validateWithinDindigulBoundary(lat, lng, maxRadiusKm = DINDIGUL_CENTER.radiusKm) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return {
      isValid: false,
      distanceFromCenterKm: null,
      message: 'Invalid coordinates provided'
    };
  }

  const distance = haversineDistance(DINDIGUL_CENTER.lat, DINDIGUL_CENTER.lng, lat, lng);
  const isValid = distance <= maxRadiusKm;

  return {
    isValid,
    distanceFromCenterKm: distance,
    maxRadiusKm,
    center: DINDIGUL_CENTER,
    message: isValid
      ? 'Location is within Dindigul service boundary.'
      : `Location is ${distance.toFixed(1)} km from Dindigul center (Max allowed: ${maxRadiusKm} km). FG DRIVO operates exclusively within Dindigul.`
  };
}

/**
 * Estimates driving duration in minutes for Dindigul urban roads
 */
function estimateDurationMins(distanceKm) {
  // Average city speed 25 km/h in Dindigul traffic + 3 min initial traffic buffer
  const minutes = (distanceKm / 25) * 60 + 3;
  return Math.max(5, Math.round(minutes));
}

/**
 * Helper to match query text to known Dindigul landmarks
 */
function searchDindigulLandmarks(query = '') {
  const q = query.toLowerCase().trim();
  if (!q) return DINDIGUL_LANDMARKS;
  return DINDIGUL_LANDMARKS.filter(
    lm =>
      lm.name.toLowerCase().includes(q) ||
      lm.address.toLowerCase().includes(q) ||
      (lm.tamilName && lm.tamilName.includes(q))
  );
}

module.exports = {
  haversineDistance,
  validateWithinDindigulBoundary,
  estimateDurationMins,
  searchDindigulLandmarks,
  DINDIGUL_CENTER,
  DINDIGUL_LANDMARKS
};
