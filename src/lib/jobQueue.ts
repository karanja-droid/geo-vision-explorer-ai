import Queue from 'bull';
import Redis from 'ioredis';
import { ErrorHandler } from './errorHandler';

// Redis connection configuration
const redisConfig = {
  host: import.meta.env.VITE_REDIS_HOST || 'localhost',
  port: parseInt(import.meta.env.VITE_REDIS_PORT || '6379'),
  password: import.meta.env.VITE_REDIS_PASSWORD,
  db: parseInt(import.meta.env.VITE_REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
};

// Create Redis connection
const redis = new Redis(redisConfig);

// Job queue definitions
export const aiAnalysisQueue = new Queue('AI Analysis', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

export const dataProcessingQueue = new Queue('Data Processing', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 5,
    removeOnFail: 3,
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 5000,
    },
  },
});

export const notificationQueue = new Queue('Notifications', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 20,
    removeOnFail: 10,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

// Job data interfaces
export interface MineralPredictionJob {
  depositId: string;
  modelName: string;
  features: Record<string, any>;
  userId: string;
  projectId: string;
  confidenceThreshold?: number;
}

export interface DataProcessingJob {
  fileUrl: string;
  fileType: 'geotiff' | 'shapefile' | 'csv' | 'json';
  processingType: 'cog_conversion' | 'tile_generation' | 'metadata_extraction';
  outputPath: string;
  userId: string;
  projectId: string;
}

export interface NotificationJob {
  userId: string;
  type: 'email' | 'push' | 'in_app';
  template: string;
  data: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
}

// Job processors
aiAnalysisQueue.process('mineral-prediction', 5, async (job) => {
  const { depositId, modelName, features, userId, projectId } = job.data as MineralPredictionJob;
  
  try {
    ErrorHandler.addBreadcrumb('Starting AI mineral prediction', 'job', {
      depositId,
      modelName,
      userId,
    });

    // Update job progress
    await job.progress(10);

    // Simulate AI model loading
    await new Promise(resolve => setTimeout(resolve, 2000));
    await job.progress(30);

    // Run the actual prediction (this would call your AI service)
    const predictionResult = await runMineralPrediction(depositId, modelName, features);
    await job.progress(70);

    // Save results to database
    await savePredictionResults(depositId, predictionResult, userId);
    await job.progress(90);

    // Send notification
    await notificationQueue.add('prediction-complete', {
      userId,
      type: 'in_app',
      template: 'prediction_complete',
      data: {
        depositId,
        modelName,
        confidence: predictionResult.confidence,
        grade: predictionResult.predicted_grade,
      },
    });

    await job.progress(100);

    ErrorHandler.addBreadcrumb('AI mineral prediction completed', 'job', {
      depositId,
      confidence: predictionResult.confidence,
    });

    return predictionResult;
  } catch (error) {
    ErrorHandler.captureAIError(error as Error, {
      modelName,
      inputFeatures: Object.keys(features),
      predictionType: 'mineral_prediction',
    });
    throw error;
  }
});

dataProcessingQueue.process('cog-conversion', 3, async (job) => {
  const { fileUrl, outputPath, userId, projectId } = job.data as DataProcessingJob;
  
  try {
    ErrorHandler.addBreadcrumb('Starting COG conversion', 'job', {
      fileUrl,
      outputPath,
      userId,
    });

    await job.progress(10);

    // Download the file
    const inputFile = await downloadFile(fileUrl);
    await job.progress(30);

    // Convert to COG
    const cogFile = await convertToCOG(inputFile, outputPath);
    await job.progress(70);

    // Generate tiles
    await generateTiles(cogFile);
    await job.progress(90);

    // Update metadata in database
    await updateFileMetadata(projectId, cogFile);
    await job.progress(100);

    return { cogPath: cogFile, tilesGenerated: true };
  } catch (error) {
    ErrorHandler.captureError(error as Error, {
      component: 'data_processing',
      action: 'cog_conversion',
      additionalData: { fileUrl, outputPath },
    });
    throw error;
  }
});

notificationQueue.process('email', 10, async (job) => {
  const { userId, template, data } = job.data as NotificationJob;
  
  try {
    // Send email notification (integrate with your email service)
    await sendEmailNotification(userId, template, data);
    return { sent: true, timestamp: new Date().toISOString() };
  } catch (error) {
    ErrorHandler.captureError(error as Error, {
      component: 'notification_system',
      action: 'send_email',
      additionalData: { userId, template },
    });
    throw error;
  }
});

notificationQueue.process('in_app', 20, async (job) => {
  const { userId, template, data } = job.data as NotificationJob;
  
  try {
    // Send in-app notification via WebSocket or database
    await sendInAppNotification(userId, template, data);
    return { sent: true, timestamp: new Date().toISOString() };
  } catch (error) {
    ErrorHandler.captureError(error as Error, {
      component: 'notification_system',
      action: 'send_in_app',
      additionalData: { userId, template },
    });
    throw error;
  }
});

// Job management functions
export class JobManager {
  static async addMineralPredictionJob(data: MineralPredictionJob, options?: any) {
    try {
      const job = await aiAnalysisQueue.add('mineral-prediction', data, {
        priority: options?.priority || 0,
        delay: options?.delay || 0,
        ...options,
      });

      ErrorHandler.addBreadcrumb('Mineral prediction job queued', 'job', {
        jobId: job.id,
        depositId: data.depositId,
        modelName: data.modelName,
      });

      return job;
    } catch (error) {
      ErrorHandler.captureError(error as Error, {
        component: 'job_manager',
        action: 'add_prediction_job',
        additionalData: data,
      });
      throw error;
    }
  }

  static async addDataProcessingJob(data: DataProcessingJob, options?: any) {
    try {
      const job = await dataProcessingQueue.add(data.processingType, data, options);

      ErrorHandler.addBreadcrumb('Data processing job queued', 'job', {
        jobId: job.id,
        processingType: data.processingType,
        fileType: data.fileType,
      });

      return job;
    } catch (error) {
      ErrorHandler.captureError(error as Error, {
        component: 'job_manager',
        action: 'add_processing_job',
        additionalData: data,
      });
      throw error;
    }
  }

  static async getJobStatus(queueName: string, jobId: string) {
    try {
      const queue = this.getQueue(queueName);
      const job = await queue.getJob(jobId);
      
      if (!job) {
        return { status: 'not_found' };
      }

      const state = await job.getState();
      const progress = job.progress();
      
      return {
        id: job.id,
        status: state,
        progress,
        data: job.data,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
      };
    } catch (error) {
      ErrorHandler.captureError(error as Error, {
        component: 'job_manager',
        action: 'get_job_status',
        additionalData: { queueName, jobId },
      });
      throw error;
    }
  }

  static async cancelJob(queueName: string, jobId: string) {
    try {
      const queue = this.getQueue(queueName);
      const job = await queue.getJob(jobId);
      
      if (job) {
        await job.remove();
        ErrorHandler.addBreadcrumb('Job cancelled', 'job', { jobId, queueName });
        return true;
      }
      
      return false;
    } catch (error) {
      ErrorHandler.captureError(error as Error, {
        component: 'job_manager',
        action: 'cancel_job',
        additionalData: { queueName, jobId },
      });
      throw error;
    }
  }

  static async getQueueStats(queueName: string) {
    try {
      const queue = this.getQueue(queueName);
      
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed(),
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
      };
    } catch (error) {
      ErrorHandler.captureError(error as Error, {
        component: 'job_manager',
        action: 'get_queue_stats',
        additionalData: { queueName },
      });
      throw error;
    }
  }

  private static getQueue(queueName: string): Queue.Queue {
    switch (queueName) {
      case 'ai-analysis':
        return aiAnalysisQueue;
      case 'data-processing':
        return dataProcessingQueue;
      case 'notifications':
        return notificationQueue;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }
  }
}

