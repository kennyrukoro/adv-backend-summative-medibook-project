'use strict';
const express = require('express');
const c = require('../controllers/feedbackController');

const router = express.Router();
router.get('/', c.show);
module.exports = router;
