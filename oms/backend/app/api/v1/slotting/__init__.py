"""
Slotting Optimization API v1 - SKU velocity analysis, bin optimization
"""
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    User, Location, SKU, Bin,
    SkuVelocity, SkuVelocityResponse,
    BinCharacteristics, BinCharacteristicsCreate, BinCharacteristicsResponse,
    SlottingRule, SlottingRuleCreate, SlottingRuleResponse,
    SlottingRecommendation, SlottingRecommendationResponse,
    VelocityClass, RecommendationStatus, RecommendationType,
)


router = APIRouter(prefix="/slotting", tags=["Slotting Optimization"])


# ============================================================================
# Velocity Analysis
# ============================================================================

@router.get("/analysis", response_model=List[SkuVelocityResponse])
def get_velocity_analysis(
    location_id: Optional[UUID] = None,
    velocity_class: Optional[VelocityClass] = None,
    limit: int = Query(100, ge=1, le=500),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get SKU velocity analysis"""
    query = select(SkuVelocity)

    if company_filter.company_id:
        query = query.where(SkuVelocity.companyId == company_filter.company_id)
    if location_id:
        query = query.where(SkuVelocity.locationId == location_id)
    if velocity_class:
        query = query.where(SkuVelocity.velocityClass == velocity_class)

    query = query.order_by(SkuVelocity.pickFrequency.desc()).limit(limit)
    velocities = session.exec(query).all()
    return velocities


@router.post("/analysis/calculate")
def calculate_velocity(
    location_id: UUID,
    days: int = Query(30, ge=7, le=365),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Calculate/recalculate SKU velocity for a location"""
    from uuid import uuid4

    company_id = company_filter.company_id
    if not company_id:
        location = session.exec(select(Location).where(Location.id == location_id)).first()
        if location:
            company_id = location.companyId

    if not company_id:
        raise HTTPException(status_code=400, detail="Could not determine company")

    # Get all SKUs at this location with pick history
    # This is a placeholder - actual implementation would analyze pick history
    skus = session.exec(
        select(SKU).where(SKU.companyId == company_id)
    ).all()

    created = 0
    updated = 0

    for sku in skus:
        # Check if velocity record exists
        existing = session.exec(
            select(SkuVelocity)
            .where(SkuVelocity.skuId == sku.id)
            .where(SkuVelocity.locationId == location_id)
        ).first()

        # Placeholder velocity calculation
        pick_frequency = 0  # Would be calculated from pick history
        velocity_class = VelocityClass.C  # Default to slow-moving

        if existing:
            existing.pickFrequency = pick_frequency
            existing.velocityClass = velocity_class
            existing.updatedAt = datetime.utcnow()
            session.add(existing)
            updated += 1
        else:
            velocity = SkuVelocity(
                id=uuid4(),
                companyId=company_id,
                skuId=sku.id,
                locationId=location_id,
                analysisDate=date.today(),
                totalPicks=0,
                pickFrequency=pick_frequency,
                avgDailyPicks=Decimal("0"),
                avgDailyUnits=Decimal("0"),
                velocityClass=velocity_class
            )
            session.add(velocity)
            created += 1

    session.commit()

    return {
        "success": True,
        "created": created,
        "updated": updated,
        "message": f"Velocity calculated for {created + updated} SKUs"
    }


# ============================================================================
# Bin Characteristics
# ============================================================================

@router.get("/bins", response_model=List[BinCharacteristicsResponse])
def list_bin_characteristics(
    location_id: Optional[UUID] = None,
    zone: Optional[str] = None,
    is_pick_face: Optional[bool] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List bin characteristics"""
    query = select(BinCharacteristics)

    if company_filter.company_id:
        query = query.where(BinCharacteristics.companyId == company_filter.company_id)
    if location_id:
        query = query.where(BinCharacteristics.locationId == location_id)
    if zone:
        query = query.where(BinCharacteristics.pickZone == zone)
    if is_pick_face is not None:
        query = query.where(BinCharacteristics.isPickFace == is_pick_face)

    bins = session.exec(query).all()
    return bins


@router.post("/bins", response_model=BinCharacteristicsResponse, status_code=status.HTTP_201_CREATED)
def create_bin_characteristics(
    data: BinCharacteristicsCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Create bin characteristics"""
    company_id = company_filter.company_id
    if not company_id:
        location = session.exec(select(Location).where(Location.id == data.locationId)).first()
        if location:
            company_id = location.companyId

    if not company_id:
        raise HTTPException(status_code=400, detail="Could not determine company")

    from uuid import uuid4
    bin_char = BinCharacteristics(
        id=uuid4(),
        companyId=company_id,
        **data.model_dump()
    )
    session.add(bin_char)
    session.commit()
    session.refresh(bin_char)
    return bin_char


# ============================================================================
# Slotting Rules
# ============================================================================

@router.get("/rules", response_model=List[SlottingRuleResponse])
def list_slotting_rules(
    location_id: Optional[UUID] = None,
    is_active: bool = True,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List slotting rules"""
    query = select(SlottingRule).where(SlottingRule.isActive == is_active)

    if company_filter.company_id:
        query = query.where(SlottingRule.companyId == company_filter.company_id)
    if location_id:
        query = query.where(SlottingRule.locationId == location_id)

    query = query.order_by(SlottingRule.priority.desc())
    rules = session.exec(query).all()
    return rules


@router.post("/rules", response_model=SlottingRuleResponse, status_code=status.HTTP_201_CREATED)
def create_slotting_rule(
    data: SlottingRuleCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Create a slotting rule"""
    company_id = company_filter.company_id
    if not company_id:
        location = session.exec(select(Location).where(Location.id == data.locationId)).first()
        if location:
            company_id = location.companyId

    if not company_id:
        raise HTTPException(status_code=400, detail="Could not determine company")

    from uuid import uuid4
    rule = SlottingRule(
        id=uuid4(),
        companyId=company_id,
        **data.model_dump()
    )
    session.add(rule)
    session.commit()
    session.refresh(rule)
    return rule


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_slotting_rule(
    rule_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Deactivate a slotting rule"""
    query = select(SlottingRule).where(SlottingRule.id == rule_id)
    if company_filter.company_id:
        query = query.where(SlottingRule.companyId == company_filter.company_id)

    rule = session.exec(query).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    rule.isActive = False
    rule.updatedAt = datetime.utcnow()
    session.add(rule)
    session.commit()


# ============================================================================
# Recommendations
# ============================================================================

@router.get("/recommendations", response_model=List[SlottingRecommendationResponse])
def list_recommendations(
    location_id: Optional[UUID] = None,
    status: Optional[RecommendationStatus] = None,
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List slotting recommendations"""
    query = select(SlottingRecommendation)

    if company_filter.company_id:
        query = query.where(SlottingRecommendation.companyId == company_filter.company_id)
    if location_id:
        query = query.where(SlottingRecommendation.locationId == location_id)
    if status:
        query = query.where(SlottingRecommendation.status == status)

    query = query.order_by(SlottingRecommendation.priorityScore.desc()).limit(limit)
    recommendations = session.exec(query).all()
    return recommendations


@router.post("/optimize")
def generate_recommendations(
    location_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Generate slotting optimization recommendations"""
    from uuid import uuid4

    company_id = company_filter.company_id
    if not company_id:
        location = session.exec(select(Location).where(Location.id == location_id)).first()
        if location:
            company_id = location.companyId

    if not company_id:
        raise HTTPException(status_code=400, detail="Could not determine company")

    # Get velocity data
    velocities = session.exec(
        select(SkuVelocity)
        .where(SkuVelocity.locationId == location_id)
        .where(SkuVelocity.companyId == company_id)
        .order_by(SkuVelocity.pickFrequency.desc())
    ).all()

    recommendations_created = 0

    # Simple optimization: high-velocity SKUs should be in pick faces
    for velocity in velocities:
        if velocity.velocityClass == VelocityClass.A:
            # Check if already in optimal location
            # Create recommendation to move to pick face if not
            rec = SlottingRecommendation(
                id=uuid4(),
                companyId=company_id,
                locationId=location_id,
                skuId=velocity.skuId,
                recommendationType=RecommendationType.RELOCATE,
                currentBinId=None,
                suggestedBinId=None,
                reason="High velocity SKU (Class A) - move to pick face",
                expectedBenefit="Reduced pick time",
                priorityScore=Decimal("10"),
                status=RecommendationStatus.PENDING
            )
            session.add(rec)
            recommendations_created += 1

    session.commit()

    return {
        "success": True,
        "recommendationsCreated": recommendations_created,
        "message": f"Generated {recommendations_created} optimization recommendations"
    }


@router.post("/apply/{recommendation_id}")
def apply_recommendation(
    recommendation_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Apply a slotting recommendation"""
    query = select(SlottingRecommendation).where(SlottingRecommendation.id == recommendation_id)
    if company_filter.company_id:
        query = query.where(SlottingRecommendation.companyId == company_filter.company_id)

    rec = session.exec(query).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    if rec.status != RecommendationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Recommendation is not pending")

    rec.status = RecommendationStatus.COMPLETED
    rec.approvedById = current_user.id
    rec.approvedAt = datetime.utcnow()
    rec.completedAt = datetime.utcnow()
    rec.updatedAt = datetime.utcnow()
    session.add(rec)
    session.commit()

    return {"success": True, "message": "Recommendation applied"}


@router.post("/reject/{recommendation_id}")
def reject_recommendation(
    recommendation_id: UUID,
    reason: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Reject a slotting recommendation"""
    query = select(SlottingRecommendation).where(SlottingRecommendation.id == recommendation_id)
    if company_filter.company_id:
        query = query.where(SlottingRecommendation.companyId == company_filter.company_id)

    rec = session.exec(query).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    if rec.status != RecommendationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Recommendation is not pending")

    rec.status = RecommendationStatus.REJECTED
    if reason:
        rec.reason = f"{rec.reason} | Rejected: {reason}"
    rec.updatedAt = datetime.utcnow()
    session.add(rec)
    session.commit()

    return {"success": True, "message": "Recommendation rejected"}


# ============================================================================
# Metrics
# ============================================================================

@router.get("/metrics")
def get_slotting_metrics(
    location_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get slotting efficiency metrics"""
    # Velocity distribution
    velocity_query = select(
        SkuVelocity.velocityClass,
        func.count(SkuVelocity.id).label("count")
    ).group_by(SkuVelocity.velocityClass)

    if company_filter.company_id:
        velocity_query = velocity_query.where(SkuVelocity.companyId == company_filter.company_id)
    if location_id:
        velocity_query = velocity_query.where(SkuVelocity.locationId == location_id)

    velocity_dist = session.exec(velocity_query).all()

    # Recommendation stats
    rec_query = select(
        SlottingRecommendation.status,
        func.count(SlottingRecommendation.id).label("count")
    ).group_by(SlottingRecommendation.status)

    if company_filter.company_id:
        rec_query = rec_query.where(SlottingRecommendation.companyId == company_filter.company_id)
    if location_id:
        rec_query = rec_query.where(SlottingRecommendation.locationId == location_id)

    rec_stats = session.exec(rec_query).all()

    return {
        "velocityDistribution": {str(v[0].value): v[1] for v in velocity_dist},
        "recommendationStats": {str(r[0].value): r[1] for r in rec_stats},
        "optimizationScore": 75  # Placeholder
    }
