"""Celery Application Configuration

Celery app setup for background task processing including
feature computation, AI inference, and data processing tasks.
"""

from celery import Celery
from app.core.config import settings

# Create Celery app
celery_app = Celery(
    "geovision",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.feature_computation",
        "app.tasks.ai_inference",
        "app.tasks.active_learning",
        "app.tasks.drill_qa",
        "app.tasks.lims_processing",
        "app.tasks.audit_export"
    ]
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    result_expires=3600,  # 1 hour
    task_routes={
        "app.tasks.feature_computation.*": {"queue": "features"},
        "app.tasks.ai_inference.*": {"queue": "ai"},
        "app.tasks.active_learning.*": {"queue": "ai"},
        "app.tasks.drill_qa.*": {"queue": "qa"},
        "app.tasks.lims_processing.*": {"queue": "lims"},
        "app.tasks.audit_export.*": {"queue": "audit"}
    },
    task_default_queue="default",
    task_default_exchange="default",
    task_default_exchange_type="direct",
    task_default_routing_key="default"
)

# Task retry configuration
celery_app.conf.task_annotations = {
    "*": {
        "rate_limit": "10/s",
        "time_limit": 30 * 60,
        "soft_time_limit": 25 * 60,
    },
    "app.tasks.feature_computation.compute_features_for_aoi": {
        "rate_limit": "5/m",  # 5 per minute for resource-intensive tasks
        "time_limit": 60 * 60,  # 1 hour for large AOIs
        "soft_time_limit": 55 * 60,
    },
    "app.tasks.ai_inference.run_prospectivity_inference": {
        "rate_limit": "3/m",  # 3 per minute for AI tasks
        "time_limit": 45 * 60,  # 45 minutes
        "soft_time_limit": 40 * 60,
    },
    "app.tasks.active_learning.retrain_model_with_labels": {
        "rate_limit": "1/h",  # 1 per hour for retraining
        "time_limit": 90 * 60,  # 90 minutes
        "soft_time_limit": 85 * 60,
    }
}

# Monitoring and logging
celery_app.conf.worker_send_task_events = True
celery_app.conf.task_send_sent_event = True

if __name__ == "__main__":
    celery_app.start()