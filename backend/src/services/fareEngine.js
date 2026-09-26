const { DEFAULT_FARE_RULES, VEHICLE_CATEGORIES } = require('../config/constants');
const { prisma, memoryStore, isDbConnected } = require('../db/prisma');

/**
 * Retrieves active fare rule for vehicle category
 */
async function getFareRule(category) {
  if (isDbConnected() && prisma) {
    try {
      const rule = await prisma.fareRule.findUnique({
        where: { category }
      });
      if (rule && rule.isActive) return rule;
    } catch (err) {
      console.warn('[FareEngine] Falling back to memory fare rules:', err.message);
    }
  }

  // Memory fallback
  const memRule = memoryStore.fareRules.find(r => r.category === category && r.isActive);
  if (memRule) return memRule;

  // Default fallback
  return DEFAULT_FARE_RULES.find(r => r.category === category) || DEFAULT_FARE_RULES[0];
}

/**
 * Retrieves all active fare rules for all vehicle categories
 */
async function getAllFareRules() {
  if (isDbConnected() && prisma) {
    try {
      const rules = await prisma.fareRule.findMany({
        where: { isActive: true }
      });
      if (rules.length > 0) return rules;
    } catch (err) {
      console.warn('[FareEngine] Falling back to memory fare rules:', err.message);
    }
  }
  return memoryStore.fareRules.filter(r => r.isActive);
}

/**
 * Determines if given timestamp falls into Night surcharge window (22:00 to 05:00)
 */
function isNightTime(date = new Date()) {
  const hours = date.getHours();
  return hours >= 22 || hours < 5;
}

/**
 * Determines if given timestamp falls into Peak surcharge window (08:30-10:30 or 17:30-20:30)
 */
function isPeakTime(date = new Date()) {
  const hours = date.getHours();
  const mins = date.getMinutes();
  const totalMins = hours * 60 + mins;

  // 08:30 to 10:30 (510 to 630 mins)
  const isMorningPeak = totalMins >= 510 && totalMins <= 630;
  // 17:30 to 20:30 (1050 to 1230 mins)
  const isEveningPeak = totalMins >= 1050 && totalMins <= 1230;

  return isMorningPeak || isEveningPeak;
}

/**
 * Computes exact fare estimate with complete snapshot
 */
async function calculateFare({ category = VEHICLE_CATEGORIES.SEDAN, distanceKm, durationMins = 10, rideTime = new Date() }) {
  const rule = await getFareRule(category);
  const time = new Date(rideTime);

  const baseDistance = rule.baseDistanceKm || 2.0;
  const baseFare = Number(rule.baseFare);
  const perKmRate = Number(rule.perKmRate);
  const minimumFare = Number(rule.minimumFare);

  // Extra distance beyond base inclusion
  const extraKm = Math.max(0, distanceKm - baseDistance);
  const distanceFare = Math.round(extraKm * perKmRate * 10) / 10;

  let multiplier = 1.0;
  let surchargeReason = 'Standard Rate';

  if (isNightTime(time)) {
    multiplier = Number(rule.nightSurchargeMultiplier || 1.25);
    surchargeReason = 'Night Surcharge (10:00 PM - 5:00 AM)';
  } else if (isPeakTime(time)) {
    multiplier = Number(rule.peakHourMultiplier || 1.15);
    surchargeReason = 'Peak Hours Surcharge';
  }

  const subtotal = baseFare + distanceFare;
  const calculatedTotal = Math.round(subtotal * multiplier);
  const finalFare = Math.max(minimumFare, calculatedTotal);

  const snapshot = {
    category,
    baseFare,
    baseDistanceKm: baseDistance,
    perKmRate,
    minimumFare,
    distanceKm,
    extraKm: Math.round(extraKm * 10) / 10,
    distanceFare,
    multiplier,
    surchargeReason,
    waitingChargePerMin: rule.waitingChargePerMin || 2.0,
    calculatedAt: new Date().toISOString()
  };

  return {
    category,
    distanceKm,
    durationMins,
    baseFare,
    perKmRate,
    minimumFare,
    estimatedFare: finalFare,
    multiplier,
    surchargeReason,
    fareRuleSnapshot: snapshot
  };
}

module.exports = {
  getFareRule,
  getAllFareRules,
  calculateFare,
  isNightTime,
  isPeakTime
};
