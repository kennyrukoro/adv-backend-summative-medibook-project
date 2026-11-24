'use strict';
const express = require('express');
const patientRoutes = require('./patientRoutes');
const doctorRoutes = require('./doctorRoutes');
const appointmentRoutes = require('./appointmentRoutes');
const reportRoutes = require('./reportRoutes');
const feedbackRoutes = require('./feedbackRoutes');

const router = express.Router();
router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.use('/patients', patientRoutes);
router.use('/doctors', doctorRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/reports', reportRoutes);

module.exports = { api: router, feedback: feedbackRoutes };
