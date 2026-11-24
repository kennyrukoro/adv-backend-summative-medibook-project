'use strict';
const express = require('express');
const c = require('../controllers/reportController');

const router = express.Router();
router.get('/doctors', c.doctors);
router.get('/busy-days', c.busyDays);
module.exports = router;
