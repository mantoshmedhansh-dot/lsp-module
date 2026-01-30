"""
Slotting Optimization API Endpoints
"""
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select
from sqlalchemy import and_

from app.core.database import get_session
from app.models.slotting import (
    SkuVelocity, BinCharacteristics, SlottingRule, SlottingRecommendation,
    VelocityClass, VariabilityClass, BinType, ZoneType,
    RecommendationStatus, RecommendationType,
    SkuVelocityResponse, BinCharacteristicsResponse,
    SlottingRuleCreate, SlottingRuleResponse,
    SlottingRecommendationResponse,
    VelocityAnalysisRequest, VelocityAnalysisResponse,
    OptimizationRequest, OptimizationResponse,
    SlottingMetricsResponse
)
from app.services.slotting_engine import slotting_engine

router = APIRouter()


# ==================== Velocity Analysis ====================

@router.get("/analysis", response_model=VelocityAnalysisResponse)
async def get_velocity_analysis(
    warehouse_id: UUID = Query(...),
    period_days: int = Query(30, ge=7, le=365),
    include_zero_movers: bool = False,
    db: Session = Depends(get_session)
):
    """Get velocity analysis for a warehouse."""
    return await slotting_engine.run_velocity_analysis(
        db=db,
        warehouse_id=warehouse_id,
        period_days=period_days,
        include_zero_movers=include_zero_movers
    )


@router.get("/velocity", response_model=List[SkuVelocityResponse])
async def list_sku_velocity(
    warehouse_id: UUID = Query(...),
    velocity_class: Optional[VelocityClass] = None,
    variability_class: Optional[VariabilityClass] = None,
    min_picks: Optional[int] = None,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_session)
):
    """List SKU velocity data."""
    statement = select(SkuVelocity).where(
        SkuVelocity.warehouseId == warehouse_id
    )

    if velocity_class:
        statement = statement.where(SkuVelocity.velocityClass == velocity_class)
    if variability_class:
        statement = statement.where(SkuVelocity.variabilityClass == variability_class)
    if min_picks:
        statement = statement.where(SkuVelocity.pickCountLast30Days >= min_picks)

    statement = statement.order_by(SkuVelocity.pickCountLast30Days.desc()).limit(limit)
    results = db.exec(statement).all()
    return results


# ==================== Optimization ====================

@router.post("/optimize", response_model=OptimizationResponse)
async def run_optimization(
    request: OptimizationRequest,
    db: Session = Depends(get_session)
):
    """Generate slotting recommendations."""
    return await slotting_engine.generate_recommendations(
        db=db,
        warehouse_id=request.warehouseId,
        zones=request.zones,
        skus=request.skus,
        max_recommendations=request.maxRecommendations,
        minimum_savings_percent=request.minimumSavingsPercent
    )


# ==================== Recommendations ====================

@router.get("/recommendations", response_model=List[SlottingRecommendationResponse])
async def list_recommendations(
    warehouse_id: UUID = Query(...),
    status: Optional[RecommendationStatus] = None,
    recommendation_type: Optional[RecommendationType] = None,
    min_priority: Optional[int] = None,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_session)
):
    """List slotting recommendations."""
    statement = select(SlottingRecommendation).where(
        SlottingRecommendation.warehouseId == warehouse_id
    )

    if status:
        statement = statement.where(SlottingRecommendation.status == status)
    else:
        # Default to pending
        statement = statement.where(
            SlottingRecommendation.status == RecommendationStatus.PENDING
        )

    if recommendation_type:
        statement = statement.where(
            SlottingRecommendation.recommendationType == recommendation_type
        )

    if min_priority:
        statement = statement.where(SlottingRecommendation.priority >= min_priority)

    statement = statement.order_by(
        SlottingRecommendation.priority.desc(),
        SlottingRecommendation.estimatedSavingsPercent.desc()
    ).limit(limit)

    results = db.exec(statement).all()
    return results


@router.get("/recommendations/{recommendation_id}", response_model=SlottingRecommendationResponse)
async def get_recommendation(
    recommendation_id: UUID,
    db: Session = Depends(get_session)
):
    """Get recommendation details."""
    statement = select(SlottingRecommendation).where(
        SlottingRecommendation.id == recommendation_id
    )
    recommendation = db.exec(statement).first()

    if not recommendation:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    return recommendation


