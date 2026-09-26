const express = require('express');
const router = express.Router();
const fareController = require('../controllers/fareController');

router.get('/rules', fareController.getPublicFareRules);
router.get('/landmarks', fareController.getLandmarks);

module.exports = router;
