"""
Logging system for GeoVision AI Miner data ingestion pipeline
"""

import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional
import boto3
from botocore.exceptions import ClientError

class S3LogHandler(logging.Handler):
    """Custom log handler that writes to S3"""
    
    def __init__(self, s3_bucket: str, s3_key_prefix: str):
        super().__init__()
        self.s3_bucket = s3_bucket.replace('s3://', '')
        self.s3_key_prefix = s3_key_prefix
        self.s3_client = boto3.client('s3')
        self.log_buffer = []
        self.buffer_size = 100
        
    def emit(self, record):
        """Emit a log record to S3"""
        try:
            log_entry = self.format(record)
            self.log_buffer.append(log_entry)
            
            # Flush buffer when it reaches buffer_size
            if len(self.log_buffer) >= self.buffer_size:
                self.flush()
                
        except Exception:
            self.handleError(record)
    
    def flush(self):
        """Flush log buffer to S3"""
        if not self.log_buffer:
            return
            
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            s3_key = f"{self.s3_key_prefix}/pipeline_{timestamp}.log"
            
            log_content = '\n'.join(self.log_buffer)
            
            self.s3_client.put_object(
                Bucket=self.s3_bucket,
                Key=s3_key,
                Body=log_content.encode('utf-8'),
                ContentType='text/plain'
            )
            
            self.log_buffer.clear()
            
        except ClientError as e:
            print(f"Failed to write logs to S3: {e}")
    
    def close(self):
        """Close handler and flush remaining logs"""
        self.flush()
        super().close()

class PipelineLogger:
    """Centralized logging for the data ingestion pipeline"""
    
    def __init__(self, 
                 name: str = 'geovision_pipeline',
                 level: str = 'INFO',
                 log_to_console: bool = True,
                 log_to_s3: bool = False,
                 s3_bucket: Optional[str] = None,
                 s3_key_prefix: Optional[str] = None):
        
        self.logger = logging.getLogger(name)
        self.logger.setLevel(getattr(logging, level.upper()))
        
        # Clear existing handlers
        self.logger.handlers.clear()
        
        # Console handler
        if log_to_console:
            console_handler = logging.StreamHandler(sys.stdout)
            console_formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            console_handler.setFormatter(console_formatter)
            self.logger.addHandler(console_handler)
        
        # S3 handler
        if log_to_s3 and s3_bucket and s3_key_prefix:
            s3_handler = S3LogHandler(s3_bucket, s3_key_prefix)
            s3_formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
            )
            s3_handler.setFormatter(s3_formatter)
            self.logger.addHandler(s3_handler)
    
    def info(self, message: str, **kwargs):
        """Log info message with optional context"""
        if kwargs:
            message = f"{message} | Context: {kwargs}"
        self.logger.info(message)
    
    def warning(self, message: str, **kwargs):
        """Log warning message with optional context"""
        if kwargs:
            message = f"{message} | Context: {kwargs}"
        self.logger.warning(message)
    
    def error(self, message: str, **kwargs):
        """Log error message with optional context"""
        if kwargs:
            message = f"{message} | Context: {kwargs}"
        self.logger.error(message)
    
    def critical(self, message: str, **kwargs):
        """Log critical message with optional context"""
        if kwargs:
            message = f"{message} | Context: {kwargs}"
        self.logger.critical(message)
    
    def debug(self, message: str, **kwargs):
        """Log debug message with optional context"""
        if kwargs:
            message = f"{message} | Context: {kwargs}"
        self.logger.debug(message)
    
    def log_dataset_start(self, dataset_type: str, country: str, source_count: int):
        """Log start of dataset processing"""
        self.info(
            f"Starting {dataset_type} processing",
            country=country,
            source_count=source_count,
            dataset_type=dataset_type
        )
    
    def log_dataset_complete(self, dataset_type: str, country: str, 
                           processed_count: int, duration_seconds: float):
        """Log completion of dataset processing"""
        self.info(
            f"Completed {dataset_type} processing",
            country=country,
            processed_count=processed_count,
            duration_seconds=duration_seconds,
            dataset_type=dataset_type
        )
    
    def log_validation_result(self, dataset_type: str, country: str,
                            total_records: int, valid_records: int, 
                            invalid_records: int, warnings: int):
        """Log validation results"""
        validity_rate = (valid_records / total_records * 100) if total_records > 0 else 0
        
        self.info(
            f"Validation complete for {dataset_type}",
            country=country,
            total_records=total_records,
            valid_records=valid_records,
            invalid_records=invalid_records,
            warnings=warnings,
            validity_rate=f"{validity_rate:.2f}%",
            dataset_type=dataset_type
        )
    
    def log_storage_write(self, storage_type: str, path: str, size_mb: float):
        """Log storage write operations"""
        self.info(
            f"Written to {storage_type}",
            path=path,
            size_mb=f"{size_mb:.2f}",
            storage_type=storage_type
        )
    
    def log_performance_metric(self, operation: str, duration_seconds: float,
                             records_processed: int, memory_mb: float):
        """Log performance metrics"""
        records_per_second = records_processed / duration_seconds if duration_seconds > 0 else 0
        
        self.info(
            f"Performance metric: {operation}",
            duration_seconds=duration_seconds,
            records_processed=records_processed,
            records_per_second=f"{records_per_second:.2f}",
            memory_mb=f"{memory_mb:.2f}",
            operation=operation
        )
    
    def flush_logs(self):
        """Flush all log handlers"""
        for handler in self.logger.handlers:
            if hasattr(handler, 'flush'):
                handler.flush()
    
    def close(self):
        """Close all log handlers"""
        for handler in self.logger.handlers:
            if hasattr(handler, 'close'):
                handler.close()

def get_logger(name: str = 'geovision_pipeline', **kwargs) -> PipelineLogger:
    """Get a configured logger instance"""
    return PipelineLogger(name=name, **kwargs)