// Mock implementations (replace with actual implementations)
async function runMineralPrediction(depositId: string, modelName: string, features: Record<string, any>) {
  // This would call your actual AI service
  await new Promise(resolve => setTimeout(resolve, 5000)); // Simulate processing time
  
  return {
    confidence: Math.random() * 0.4 + 0.6, // 60-100% confidence
    predicted_grade: Math.random() * 10 + 1, // 1-11% grade
    predicted_tonnage: Math.floor(Math.random() * 100000) + 10000, // 10k-110k tonnage
    model_version: '2.1.0',
    processing_time_ms: 5000,
  };
}

async function savePredictionResults(depositId: string, result: any, userId: string) {
  // Save to Supabase database
  console.log('Saving prediction results:', { depositId, result, userId });
}

async function downloadFile(url: string): Promise<string> {
  // Download file from URL
  console.log('Downloading file:', url);
  return '/tmp/downloaded-file.tif';
}

async function convertToCOG(inputFile: string, outputPath: string): Promise<string> {
  // Convert to Cloud Optimized GeoTIFF
  console.log('Converting to COG:', { inputFile, outputPath });
  return outputPath + '/output.cog.tif';
}

async function generateTiles(cogFile: string): Promise<void> {
  // Generate map tiles
  console.log('Generating tiles for:', cogFile);
}

async function updateFileMetadata(projectId: string, filePath: string): Promise<void> {
  // Update database with file metadata
  console.log('Updating metadata:', { projectId, filePath });
}

async function sendEmailNotification(userId: string, template: string, data: any): Promise<void> {
  // Send email via service like SendGrid, AWS SES, etc.
  console.log('Sending email:', { userId, template, data });
}

async function sendInAppNotification(userId: string, template: string, data: any): Promise<void> {
  // Send in-app notification via WebSocket or database
  console.log('Sending in-app notification:', { userId, template, data });
}

// Queue event handlers
aiAnalysisQueue.on('completed', (job, result) => {
  ErrorHandler.addBreadcrumb('AI analysis job completed', 'job', {
    jobId: job.id,
    duration: Date.now() - job.timestamp,
  });
});

aiAnalysisQueue.on('failed', (job, err) => {
  ErrorHandler.captureError(err, {
    component: 'ai_analysis_queue',
    action: 'job_failed',
    additionalData: {
      jobId: job.id,
      jobData: job.data,
    },
  });
});

dataProcessingQueue.on('completed', (job, result) => {
  ErrorHandler.addBreadcrumb('Data processing job completed', 'job', {
    jobId: job.id,
    processingType: job.data.processingType,
  });
});

dataProcessingQueue.on('failed', (job, err) => {
  ErrorHandler.captureError(err, {
    component: 'data_processing_queue',
    action: 'job_failed',
    additionalData: {
      jobId: job.id,
      jobData: job.data,
    },
  });
});

export default JobManager;