@router.post("/apply/{recommendation_id}")
async def apply_recommendation(
    recommendation_id: UUID,
    approved_by: UUID = Query(...),
    db: Session = Depends(get_session)
):
    """Apply a slotting recommendation."""
    success = await slotting_engine.apply_recommendation(
        db=db,
        recommendation_id=recommendation_id,
        approved_by=approved_by
    )

    if not success:
        raise HTTPException(
            status_code=400,
            detail="Could not apply recommendation"
        )

    return {
        "message": "Recommendation applied",
        "recommendationId": str(recommendation_id)
    }


@router.post("/recommendations/{recommendation_id}/reject")
async def reject_recommendation(
    recommendation_id: UUID,
    reason: str = Query(...),
    db: Session = Depends(get_session)
):
    """Reject a slotting recommendation."""
    statement = select(SlottingRecommendation).where(
        SlottingRecommendation.id == recommendation_id
    )
    recommendation = db.exec(statement).first()

    if not recommendation:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    recommendation.status = RecommendationStatus.REJECTED
    recommendation.notes = reason
    db.add(recommendation)
    db.commit()

    return {
        "message": "Recommendation rejected",
        "recommendationId": str(recommendation_id)
    }


# ==================== Rules Management ====================

@router.post("/rules", response_model=SlottingRuleResponse)
async def create_rule(
    rule: SlottingRuleCreate,
    db: Session = Depends(get_session)
):
    """Create a slotting rule."""
    new_rule = SlottingRule(
        warehouseId=rule.warehouseId,
        ruleName=rule.ruleName,
        ruleType=rule.ruleType,
        priority=rule.priority,
        velocityClasses=rule.velocityClasses,
        variabilityClasses=rule.variabilityClasses,
        zoneTypes=rule.zoneTypes,
        binTypes=rule.binTypes,
        minPicksPerDay=rule.minPicksPerDay,
        maxPicksPerDay=rule.maxPicksPerDay,
        preferredAisles=rule.preferredAisles,
        preferredLevels=rule.preferredLevels,
        conditions=rule.conditions,
        description=rule.description
    )
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)
    return new_rule


@router.get("/rules", response_model=List[SlottingRuleResponse])
async def list_rules(
    warehouse_id: UUID = Query(...),
    is_active: bool = True,
    db: Session = Depends(get_session)
):
    """List slotting rules."""
    statement = select(SlottingRule).where(
        and_(
            SlottingRule.warehouseId == warehouse_id,
            SlottingRule.isActive == is_active
        )
    ).order_by(SlottingRule.priority.desc())

    results = db.exec(statement).all()
    return results


@router.delete("/rules/{rule_id}")
async def delete_rule(
    rule_id: UUID,
    db: Session = Depends(get_session)
):
    """Deactivate a slotting rule."""
    statement = select(SlottingRule).where(SlottingRule.id == rule_id)
    rule = db.exec(statement).first()

    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    rule.isActive = False
    db.add(rule)
    db.commit()

    return {"message": "Rule deactivated", "ruleId": str(rule_id)}


# ==================== Metrics ====================

@router.get("/metrics", response_model=SlottingMetricsResponse)
async def get_slotting_metrics(
    warehouse_id: UUID = Query(...),
    db: Session = Depends(get_session)
):
    """Get slotting efficiency metrics."""
    return await slotting_engine.get_slotting_metrics(
        db=db,
        warehouse_id=warehouse_id
    )


# ==================== Bin Management ====================

@router.get("/bins", response_model=List[BinCharacteristicsResponse])
async def list_bins(
    warehouse_id: UUID = Query(...),
    zone_type: Optional[ZoneType] = None,
    bin_type: Optional[BinType] = None,
    aisle: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_session)
):
    """List bin characteristics."""
    statement = select(BinCharacteristics).where(
        and_(
            BinCharacteristics.warehouseId == warehouse_id,
            BinCharacteristics.isActive == True
        )
    )

    if zone_type:
        statement = statement.where(BinCharacteristics.zoneType == zone_type)
    if bin_type:
        statement = statement.where(BinCharacteristics.binType == bin_type)
    if aisle:
        statement = statement.where(BinCharacteristics.aisle == aisle)

    statement = statement.order_by(BinCharacteristics.pickSequence).limit(limit)
    results = db.exec(statement).all()
    return results
