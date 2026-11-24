'use strict';
const express = require('express');
const c = require('../controllers/patientController');

const router = express.Router();
router.route('/').get(c.list).post(c.create);
router.route('/:id').get(c.getOne).patch(c.update).delete(c.remove);
module.exports = router;
