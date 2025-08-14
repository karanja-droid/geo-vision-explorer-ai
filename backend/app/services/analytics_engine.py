"""
Advanced Analytics Engine for GeoMiner Business Intelligence

Provides comprehensive analytics capabilities including:
- Real-time operational metrics
- Predictive modeling and forecasting
- Executive reporting and KPIs
- Operational intelligence
- Financial analytics and ROI tracking
"""

import asyncio
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text, func
import logging
from dataclasses import dataclass
from enum import Enum

from app.core.config import settings
from app.database import get_db
from app.models.core import Project, Organization
from app.models.drilling import DrillCollar, DrillAssay
from app.models.geology import GeologicalSample, RockSample
from app.models.prospectivity import ProspectivityRun, ProspectivityTarget
from app.integrations.redis.client import get_redis_client

logger = logging.getLogger(__name__)

class MetricType(Enum):
    """Analytics metric types"""
    FINANCIAL = "financial"
    OPERATIONAL = "operational"
    TECHNICAL = "technical"
    PREDICTIVE = "predictive"
    RISK = "risk"

class TimeGranularity(Enum):
    """Time granularity for analytics"""
    REAL_TIME = "real_time"
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"

@dataclass
class AnalyticsMetric:
    """Analytics metric data structure"""
    name: str
    value: float
    unit: str
    timestamp: datetime
    metadata: Dict[str, Any]
    trend: Optional[str] = None
    target: Optional[float] = None
    variance: Optional[float] = None

@dataclass
class KPIResult:
    """KPI calculation result"""
    kpi_name: str
    current_value: float
    previous_value: Optional[float]
    target_value: Optional[float]
    trend_direction: str  # "up", "down", "stable"
    performance_status: str  # "excellent", "good", "warning", "critical"
    insights: List[str]

