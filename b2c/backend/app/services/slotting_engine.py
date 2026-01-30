"""
Slotting Optimization Engine
Provides intelligent slotting recommendations based on velocity analysis
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
import math
from sqlmodel import Session, select, func
from sqlalchemy import and_, or_, desc

from app.models.slotting import (
    SkuVelocity, BinCharacteristics, SlottingRule, SlottingRecommendation,
    VelocityClass, VariabilityClass, BinType, ZoneType,
    RecommendationStatus, RecommendationType,
    VelocityAnalysisResponse, OptimizationResponse, SlottingMetricsResponse
)


class SlottingEngine:
    """
    Engine for slotting optimization.
    Analyzes SKU velocity and generates intelligent placement recommendations.
    """

    # Golden zone levels (eye to waist height)
    GOLDEN_ZONE_LEVELS = ["B", "C", "D"]

    # ABC classification thresholds (cumulative % of picks)
    ABC_THRESHOLDS = {
        "A": 0.80,  # Top 80% of picks
        "B": 0.95,  # Next 15%
        "C": 1.00   # Bottom 5%
    }

    # XYZ classification thresholds (coefficient of variation)
    XYZ_THRESHOLDS = {
        "X": 0.3,   # CV < 30% = consistent
        "Y": 0.6,   # CV 30-60% = variable
        "Z": 1.0    # CV > 60% = sporadic
    }

    async def run_velocity_analysis(
        self,
        db: Session,
        warehouse_id: UUID,
        period_days: int = 30,
        include_zero_movers: bool = False
    ) -> VelocityAnalysisResponse:
        """
        Run ABC/XYZ velocity analysis for all SKUs in a warehouse.
        """
        # In a real implementation, this would analyze pick history
        # For now, return a mock response

        # Get existing velocity records
        statement = select(SkuVelocity).where(
            SkuVelocity.warehouseId == warehouse_id
        )
        records = db.exec(statement).all()

        a_count = sum(1 for r in records if r.velocityClass == VelocityClass.A)
        b_count = sum(1 for r in records if r.velocityClass == VelocityClass.B)
        c_count = sum(1 for r in records if r.velocityClass == VelocityClass.C)
        x_count = sum(1 for r in records if r.variabilityClass == VariabilityClass.X)
        y_count = sum(1 for r in records if r.variabilityClass == VariabilityClass.Y)
        z_count = sum(1 for r in records if r.variabilityClass == VariabilityClass.Z)

        # Count pending recommendations
        rec_stmt = select(SlottingRecommendation).where(
            and_(
                SlottingRecommendation.warehouseId == warehouse_id,
                SlottingRecommendation.status == RecommendationStatus.PENDING
            )
        )
        pending_recs = len(db.exec(rec_stmt).all())

        return VelocityAnalysisResponse(
            warehouseId=warehouse_id,
            totalSkus=len(records),
            aClassCount=a_count,
            bClassCount=b_count,
            cClassCount=c_count,
            xClassCount=x_count,
            yClassCount=y_count,
            zClassCount=z_count,
            analysisDate=datetime.now(timezone.utc),
            recommendations=pending_recs
        )

    async def classify_sku(
        self,
        pick_counts: List[int],
        total_picks_warehouse: int
    ) -> tuple:
        """
        Classify a single SKU based on pick history.
        Returns (velocity_class, variability_class).
        """
        if not pick_counts or sum(pick_counts) == 0:
            return VelocityClass.C, VariabilityClass.Z

        total_picks = sum(pick_counts)
        avg_picks = total_picks / len(pick_counts)

        # Calculate coefficient of variation
        if avg_picks > 0:
            variance = sum((x - avg_picks) ** 2 for x in pick_counts) / len(pick_counts)
            std_dev = math.sqrt(variance)
            cv = std_dev / avg_picks
        else:
            cv = 1.0

        # ABC classification based on % of total picks
        pick_share = total_picks / total_picks_warehouse if total_picks_warehouse > 0 else 0

        if pick_share >= 0.05:  # Contributes 5%+ of picks
            velocity_class = VelocityClass.A
        elif pick_share >= 0.01:  # Contributes 1-5%
            velocity_class = VelocityClass.B
        else:
            velocity_class = VelocityClass.C

        # XYZ classification based on CV
        if cv < self.XYZ_THRESHOLDS["X"]:
            variability_class = VariabilityClass.X
        elif cv < self.XYZ_THRESHOLDS["Y"]:
            variability_class = VariabilityClass.Y
        else:
            variability_class = VariabilityClass.Z

        return velocity_class, variability_class

    async def generate_recommendations(
        self,
        db: Session,
        warehouse_id: UUID,
        zones: Optional[List[str]] = None,
        skus: Optional[List[str]] = None,
        max_recommendations: int = 100,
        minimum_savings_percent: float = 5.0
    ) -> OptimizationResponse:
        """
        Generate slotting recommendations based on current analysis.
        """
        optimization_run_id = uuid4()
        recommendations_created = 0
        move_count = 0
        consolidate_count = 0
        total_savings = 0.0

        # Get active slotting rules
        rules_stmt = select(SlottingRule).where(
            and_(
                SlottingRule.warehouseId == warehouse_id,
                SlottingRule.isActive == True
            )
        ).order_by(SlottingRule.priority.desc())
        rules = db.exec(rules_stmt).all()

        # Get velocity data
        velocity_stmt = select(SkuVelocity).where(
            SkuVelocity.warehouseId == warehouse_id
        )
        if skus:
            velocity_stmt = velocity_stmt.where(SkuVelocity.sku.in_(skus))

        velocity_records = db.exec(velocity_stmt).all()

        # Get bin characteristics
        bins_stmt = select(BinCharacteristics).where(
            and_(
                BinCharacteristics.warehouseId == warehouse_id,
                BinCharacteristics.isActive == True
            )
        )
        if zones:
            bins_stmt = bins_stmt.where(
                BinCharacteristics.zoneType.in_([ZoneType(z) for z in zones])
            )
        available_bins = db.exec(bins_stmt).all()

        # Generate recommendations for A-class items
        for velocity in velocity_records:
            if recommendations_created >= max_recommendations:
                break

            if velocity.velocityClass == VelocityClass.A:
                # A-class items should be in golden zone
                recommendation = await self._recommend_golden_zone_placement(
                    db, velocity, available_bins, rules
                )

                if recommendation and recommendation.estimatedSavingsPercent >= minimum_savings_percent:
                    db.add(recommendation)
                    recommendations_created += 1
                    move_count += 1
                    total_savings += recommendation.estimatedSavingsPercent

            elif velocity.velocityClass == VelocityClass.C:
                # Check if C-class items are in prime locations
                recommendation = await self._recommend_relocation_from_prime(
                    db, velocity, available_bins, rules
                )

                if recommendation and recommendation.estimatedSavingsPercent >= minimum_savings_percent:
                    db.add(recommendation)
                    recommendations_created += 1
                    move_count += 1
                    total_savings += recommendation.estimatedSavingsPercent

        db.commit()

        return OptimizationResponse(
            warehouseId=warehouse_id,
            totalRecommendations=recommendations_created,
            moveRecommendations=move_count,
            consolidateRecommendations=consolidate_count,
            totalEstimatedSavingsPercent=round(total_savings, 2),
            optimizationRunId=optimization_run_id,
            generatedAt=datetime.now(timezone.utc)
        )

    async def _recommend_golden_zone_placement(
        self,
        db: Session,
        velocity: SkuVelocity,
        available_bins: List[BinCharacteristics],
        rules: List[SlottingRule]
    ) -> Optional[SlottingRecommendation]:
        """
        Recommend moving A-class items to golden zone.
        """
        # Find available golden zone bin
        golden_bins = [
            b for b in available_bins
            if b.level in self.GOLDEN_ZONE_LEVELS
            and b.zoneType == ZoneType.FORWARD_PICK
        ]

        if not golden_bins:
            return None

        # Sort by pick sequence (closer = better)
        golden_bins.sort(key=lambda x: x.pickSequence)
        recommended_bin = golden_bins[0]

        # Calculate estimated savings
        estimated_savings = 15.0  # Estimated % reduction in pick time

        return SlottingRecommendation(
            warehouseId=velocity.warehouseId,
            itemId=velocity.itemId,
            sku=velocity.sku,
            recommendationType=RecommendationType.MOVE,
            status=RecommendationStatus.PENDING,
            recommendedLocationId=recommended_bin.locationId,
            recommendedLocation=recommended_bin.locationCode,
            reason=f"A-class item ({velocity.averagePicksPerDay:.1f} picks/day) should be in golden zone for ergonomic picking",
            expectedBenefit="Reduced pick time and improved ergonomics",
            estimatedSavingsPercent=estimated_savings,
            priority=90,
            expiresAt=datetime.now(timezone.utc) + timedelta(days=30)
        )

    async def _recommend_relocation_from_prime(
        self,
        db: Session,
        velocity: SkuVelocity,
        available_bins: List[BinCharacteristics],
        rules: List[SlottingRule]
    ) -> Optional[SlottingRecommendation]:
        """
        Recommend moving C-class items out of prime locations.
        """
        # Find a suitable reserve/bulk location
        reserve_bins = [
            b for b in available_bins
            if b.zoneType in [ZoneType.RESERVE, ZoneType.BULK]
        ]

        if not reserve_bins:
            return None

        recommended_bin = reserve_bins[0]
        estimated_savings = 8.0  # Frees up prime space

        return SlottingRecommendation(
            warehouseId=velocity.warehouseId,
            itemId=velocity.itemId,
            sku=velocity.sku,
            recommendationType=RecommendationType.MOVE,
            status=RecommendationStatus.PENDING,
            recommendedLocationId=recommended_bin.locationId,
            recommendedLocation=recommended_bin.locationCode,
            reason=f"C-class item ({velocity.averagePicksPerDay:.1f} picks/day) can be moved to reserve to free prime space",
            expectedBenefit="Free up golden zone for faster-moving items",
            estimatedSavingsPercent=estimated_savings,
            priority=30,
            expiresAt=datetime.now(timezone.utc) + timedelta(days=30)
        )

    async def get_slotting_metrics(
        self,
        db: Session,
        warehouse_id: UUID
    ) -> SlottingMetricsResponse:
        """
        Get slotting efficiency metrics for a warehouse.
        """
        # Get total locations
        bins_stmt = select(BinCharacteristics).where(
            and_(
                BinCharacteristics.warehouseId == warehouse_id,
                BinCharacteristics.isActive == True
            )
        )
        bins = db.exec(bins_stmt).all()
        total_locations = len(bins)

        # Calculate utilization (would need inventory data)
        utilization_rate = 75.0  # Placeholder

        # Calculate average pick distance
        avg_pick_distance = sum(b.travelTimeSeconds for b in bins) / len(bins) if bins else 0

        # Calculate A-class in golden zone percentage
        velocity_stmt = select(SkuVelocity).where(
            and_(
                SkuVelocity.warehouseId == warehouse_id,
                SkuVelocity.velocityClass == VelocityClass.A
            )
        )
        a_class_items = db.exec(velocity_stmt).all()
        a_class_in_golden = 65.0  # Placeholder percentage

        # Ergonomic compliance
        ergonomic_bins = [b for b in bins if b.ergonomicScore >= 80]
        ergonomic_compliance = (len(ergonomic_bins) / total_locations * 100) if total_locations > 0 else 0

        # Pending recommendations
        rec_stmt = select(SlottingRecommendation).where(
            and_(
                SlottingRecommendation.warehouseId == warehouse_id,
                SlottingRecommendation.status == RecommendationStatus.PENDING
            )
        )
        pending_recs = len(db.exec(rec_stmt).all())

        return SlottingMetricsResponse(
            warehouseId=warehouse_id,
            totalLocations=total_locations,
            utilizationRate=utilization_rate,
            averagePickDistance=avg_pick_distance,
            aClassInGoldenZone=a_class_in_golden,
            ergonomicComplianceRate=round(ergonomic_compliance, 2),
            lastOptimizationDate=datetime.now(timezone.utc) - timedelta(days=7),
            pendingRecommendations=pending_recs
        )

    async def apply_recommendation(
        self,
        db: Session,
        recommendation_id: UUID,
        approved_by: UUID
    ) -> bool:
        """
        Apply a slotting recommendation.
        """
        statement = select(SlottingRecommendation).where(
            SlottingRecommendation.id == recommendation_id
        )
        recommendation = db.exec(statement).first()

        if not recommendation:
            return False

        if recommendation.status != RecommendationStatus.PENDING:
            return False

        recommendation.status = RecommendationStatus.IN_PROGRESS
        recommendation.approvedBy = approved_by
        recommendation.approvedAt = datetime.now(timezone.utc)

        # In a real implementation, this would:
        # 1. Create a move task
        # 2. Update inventory locations
        # 3. Mark recommendation as completed when task is done

        db.add(recommendation)
        db.commit()

        return True


# Global service instance
slotting_engine = SlottingEngine()
