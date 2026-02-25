const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Notification = require('../models/Notification');

// @desc    Cron job to clean up old notifications
// @route   GET /api/cron/cleanup
// @access  Secured with a secret key
router.get('/cleanup', asyncHandler(async (req, res) => {
    // Check for a secret key to prevent public access
    const secretKey = req.query.key || req.headers['x-api-key'];

    if (secretKey !== process.env.CRON_SECRET_KEY) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    // Set a date filter to delete notifications older than 60 days
    const daysToKeep = 60;
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    // Delete old notifications from the database
    const result = await Notification.deleteMany({ timestamp: { $lt: cutoffDate } });

    console.log(`Cron job for notification cleanup executed. Deleted ${result.deletedCount} notifications.`);
    res.status(200).json({ 
        message: `Cleanup successful. Deleted ${result.deletedCount} notifications.`
    });
}));

module.exports = router;