"""
Advanced Analytics and Business Intelligence API

Provides comprehensive analytics endpoints for:
- Executive dashboards and KPIs
- Operational intelligence
- Financial analytics and reporting
- Predictive analytics and forecasting
- Real-time operational metrics
"""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta
import asyncio

from app.database import get_db
from app.core.security import get_current_user
from app.services.analytics_engine import analytics_engine, TimeGranularity
from app.schemas.core import SuccessResponse

router = APIRouter()

# Executive Dashboard Endpoints
@router.get("/executive/dashboard")
async def get_executive_dashboard(
    org_id: UUID,
    time_range: str = Query("30d", regex="^(7d|30d|90d|1y)$"),
    current_user = Depends(get_current_user)
):
    """
    Get executive dashboard with high-level KPIs and metrics
    
    Time ranges: 7d, 30d, 90d, 1y
    """
    try:
        dashboard_data = await analytics_engine.get_executive_dashboard(
            str(org_id), time_range
        )
        return dashboard_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate executive dashboard: {str(e)}")

@router.get("/executive/kpis")
async def get_executive_kpis(
    org_id: UUID,
    kpi_categories: List[str] = Query(["financial", "operational", "strategic", "risk"]),
    time_range: str = Query("30d"),
    current_user = Depends(get_current_user)
):
    """Get specific KPI categories for executive reporting"""
    
    try:
        dashboard_data = await analytics_engine.get_executive_dashboard(
            str(org_id), time_range
        )
        
        # Filter by requested categories
        filtered_kpis = {
            category: dashboard_data.get(category, {})
            for category in kpi_categories
            if category in dashboard_data
        }
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "organization_id": str(org_id),
            "time_range": time_range,
            "kpis": filtered_kpis
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get KPIs: {str(e)}")

@router.get("/executive/summary")
async def get_executive_summary(
    org_id: UUID,
    current_user = Depends(get_current_user)
):
    """Get executive summary with key insights and action items"""
    
    try:
        dashboard_data = await analytics_engine.get_executive_dashboard(str(org_id))
        return dashboard_data.get("summary", {})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get executive summary: {str(e)}")

# Operational Intelligence Endpoints
@router.get("/operational/intelligence")
async def get_operational_intelligence(
    project_id: UUID,
    granularity: str = Query("daily", regex="^(real_time|hourly|daily|weekly|monthly)$"),
    current_user = Depends(get_current_user)
):
    """Get comprehensive operational intelligence for project management"""
    
    try:
        granularity_enum = TimeGranularity(granularity)
        operational_data = await analytics_engine.get_operational_intelligence(
            str(project_id), granularity_enum
        )
        return operational_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get operational intelligence: {str(e)}")

@router.get("/operational/metrics")
async def get_operational_metrics(
    project_id: UUID,
    metric_types: List[str] = Query(["drilling", "sampling", "quality", "productivity"]),
    granularity: str = Query("daily"),
    current_user = Depends(get_current_user)
):
    """Get specific operational metrics"""
    
    try:
        granularity_enum = TimeGranularity(granularity)
        operational_data = await analytics_engine.get_operational_intelligence(
            str(project_id), granularity_enum
        )
        
        # Filter by requested metric types
        filtered_metrics = {
            metric_type: operational_data.get(metric_type, {})
            for metric_type in metric_types
            if metric_type in operational_data
        }
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "project_id": str(project_id),
            "granularity": granularity,
            "metrics": filtered_metrics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get operational metrics: {str(e)}")

