const { getAllFareRules } = require('../services/fareEngine');
const { searchDindigulLandmarks, DINDIGUL_CENTER } = require('../services/geoService');

/**
 * Get public active fare rules
 */
async function getPublicFareRules(req, res, next) {
  try {
    const rules = await getAllFareRules();
    return res.json({
      success: true,
      serviceCenter: DINDIGUL_CENTER,
      rules
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get popular Dindigul landmarks for fast search/autocomplete
 */
async function getLandmarks(req, res, next) {
  try {
    const { query = '' } = req.query;
    const landmarks = searchDindigulLandmarks(query);
    return res.json({
      success: true,
      landmarks
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPublicFareRules,
  getLandmarks
};
