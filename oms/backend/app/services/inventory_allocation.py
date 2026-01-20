"""
Inventory Allocation Service
Implements FIFO/LIFO/FEFO allocation strategies for inventory picking
"""
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Tuple
from uuid import UUID

from sqlmodel import Session, select, func

from app.models import (
    Inventory, SKU, Bin, Zone, Location, Company,
    InventoryAllocation, InventoryAllocationBrief,
    AllocationRequest, AllocationResult,
    BulkAllocationRequest, BulkAllocationResult,
)
from app.services.fifo_sequence import FifoSequenceService


class InventoryAllocationService:
    """
    Service for allocating inventory using FIFO/LIFO/FEFO strategies.
    Handles reservation and release of inventory for orders and waves.
    """

    def __init__(self, session: Session):
        self.session = session
        self.fifo_service = FifoSequenceService(session)

    def generate_allocation_no(self) -> str:
        """Generate unique allocation number."""
        count = self.session.exec(
            select(func.count(InventoryAllocation.id))
        ).one()
        return f"ALLOC-{count + 1:08d}"

    def get_valuation_method(
        self,
        sku_id: UUID,
        location_id: UUID,
        company_id: UUID
    ) -> str:
        """
        Determine the valuation method to use for allocation.
        Priority: SKU override > Location override > Company default
        Falls back to FIFO if no overrides are set or if columns don't exist.
        """
        try:
            # Check SKU override
            sku = self.session.exec(
                select(SKU).where(SKU.id == sku_id)
            ).first()
            if sku and hasattr(sku, 'valuationMethod') and sku.valuationMethod:
                return sku.valuationMethod
        except Exception:
            pass  # Column might not exist

        try:
            # Check Location override
            location = self.session.exec(
                select(Location).where(Location.id == location_id)
            ).first()
            if location and hasattr(location, 'valuationMethod') and location.valuationMethod:
                return location.valuationMethod
        except Exception:
            pass  # Column might not exist

        # Skip Company query as the column may not exist in database
        # Company.defaultValuationMethod is optional and may not be migrated

        # Ultimate fallback - FIFO is the industry standard
        return "FIFO"

    def get_available_inventory(
        self,
        sku_id: UUID,
        location_id: UUID,
        valuation_method: str,
        preferred_bin_id: Optional[UUID] = None
    ) -> List[Inventory]:
        """
        Get available inventory records ordered by valuation method.
        - FIFO: Order by fifoSequence ASC (oldest first)
        - LIFO: Order by fifoSequence DESC (newest first)
        - FEFO: Order by expiryDate ASC (earliest expiry first)
        """
        # Base query for available inventory
        query = (
            select(Inventory)
            .where(Inventory.skuId == sku_id)
            .where(Inventory.locationId == location_id)
            .where((Inventory.quantity - Inventory.reservedQty) > 0)
        )

        # Prefer specific bin if provided
        if preferred_bin_id:
            # Get inventory from preferred bin first, then others
            preferred = self.session.exec(
                query.where(Inventory.binId == preferred_bin_id)
            ).all()
            others = self.session.exec(
                query.where(Inventory.binId != preferred_bin_id)
            ).all()
            inventory_records = list(preferred) + list(others)
        else:
            inventory_records = list(self.session.exec(query).all())

        # Sort by valuation method
        if valuation_method == "FIFO":
            inventory_records.sort(key=lambda x: x.fifoSequence or 0)
        elif valuation_method == "LIFO":
            inventory_records.sort(key=lambda x: x.fifoSequence or 0, reverse=True)
        elif valuation_method == "FEFO":
            # Sort by expiry date (earliest first), nulls last
            inventory_records.sort(
                key=lambda x: (x.expiryDate is None, x.expiryDate or datetime.max)
            )
        # WAC doesn't require specific ordering, use FIFO as default

        return inventory_records

    def allocate_inventory(
        self,
        request: AllocationRequest,
        company_id: UUID,
        allocated_by_id: Optional[UUID] = None
    ) -> AllocationResult:
        """
        Allocate inventory for a single SKU request.
        Creates allocation records and updates reserved quantities.
        """
        # Determine valuation method
        valuation_method = request.valuationMethod or self.get_valuation_method(
            request.skuId, request.locationId, company_id
        )

        # Get available inventory
        available_inventory = self.get_available_inventory(
            request.skuId,
            request.locationId,
            valuation_method,
            request.preferredBinId
        )

        allocations: List[InventoryAllocationBrief] = []
        allocated_qty = 0
        remaining_qty = request.requiredQty

        for inventory in available_inventory:
            if remaining_qty <= 0:
                break

            available = inventory.quantity - inventory.reservedQty
            if available <= 0:
                continue

            # Determine how much to allocate from this inventory record
            qty_to_allocate = min(available, remaining_qty)

            # Create allocation record
            allocation = InventoryAllocation(
                allocationNo=self.generate_allocation_no(),
                orderId=request.orderId,
                orderItemId=request.orderItemId,
                waveId=request.waveId,
                picklistId=request.picklistId,
                picklistItemId=request.picklistItemId,
                skuId=request.skuId,
                inventoryId=inventory.id,
                binId=inventory.binId,
                batchNo=inventory.batchNo,
                lotNo=inventory.lotNo,
                allocatedQty=qty_to_allocate,
                valuationMethod=valuation_method,
                fifoSequence=inventory.fifoSequence,
                expiryDate=inventory.expiryDate,
                costPrice=inventory.costPrice,
                status="ALLOCATED",
                allocatedById=allocated_by_id,
                allocatedAt=datetime.utcnow(),
                locationId=request.locationId,
                companyId=company_id,
            )
            self.session.add(allocation)

            # Update reserved quantity on inventory
            inventory.reservedQty += qty_to_allocate
            self.session.add(inventory)

            # Track allocation
            allocated_qty += qty_to_allocate
            remaining_qty -= qty_to_allocate

            # Get bin code for response
            bin_obj = self.session.exec(
                select(Bin).where(Bin.id == inventory.binId)
            ).first()

            # Get SKU code for response
            sku_obj = self.session.exec(
                select(SKU).where(SKU.id == request.skuId)
            ).first()

            allocations.append(InventoryAllocationBrief(
                id=allocation.id,
                allocationNo=allocation.allocationNo,
                skuId=allocation.skuId,
                skuCode=sku_obj.code if sku_obj else None,
                binId=allocation.binId,
                binCode=bin_obj.code if bin_obj else None,
                allocatedQty=allocation.allocatedQty,
                pickedQty=0,
                status=allocation.status,
                valuationMethod=allocation.valuationMethod,
                fifoSequence=allocation.fifoSequence,
            ))

        # Commit changes
        self.session.commit()

        shortfall = request.requiredQty - allocated_qty
        return AllocationResult(
            success=shortfall == 0,
            skuId=request.skuId,
            requestedQty=request.requiredQty,
            allocatedQty=allocated_qty,
            shortfallQty=shortfall,
            allocations=allocations,
            message=None if shortfall == 0 else f"Shortfall of {shortfall} units"
        )

    def bulk_allocate(
        self,
        request: BulkAllocationRequest,
        company_id: UUID,
        allocated_by_id: Optional[UUID] = None
    ) -> BulkAllocationResult:
        """
        Allocate inventory for multiple SKUs at once.
        """
        results: List[AllocationResult] = []
        total_requested = 0
        total_allocated = 0

        for item in request.items:
            # Override location from bulk request
            item.locationId = request.locationId
            if request.orderId and not item.orderId:
                item.orderId = request.orderId
            if request.waveId and not item.waveId:
                item.waveId = request.waveId

            result = self.allocate_inventory(item, company_id, allocated_by_id)
            results.append(result)
            total_requested += result.requestedQty
            total_allocated += result.allocatedQty

        total_shortfall = total_requested - total_allocated
        return BulkAllocationResult(
            success=total_shortfall == 0,
            totalRequested=total_requested,
            totalAllocated=total_allocated,
            totalShortfall=total_shortfall,
            results=results,
            message=None if total_shortfall == 0 else f"Total shortfall of {total_shortfall} units"
        )

    def deallocate(
        self,
        allocation_id: UUID,
        cancelled_by_id: Optional[UUID] = None,
        reason: Optional[str] = None
    ) -> bool:
        """
        Deallocate (release) an allocation back to available inventory.
        """
        allocation = self.session.exec(
            select(InventoryAllocation).where(InventoryAllocation.id == allocation_id)
        ).first()

        if not allocation:
            return False

        if allocation.status == "CANCELLED":
            return False  # Already cancelled

        if allocation.status == "PICKED":
            return False  # Cannot deallocate picked inventory

        # Restore reserved quantity on inventory
        inventory = self.session.exec(
            select(Inventory).where(Inventory.id == allocation.inventoryId)
        ).first()

        if inventory:
            inventory.reservedQty = max(0, inventory.reservedQty - allocation.allocatedQty)
            self.session.add(inventory)

        # Update allocation status
        allocation.status = "CANCELLED"
        allocation.cancelledById = cancelled_by_id
        allocation.cancelledAt = datetime.utcnow()
        self.session.add(allocation)

        self.session.commit()
        return True

    def deallocate_by_order(
        self,
        order_id: UUID,
        cancelled_by_id: Optional[UUID] = None
    ) -> int:
        """
        Deallocate all allocations for an order.
        Returns number of allocations cancelled.
        """
        allocations = self.session.exec(
            select(InventoryAllocation)
            .where(InventoryAllocation.orderId == order_id)
            .where(InventoryAllocation.status == "ALLOCATED")
        ).all()

        cancelled_count = 0
        for allocation in allocations:
            if self.deallocate(allocation.id, cancelled_by_id):
                cancelled_count += 1

        return cancelled_count

    def deallocate_by_wave(
        self,
        wave_id: UUID,
        cancelled_by_id: Optional[UUID] = None
    ) -> int:
        """
        Deallocate all allocations for a wave.
        Returns number of allocations cancelled.
        """
        allocations = self.session.exec(
            select(InventoryAllocation)
            .where(InventoryAllocation.waveId == wave_id)
            .where(InventoryAllocation.status == "ALLOCATED")
        ).all()

        cancelled_count = 0
        for allocation in allocations:
            if self.deallocate(allocation.id, cancelled_by_id):
                cancelled_count += 1

        return cancelled_count

    def confirm_pick(
        self,
        allocation_id: UUID,
        picked_qty: int,
        picked_by_id: Optional[UUID] = None
    ) -> bool:
        """
        Confirm that inventory has been picked.
        Updates allocation status and reduces actual inventory.
        """
        allocation = self.session.exec(
            select(InventoryAllocation).where(InventoryAllocation.id == allocation_id)
        ).first()

        if not allocation:
            return False

        if allocation.status != "ALLOCATED":
            return False

        # Get inventory record
        inventory = self.session.exec(
            select(Inventory).where(Inventory.id == allocation.inventoryId)
        ).first()

        if not inventory:
            return False

        # Validate picked quantity
        if picked_qty > allocation.allocatedQty:
            picked_qty = allocation.allocatedQty

        # Update inventory - reduce quantity and reserved
        inventory.quantity -= picked_qty
        inventory.reservedQty = max(0, inventory.reservedQty - allocation.allocatedQty)
        self.session.add(inventory)

        # Update allocation
        allocation.pickedQty = picked_qty
        allocation.status = "PICKED"
        allocation.pickedById = picked_by_id
        allocation.pickedAt = datetime.utcnow()
        self.session.add(allocation)

        self.session.commit()
        return True

    def get_allocations_by_order(self, order_id: UUID) -> List[InventoryAllocation]:
        """Get all allocations for an order."""
        return list(self.session.exec(
            select(InventoryAllocation)
            .where(InventoryAllocation.orderId == order_id)
            .order_by(InventoryAllocation.allocatedAt)
        ).all())

    def get_allocations_by_wave(self, wave_id: UUID) -> List[InventoryAllocation]:
        """Get all allocations for a wave."""
        return list(self.session.exec(
            select(InventoryAllocation)
            .where(InventoryAllocation.waveId == wave_id)
            .order_by(InventoryAllocation.allocatedAt)
        ).all())

    def get_allocations_by_picklist(self, picklist_id: UUID) -> List[InventoryAllocation]:
        """Get all allocations for a picklist."""
        return list(self.session.exec(
            select(InventoryAllocation)
            .where(InventoryAllocation.picklistId == picklist_id)
            .order_by(InventoryAllocation.allocatedAt)
        ).all())

    def get_allocation_summary(
        self,
        location_id: Optional[UUID] = None,
        company_id: Optional[UUID] = None
    ) -> dict:
        """Get summary of current allocations."""
        query = select(
            func.count(InventoryAllocation.id).label("total"),
            func.sum(InventoryAllocation.allocatedQty).label("total_allocated_qty"),
        ).where(InventoryAllocation.status == "ALLOCATED")

        if location_id:
            query = query.where(InventoryAllocation.locationId == location_id)
        if company_id:
            query = query.where(InventoryAllocation.companyId == company_id)

        result = self.session.exec(query).first()

        return {
            "active_allocations": result[0] or 0,
            "total_allocated_qty": result[1] or 0,
        }

    def check_availability(
        self,
        sku_id: UUID,
        location_id: UUID,
        required_qty: int
    ) -> Tuple[int, int]:
        """
        Check inventory availability for a SKU.
        Returns (available_qty, total_qty).
        """
        result = self.session.exec(
            select(
                func.sum(Inventory.quantity).label("total"),
                func.sum(Inventory.reservedQty).label("reserved"),
            )
            .where(Inventory.skuId == sku_id)
            .where(Inventory.locationId == location_id)
        ).first()

        total_qty = result[0] or 0
        reserved_qty = result[1] or 0
        available_qty = total_qty - reserved_qty

        return (available_qty, total_qty)