@router.get("/operational/recommendations")
async def get_operational_recommendations(
    project_id: UUID,
    current_user = Depends(get_current_user)
):
    """Get operational recommendations based on current performance"""
    
    try:
        operational_data = await analytics_engine.get_operational_intelligence(str(project_id))
        return {
            "project_id": str(project_id),
            "recommendations": operational_data.get("recommendations", []),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get recommendations: {str(e)}")

# Financial Analytics Endpoints
@router.get("/financial/analytics")
async def get_financial_analytics(
    org_id: UUID,
    time_range: str = Query("12m", regex="^(3m|6m|12m|24m)$"),
    current_user = Depends(get_current_user)
):
    """Get comprehensive financial analytics and reporting"""
    
    try:
        financial_data = await analytics_engine.get_financial_analytics(
            str(org_id), time_range
        )
        return financial_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get financial analytics: {str(e)}")

@router.get("/financial/roi")
async def get_roi_analysis(
    org_id: UUID,
    project_ids: Optional[List[UUID]] = Query(None),
    time_range: str = Query("12m"),
    current_user = Depends(get_current_user)
):
    """Get ROI analysis for organization or specific projects"""
    
    try:
        financial_data = await analytics_engine.get_financial_analytics(
            str(org_id), time_range
        )
        
        roi_data = financial_data.get("roi", {})
        
        # Filter by project IDs if specified
        if project_ids:
            # Implementation would filter by specific projects
            pass
        
        return {
            "organization_id": str(org_id),
            "time_range": time_range,
            "roi_analysis": roi_data,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get ROI analysis: {str(e)}")

@router.get("/financial/cost-analysis")
async def get_cost_analysis(
    org_id: UUID,
    cost_categories: List[str] = Query(["drilling", "sampling", "analysis", "personnel", "equipment"]),
    time_range: str = Query("12m"),
    current_user = Depends(get_current_user)
):
    """Get detailed cost analysis by category"""
    
    try:
        financial_data = await analytics_engine.get_financial_analytics(
            str(org_id), time_range
        )
        
        cost_data = financial_data.get("costs", {})
        
        return {
            "organization_id": str(org_id),
            "time_range": time_range,
            "cost_categories": cost_categories,
            "cost_analysis": cost_data,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get cost analysis: {str(e)}")

# Predictive Analytics Endpoints
@router.get("/predictive/analytics")
async def get_predictive_analytics(
    project_id: UUID,
    prediction_horizon: str = Query("90d", regex="^(30d|60d|90d|180d|1y)$"),
    current_user = Depends(get_current_user)
):
    """Get comprehensive predictive analytics and forecasts"""
    
    try:
        predictive_data = await analytics_engine.get_predictive_analytics(
            str(project_id), prediction_horizon
        )
        return predictive_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get predictive analytics: {str(e)}")

@router.get("/predictive/forecasts")
async def get_forecasts(
    project_id: UUID,
    forecast_types: List[str] = Query(["drilling", "resource", "quality", "timeline", "risk"]),
    prediction_horizon: str = Query("90d"),
    current_user = Depends(get_current_user)
):
    """Get specific forecast types"""
    
    try:
        predictive_data = await analytics_engine.get_predictive_analytics(
            str(project_id), prediction_horizon
        )
        
        # Filter by requested forecast types
        filtered_forecasts = {}
        for forecast_type in forecast_types:
            forecast_key = f"{forecast_type}_forecast"
            if forecast_key in predictive_data:
                filtered_forecasts[forecast_type] = predictive_data[forecast_key]
        
        return {
            "project_id": str(project_id),
            "prediction_horizon": prediction_horizon,
            "forecasts": filtered_forecasts,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get forecasts: {str(e)}")

@router.get("/predictive/anomalies")
async def get_anomaly_detection(
    project_id: UUID,
    current_user = Depends(get_current_user)
):
    """Get anomaly detection results"""
    
    try:
        predictive_data = await analytics_engine.get_predictive_analytics(str(project_id))
        return {
            "project_id": str(project_id),
            "anomalies": predictive_data.get("anomalies", []),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get anomaly detection: {str(e)}")

# Real-time Analytics Endpoints
@router.get("/realtime/metrics")
async def get_realtime_metrics(
    project_id: UUID,
    current_user = Depends(get_current_user)
):
    """Get real-time operational metrics"""
    
    try:
        realtime_data = await analytics_engine.get_real_time_metrics(str(project_id))
        return realtime_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get real-time metrics: {str(e)}")

@router.get("/realtime/status")
async def get_realtime_status(
    project_id: UUID,
    current_user = Depends(get_current_user)
):
    """Get real-time project status"""
    
    try:
        realtime_data = await analytics_engine.get_real_time_metrics(str(project_id))
        
        return {
            "project_id": str(project_id),
            "status": realtime_data.get("operations", {}).get("status", "unknown"),
            "active_operations": realtime_data.get("operations", {}),
            "alerts": realtime_data.get("alerts", []),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get real-time status: {str(e)}")

@router.get("/realtime/alerts")
async def get_active_alerts(
    project_id: UUID,
    severity_filter: Optional[str] = Query(None, regex="^(low|medium|high|critical)$"),
    current_user = Depends(get_current_user)
):
    """Get active alerts and notifications"""
    
    try:
        realtime_data = await analytics_engine.get_real_time_metrics(str(project_id))
        alerts = realtime_data.get("alerts", [])
        
        # Filter by severity if specified
        if severity_filter:
            alerts = [alert for alert in alerts if alert.get("severity") == severity_filter]
        
        return {
            "project_id": str(project_id),
            "alerts": alerts,
            "total_count": len(alerts),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get alerts: {str(e)}")

# Custom Analytics Endpoints
@router.post("/custom/query")
async def execute_custom_analytics_query(
    query_definition: Dict[str, Any],
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Execute custom analytics query"""
    
    try:
        # Validate query definition
        required_fields = ["query_type", "parameters", "output_format"]
        for field in required_fields:
            if field not in query_definition:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # Execute custom query (implementation would depend on query type)
        result = {
            "query_id": "custom_query_001",
            "status": "completed",
            "results": {
                "message": "Custom query execution not yet implemented",
                "query_definition": query_definition
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute custom query: {str(e)}")

@router.get("/reports/generate")
async def generate_analytics_report(
    report_type: str = Query(..., regex="^(executive|operational|financial|predictive)$"),
    org_id: Optional[UUID] = Query(None),
    project_id: Optional[UUID] = Query(None),
    time_range: str = Query("30d"),
    format: str = Query("json", regex="^(json|pdf|excel)$"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user = Depends(get_current_user)
):
    """Generate comprehensive analytics report"""
    
    try:
        # Validate parameters
        if not org_id and not project_id:
            raise HTTPException(status_code=400, detail="Either org_id or project_id must be provided")
        
        # Generate report based on type
        if report_type == "executive" and org_id:
            report_data = await analytics_engine.get_executive_dashboard(str(org_id), time_range)
        elif report_type == "operational" and project_id:
            report_data = await analytics_engine.get_operational_intelligence(str(project_id))
        elif report_type == "financial" and org_id:
            report_data = await analytics_engine.get_financial_analytics(str(org_id), time_range)
        elif report_type == "predictive" and project_id:
            report_data = await analytics_engine.get_predictive_analytics(str(project_id))
        else:
            raise HTTPException(status_code=400, detail="Invalid report type or missing required parameters")
        
        # For non-JSON formats, add background task for report generation
        if format in ["pdf", "excel"]:
            report_id = f"report_{report_type}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
            background_tasks.add_task(
                generate_report_file, report_id, report_type, report_data, format
            )
            
            return {
                "report_id": report_id,
                "status": "generating",
                "format": format,
                "estimated_completion": (datetime.utcnow() + timedelta(minutes=5)).isoformat()
            }
        
        return {
            "report_type": report_type,
            "format": format,
            "data": report_data,
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")

@router.get("/reports/status/{report_id}")
async def get_report_status(
    report_id: str,
    current_user = Depends(get_current_user)
):
    """Get status of report generation"""
    
    # Implementation would check report generation status
    return {
        "report_id": report_id,
        "status": "completed",
        "download_url": f"/api/v1/analytics/reports/download/{report_id}",
        "generated_at": datetime.utcnow().isoformat()
    }

@router.get("/reports/download/{report_id}")
async def download_report(
    report_id: str,
    current_user = Depends(get_current_user)
):
    """Download generated report"""
    
    # Implementation would serve the generated report file
    raise HTTPException(status_code=501, detail="Report download not yet implemented")

# Utility Functions
async def generate_report_file(
    report_id: str, 
    report_type: str, 
    report_data: Dict[str, Any], 
    format: str
):
    """Background task to generate report files"""
    
    # Implementation would generate PDF or Excel files
    # For now, just simulate the process
    await asyncio.sleep(30)  # Simulate report generation time
    
    # Store report file and update status
    # Implementation would save to file storage and update database