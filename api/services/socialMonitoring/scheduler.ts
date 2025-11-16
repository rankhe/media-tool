import cron from 'node-cron';
import { logger } from '../../utils/logger';
import { monitoringService } from './monitoringService';

export class MonitoringScheduler {
  private monitoringJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  start(): void {
    // Run monitoring check every 5 minutes
    this.monitoringJob = cron.schedule('*/5 * * * *', async () => {
      if (this.isRunning) {
        logger.info('Monitoring check already running, skipping this cycle');
        return;
      }

      try {
        this.isRunning = true;
        logger.info('Starting scheduled monitoring check');
        await monitoringService.checkAllUsers();
        logger.info('Scheduled monitoring check completed');
      } catch (error) {
        logger.error('Error during scheduled monitoring check:', error);
      } finally {
        this.isRunning = false;
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai'
    });

    logger.info('Social media monitoring scheduler started (running every 5 minutes)');
  }

  stop(): void {
    if (this.monitoringJob) {
      this.monitoringJob.stop();
      this.monitoringJob = null;
      logger.info('Social media monitoring scheduler stopped');
    }
  }

  isActive(): boolean {
    return this.monitoringJob !== null;
  }

  async runManualCheck(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Monitoring check already in progress');
    }

    try {
      this.isRunning = true;
      logger.info('Starting manual monitoring check');
      await monitoringService.checkAllUsers();
      logger.info('Manual monitoring check completed');
    } catch (error) {
      logger.error('Error during manual monitoring check:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }
}

export const monitoringScheduler = new MonitoringScheduler();