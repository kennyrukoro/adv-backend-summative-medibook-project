'use strict';
const express = require('express');
const c = require('../controllers/appointmentController');

const router = express.Router();
router.post('/', c.book);
router.get('/:id', c.getOne);
router.post('/:id/cancel', c.cancel);
module.exports = router;