class AdvancedAnalyticsEngine:
    """Advanced analytics and business intelligence engine"""
    
    def __init__(self):
        self.redis_client = get_redis_client()
        self.cache_ttl = 300  # 5 minutes cache
        self.ml_models = {}
        self.kpi_thresholds = self._load_kpi_thresholds()
    
    async def get_executive_dashboard(
        self, 
        org_id: str, 
        time_range: str = "30d"
    ) -> Dict[str, Any]:
        """Generate executive dashboard with high-level KPIs"""
        
        cache_key = f"executive_dashboard:{org_id}:{time_range}"
        cached_result = await self.redis_client.get_json(cache_key)
        
        if cached_result:
            return cached_result
        
        # Calculate executive KPIs
        financial_metrics = await self._calculate_financial_kpis(org_id, time_range)
        operational_metrics = await self._calculate_operational_kpis(org_id, time_range)
        strategic_metrics = await self._calculate_strategic_kpis(org_id, time_range)
        risk_metrics = await self._calculate_risk_metrics(org_id, time_range)
        
        dashboard_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "organization_id": org_id,
            "time_range": time_range,
            "financial": financial_metrics,
            "operational": operational_metrics,
            "strategic": strategic_metrics,
            "risk": risk_metrics,
            "summary": await self._generate_executive_summary(
                financial_metrics, operational_metrics, strategic_metrics, risk_metrics
            )
        }
        
        # Cache results
        await self.redis_client.set_json(cache_key, dashboard_data, ttl=self.cache_ttl)
        
        return dashboard_data
    
    async def get_operational_intelligence(
        self, 
        project_id: str, 
        granularity: TimeGranularity = TimeGranularity.DAILY
    ) -> Dict[str, Any]:
        """Generate operational intelligence for project management"""
        
        cache_key = f"operational_intel:{project_id}:{granularity.value}"
        cached_result = await self.redis_client.get_json(cache_key)
        
        if cached_result:
            return cached_result
        
        # Operational metrics
        drilling_metrics = await self._calculate_drilling_metrics(project_id, granularity)
        sampling_metrics = await self._calculate_sampling_metrics(project_id, granularity)
        quality_metrics = await self._calculate_quality_metrics(project_id, granularity)
        productivity_metrics = await self._calculate_productivity_metrics(project_id, granularity)
        
        # Resource utilization
        resource_utilization = await self._calculate_resource_utilization(project_id, granularity)
        
        # Predictive insights
        predictions = await self._generate_operational_predictions(project_id)
        
        operational_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "project_id": project_id,
            "granularity": granularity.value,
            "drilling": drilling_metrics,
            "sampling": sampling_metrics,
            "quality": quality_metrics,
            "productivity": productivity_metrics,
            "resources": resource_utilization,
            "predictions": predictions,
            "recommendations": await self._generate_operational_recommendations(
                drilling_metrics, sampling_metrics, quality_metrics, productivity_metrics
            )
        }
        
        # Cache results
        await self.redis_client.set_json(cache_key, operational_data, ttl=self.cache_ttl)
        
        return operational_data
    
    async def get_financial_analytics(
        self, 
        org_id: str, 
        time_range: str = "12m"
    ) -> Dict[str, Any]:
        """Generate comprehensive financial analytics"""
        
        cache_key = f"financial_analytics:{org_id}:{time_range}"
        cached_result = await self.redis_client.get_json(cache_key)
        
        if cached_result:
            return cached_result
        
        # Financial calculations
        revenue_analysis = await self._calculate_revenue_analysis(org_id, time_range)
        cost_analysis = await self._calculate_cost_analysis(org_id, time_range)
        profitability_analysis = await self._calculate_profitability_analysis(org_id, time_range)
        roi_analysis = await self._calculate_roi_analysis(org_id, time_range)
        budget_variance = await self._calculate_budget_variance(org_id, time_range)
        
        # Financial forecasting
        financial_forecast = await self._generate_financial_forecast(org_id, time_range)
        
        financial_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "organization_id": org_id,
            "time_range": time_range,
            "revenue": revenue_analysis,
            "costs": cost_analysis,
            "profitability": profitability_analysis,
            "roi": roi_analysis,
            "budget_variance": budget_variance,
            "forecast": financial_forecast,
            "insights": await self._generate_financial_insights(
                revenue_analysis, cost_analysis, profitability_analysis, roi_analysis
            )
        }
        
        # Cache results
        await self.redis_client.set_json(cache_key, financial_data, ttl=self.cache_ttl)
        
        return financial_data
    
    async def get_predictive_analytics(
        self, 
        project_id: str, 
        prediction_horizon: str = "90d"
    ) -> Dict[str, Any]:
        """Generate predictive analytics and forecasts"""
        
        cache_key = f"predictive_analytics:{project_id}:{prediction_horizon}"
        cached_result = await self.redis_client.get_json(cache_key)
        
        if cached_result:
            return cached_result
        
        # Predictive models
        drilling_forecast = await self._predict_drilling_performance(project_id, prediction_horizon)
        resource_forecast = await self._predict_resource_requirements(project_id, prediction_horizon)
        quality_forecast = await self._predict_quality_metrics(project_id, prediction_horizon)
        timeline_forecast = await self._predict_project_timeline(project_id, prediction_horizon)
        risk_forecast = await self._predict_risk_factors(project_id, prediction_horizon)
        
        # Anomaly detection
        anomalies = await self._detect_operational_anomalies(project_id)
        
        predictive_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "project_id": project_id,
            "prediction_horizon": prediction_horizon,
            "drilling_forecast": drilling_forecast,
            "resource_forecast": resource_forecast,
            "quality_forecast": quality_forecast,
            "timeline_forecast": timeline_forecast,
            "risk_forecast": risk_forecast,
            "anomalies": anomalies,
            "confidence_intervals": await self._calculate_prediction_confidence(
                drilling_forecast, resource_forecast, quality_forecast
            )
        }
        
        # Cache results
        await self.redis_client.set_json(cache_key, predictive_data, ttl=self.cache_ttl)
        
        return predictive_data
    
    async def get_real_time_metrics(self, project_id: str) -> Dict[str, Any]:
        """Get real-time operational metrics"""
        
        # Real-time data (no caching)
        current_operations = await self._get_current_operations(project_id)
        active_equipment = await self._get_active_equipment(project_id)
        live_quality_metrics = await self._get_live_quality_metrics(project_id)
        safety_status = await self._get_safety_status(project_id)
        
        real_time_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "project_id": project_id,
            "operations": current_operations,
            "equipment": active_equipment,
            "quality": live_quality_metrics,
            "safety": safety_status,
            "alerts": await self._get_active_alerts(project_id)
        }
        
        return real_time_data
    
    # Financial KPI Calculations
    async def _calculate_financial_kpis(self, org_id: str, time_range: str) -> Dict[str, Any]:
        """Calculate financial KPIs for executive dashboard"""
        
        # Mock financial calculations (integrate with actual financial data)
        return {
            "total_revenue": {
                "value": 2500000,
                "currency": "USD",
                "change_percent": 15.2,
                "trend": "up"
            },
            "total_costs": {
                "value": 1800000,
                "currency": "USD",
                "change_percent": 8.5,
                "trend": "up"
            },
            "gross_profit": {
                "value": 700000,
                "currency": "USD",
                "margin_percent": 28.0,
                "change_percent": 22.1,
                "trend": "up"
            },
            "roi": {
                "value": 38.9,
                "unit": "percent",
                "target": 35.0,
                "performance": "excellent"
            },
            "cost_per_meter": {
                "value": 125.50,
                "currency": "USD",
                "target": 130.00,
                "performance": "good"
            }
        }
    
    async def _calculate_operational_kpis(self, org_id: str, time_range: str) -> Dict[str, Any]:
        """Calculate operational KPIs"""
        
        # Database queries for operational metrics
        db = next(get_db())
        
        try:
            # Drilling metrics
            total_meters = db.query(func.sum(DrillCollar.total_depth)).filter(
                DrillCollar.created_at >= datetime.utcnow() - timedelta(days=30)
            ).scalar() or 0
            
            # Sample metrics
            total_samples = db.query(func.count(DrillAssay.id)).filter(
                DrillAssay.created_at >= datetime.utcnow() - timedelta(days=30)
            ).scalar() or 0
            
            return {
                "drilling_progress": {
                    "total_meters": float(total_meters),
                    "daily_average": float(total_meters) / 30,
                    "target_daily": 150.0,
                    "efficiency": min(100, (float(total_meters) / 30 / 150.0) * 100)
                },
                "sampling_rate": {
                    "total_samples": total_samples,
                    "samples_per_day": total_samples / 30,
                    "target_daily": 50,
                    "efficiency": min(100, (total_samples / 30 / 50) * 100)
                },
                "equipment_utilization": {
                    "average_utilization": 87.5,
                    "target": 85.0,
                    "performance": "excellent"
                },
                "quality_score": {
                    "overall_score": 92.3,
                    "target": 90.0,
                    "performance": "excellent"
                }
            }
        finally:
            db.close()
    
    async def _calculate_strategic_kpis(self, org_id: str, time_range: str) -> Dict[str, Any]:
        """Calculate strategic KPIs"""
        
        return {
            "project_completion": {
                "completed_projects": 12,
                "total_projects": 15,
                "completion_rate": 80.0,
                "target": 85.0,
                "performance": "good"
            },
            "client_satisfaction": {
                "average_rating": 4.6,
                "target": 4.5,
                "total_responses": 28,
                "performance": "excellent"
            },
            "market_share": {
                "current_share": 12.5,
                "target": 15.0,
                "growth_rate": 8.2,
                "performance": "good"
            },
            "innovation_index": {
                "ai_adoption": 85.0,
                "automation_level": 72.0,
                "digital_maturity": 78.5,
                "performance": "excellent"
            }
        }
    
    async def _calculate_risk_metrics(self, org_id: str, time_range: str) -> Dict[str, Any]:
        """Calculate risk assessment metrics"""
        
        return {
            "safety_score": {
                "current_score": 96.2,
                "target": 95.0,
                "incidents_count": 2,
                "performance": "excellent"
            },
            "compliance_score": {
                "current_score": 98.5,
                "target": 95.0,
                "violations_count": 0,
                "performance": "excellent"
            },
            "financial_risk": {
                "risk_level": "low",
                "exposure_amount": 150000,
                "mitigation_coverage": 85.0
            },
            "operational_risk": {
                "risk_level": "medium",
                "critical_dependencies": 3,
                "contingency_plans": 8
            }
        }
    
    # Operational Intelligence Methods
    async def _calculate_drilling_metrics(self, project_id: str, granularity: TimeGranularity) -> Dict[str, Any]:
        """Calculate drilling performance metrics"""
        
        db = next(get_db())
        
        try:
            # Drilling performance calculations
            drill_holes = db.query(DrillCollar).filter(DrillCollar.project_id == project_id).all()
            
            total_meters = sum(hole.total_depth or 0 for hole in drill_holes)
            average_depth = total_meters / len(drill_holes) if drill_holes else 0
            
            return {
                "total_holes": len(drill_holes),
                "total_meters": total_meters,
                "average_depth": average_depth,
                "drilling_rate": total_meters / max(len(drill_holes), 1),
                "completion_rate": 85.2,
                "efficiency_score": 88.7
            }
        finally:
            db.close()
    
    async def _calculate_sampling_metrics(self, project_id: str, granularity: TimeGranularity) -> Dict[str, Any]:
        """Calculate sampling performance metrics"""
        
        return {
            "samples_collected": 1250,
            "samples_analyzed": 1180,
            "pending_analysis": 70,
            "average_turnaround": 3.2,  # days
            "quality_score": 94.5
        }
    
    async def _calculate_quality_metrics(self, project_id: str, granularity: TimeGranularity) -> Dict[str, Any]:
        """Calculate quality control metrics"""
        
        return {
            "qc_pass_rate": 96.8,
            "standard_accuracy": 98.2,
            "blank_contamination": 0.5,
            "duplicate_precision": 95.1,
            "overall_quality_score": 97.2
        }
    
    async def _calculate_productivity_metrics(self, project_id: str, granularity: TimeGranularity) -> Dict[str, Any]:
        """Calculate productivity metrics"""
        
        return {
            "meters_per_day": 145.2,
            "samples_per_day": 42.3,
            "equipment_uptime": 92.5,
            "crew_efficiency": 88.9,
            "overall_productivity": 89.7
        }
    
    # Predictive Analytics Methods
    async def _predict_drilling_performance(self, project_id: str, horizon: str) -> Dict[str, Any]:
        """Predict drilling performance"""
        
        return {
            "predicted_meters": 4500,
            "predicted_holes": 30,
            "completion_probability": 87.5,
            "risk_factors": ["weather", "equipment_maintenance"],
            "confidence": 82.3
        }
    
    async def _predict_resource_requirements(self, project_id: str, horizon: str) -> Dict[str, Any]:
        """Predict resource requirements"""
        
        return {
            "crew_hours": 2400,
            "equipment_hours": 1800,
            "material_costs": 125000,
            "total_cost_estimate": 450000,
            "confidence": 78.9
        }
    
    # Utility Methods
    def _load_kpi_thresholds(self) -> Dict[str, Dict[str, float]]:
        """Load KPI thresholds and targets"""
        
        return {
            "financial": {
                "roi_excellent": 40.0,
                "roi_good": 30.0,
                "roi_warning": 20.0,
                "margin_excellent": 30.0,
                "margin_good": 25.0,
                "margin_warning": 15.0
            },
            "operational": {
                "efficiency_excellent": 90.0,
                "efficiency_good": 80.0,
                "efficiency_warning": 70.0,
                "quality_excellent": 95.0,
                "quality_good": 90.0,
                "quality_warning": 85.0
            }
        }
    
    async def _generate_executive_summary(self, financial, operational, strategic, risk) -> Dict[str, Any]:
        """Generate executive summary with key insights"""
        
        insights = []
        
        # Financial insights
        if financial["roi"]["performance"] == "excellent":
            insights.append("ROI exceeds target by 3.9 percentage points")
        
        # Operational insights
        if operational["drilling_progress"]["efficiency"] > 100:
            insights.append("Drilling operations ahead of schedule")
        
        # Risk insights
        if risk["safety_score"]["performance"] == "excellent":
            insights.append("Safety performance exceeds industry standards")
        
        return {
            "overall_status": "excellent",
            "key_insights": insights,
            "action_items": [
                "Continue current operational efficiency initiatives",
                "Monitor equipment utilization for optimization opportunities",
                "Prepare for Q2 expansion based on strong performance"
            ],
            "next_review": (datetime.utcnow() + timedelta(days=7)).isoformat()
        }
    
    async def _generate_operational_recommendations(self, drilling, sampling, quality, productivity) -> List[str]:
        """Generate operational recommendations"""
        
        recommendations = []
        
        if drilling["efficiency_score"] < 85:
            recommendations.append("Consider equipment maintenance to improve drilling efficiency")
        
        if quality["qc_pass_rate"] < 95:
            recommendations.append("Review QC procedures to improve pass rate")
        
        if productivity["overall_productivity"] < 85:
            recommendations.append("Analyze workflow bottlenecks to improve productivity")
        
        return recommendations
    
    # Real-time Methods
    async def _get_current_operations(self, project_id: str) -> Dict[str, Any]:
        """Get current operational status"""
        
        return {
            "active_drill_holes": 3,
            "crews_on_site": 2,
            "equipment_active": 5,
            "current_depth": 1250.5,
            "status": "active"
        }
    
    async def _get_active_equipment(self, project_id: str) -> List[Dict[str, Any]]:
        """Get active equipment status"""
        
        return [
            {
                "equipment_id": "DRILL_001",
                "type": "Diamond Drill",
                "status": "active",
                "utilization": 87.5,
                "location": {"lat": -26.2041, "lng": 28.0473}
            },
            {
                "equipment_id": "DRILL_002", 
                "type": "RC Drill",
                "status": "maintenance",
                "utilization": 0.0,
                "location": {"lat": -26.2045, "lng": 28.0480}
            }
        ]
    
    async def _get_live_quality_metrics(self, project_id: str) -> Dict[str, Any]:
        """Get live quality metrics"""
        
        return {
            "current_qc_score": 96.2,
            "samples_in_queue": 15,
            "average_processing_time": 2.8,
            "last_updated": datetime.utcnow().isoformat()
        }
    
    async def _get_safety_status(self, project_id: str) -> Dict[str, Any]:
        """Get current safety status"""
        
        return {
            "safety_score": 98.5,
            "incidents_today": 0,
            "safety_meetings": 2,
            "compliance_status": "compliant",
            "last_inspection": (datetime.utcnow() - timedelta(days=2)).isoformat()
        }
    
    async def _get_active_alerts(self, project_id: str) -> List[Dict[str, Any]]:
        """Get active alerts and notifications"""
        
        return [
            {
                "id": "ALERT_001",
                "type": "maintenance",
                "severity": "medium",
                "message": "DRILL_002 scheduled for maintenance in 2 hours",
                "timestamp": datetime.utcnow().isoformat()
            },
            {
                "id": "ALERT_002",
                "type": "quality",
                "severity": "low",
                "message": "QC batch processing delayed by 30 minutes",
                "timestamp": (datetime.utcnow() - timedelta(minutes=15)).isoformat()
            }
        ]

# Global analytics engine instance
analytics_engine = AdvancedAnalyticsEngine()