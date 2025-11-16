import express from 'express';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import { monitoringScheduler } from '../services/socialMonitoring/scheduler';
import { monitoringService } from '../services/socialMonitoring/monitoringService';

const router = express.Router();

// Manual trigger monitoring check
router.post('/check-now', authenticateToken, async (req, res) => {
  try {
    logger.info('Manual monitoring check triggered by user:', req.user?.id);
    await monitoringService.checkAllUsers();
    
    res.json({
      success: true,
      message: 'Manual monitoring check completed successfully'
    });
  } catch (error) {
    logger.error('Error during manual monitoring check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run manual monitoring check'
    });
  }
});

// Get scheduler status
router.get('/scheduler-status', authenticateToken, async (req, res) => {
  try {
    const isActive = monitoringScheduler.isActive();
    
    res.json({
      success: true,
      data: {
        isActive,
        lastCheck: new Date().toISOString(),
        nextCheck: isActive ? 'Every 5 minutes' : 'Scheduler stopped'
      }
    });
  } catch (error) {
    logger.error('Error getting scheduler status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scheduler status'
    });
  }
});

// Start scheduler
router.post('/scheduler/start', authenticateToken, async (req, res) => {
  try {
    monitoringScheduler.start();
    
    res.json({
      success: true,
      message: 'Monitoring scheduler started successfully'
    });
  } catch (error) {
    logger.error('Error starting scheduler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start monitoring scheduler'
    });
  }
});

// Stop scheduler
router.post('/scheduler/stop', authenticateToken, async (req, res) => {
  try {
    monitoringScheduler.stop();
    
    res.json({
      success: true,
      message: 'Monitoring scheduler stopped successfully'
    });
  } catch (error) {
    logger.error('Error stopping scheduler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop monitoring scheduler'
    });
  }
});

export default router;