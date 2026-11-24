'use strict';
const express = require('express');
const c = require('../controllers/doctorController');

const router = express.Router();
router.route('/').get(c.list).post(c.create);
router.route('/:id').get(c.getOne).patch(c.update).delete(c.remove);
router.get('/:id/stats', c.stats);
module.exports = router;
