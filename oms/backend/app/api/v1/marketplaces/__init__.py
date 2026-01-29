"""
Marketplace Integrations API v1 - Multi-marketplace management
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    User,
    MarketplaceConnection, MarketplaceConnectionCreate, MarketplaceConnectionUpdate, MarketplaceConnectionResponse,
    MarketplaceListing, MarketplaceListingCreate, MarketplaceListingResponse,
    MarketplaceOrderSync, MarketplaceOrderSyncResponse,
    MarketplaceInventorySync, MarketplaceInventorySyncResponse,
    MarketplaceReturn, MarketplaceReturnResponse,
    MarketplaceSettlement, MarketplaceSettlementResponse,
    MarketplaceType, ConnectionStatus, ListingStatus, MarketplaceReturnStatus,
)


router = APIRouter(prefix="/marketplaces", tags=["Marketplaces"])


# ============================================================================
# Marketplace Connections
# ============================================================================

@router.get("", response_model=List[MarketplaceConnectionResponse])
def list_marketplace_connections(
    marketplace: Optional[MarketplaceType] = None,
    status: Optional[ConnectionStatus] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List marketplace connections"""
    query = select(MarketplaceConnection)

    if company_filter.company_id:
        query = query.where(MarketplaceConnection.companyId == company_filter.company_id)
    if marketplace:
        query = query.where(MarketplaceConnection.marketplace == marketplace)
    if status:
        query = query.where(MarketplaceConnection.status == status)

    connections = session.exec(query).all()
    return connections


@router.post("", response_model=MarketplaceConnectionResponse, status_code=status.HTTP_201_CREATED)
def create_marketplace_connection(
    data: MarketplaceConnectionCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Create a marketplace connection"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Check if connection already exists
    existing = session.exec(
        select(MarketplaceConnection)
        .where(MarketplaceConnection.companyId == company_filter.company_id)
        .where(MarketplaceConnection.marketplace == data.marketplace)
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Connection already exists for this marketplace")

    from uuid import uuid4
    connection = MarketplaceConnection(
        id=uuid4(),
        companyId=company_filter.company_id,
        status=ConnectionStatus.PENDING,
        createdById=current_user.id,
        **data.model_dump()
    )
    session.add(connection)
    session.commit()
    session.refresh(connection)
    return connection


@router.get("/{connection_id}", response_model=MarketplaceConnectionResponse)
def get_marketplace_connection(
    connection_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific marketplace connection"""
    query = select(MarketplaceConnection).where(MarketplaceConnection.id == connection_id)
    if company_filter.company_id:
        query = query.where(MarketplaceConnection.companyId == company_filter.company_id)

    connection = session.exec(query).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    return connection


@router.patch("/{connection_id}", response_model=MarketplaceConnectionResponse)
def update_marketplace_connection(
    connection_id: UUID,
    data: MarketplaceConnectionUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Update a marketplace connection"""
    query = select(MarketplaceConnection).where(MarketplaceConnection.id == connection_id)
    if company_filter.company_id:
        query = query.where(MarketplaceConnection.companyId == company_filter.company_id)

    connection = session.exec(query).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(connection, key, value)

    connection.updatedAt = datetime.utcnow()
    session.add(connection)
    session.commit()
    session.refresh(connection)
    return connection


@router.delete("/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_marketplace_connection(
    connection_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Disconnect a marketplace"""
    query = select(MarketplaceConnection).where(MarketplaceConnection.id == connection_id)
    if company_filter.company_id:
        query = query.where(MarketplaceConnection.companyId == company_filter.company_id)

    connection = session.exec(query).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    connection.status = ConnectionStatus.DISCONNECTED
    connection.disconnectedAt = datetime.utcnow()
    connection.updatedAt = datetime.utcnow()
    session.add(connection)
    session.commit()


# ============================================================================
# OAuth / Connect
# ============================================================================

@router.post("/{connection_id}/connect")
def initiate_oauth_connection(
    connection_id: UUID,
    redirect_uri: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Initiate OAuth connection flow"""
    connection = session.exec(
        select(MarketplaceConnection).where(MarketplaceConnection.id == connection_id)
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    # Generate OAuth URL based on marketplace
    oauth_url = f"https://{connection.marketplace.value.lower()}.example.com/oauth/authorize"

    return {
        "success": True,
        "oauthUrl": oauth_url,
        "marketplace": connection.marketplace.value,
        "message": "Redirect user to OAuth URL"
    }


@router.post("/{connection_id}/callback")
def handle_oauth_callback(
    connection_id: UUID,
    code: str,
    state: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Handle OAuth callback"""
    connection = session.exec(
        select(MarketplaceConnection).where(MarketplaceConnection.id == connection_id)
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    # Exchange code for tokens (placeholder)
    connection.status = ConnectionStatus.ACTIVE
    connection.lastSyncAt = datetime.utcnow()
    connection.updatedAt = datetime.utcnow()
    session.add(connection)
    session.commit()

    return {"success": True, "message": "Marketplace connected successfully"}


# ============================================================================
# Order Sync
# ============================================================================

@router.post("/{connection_id}/sync-orders")
def sync_marketplace_orders(
    connection_id: UUID,
    from_date: Optional[datetime] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Sync orders from marketplace"""
    from uuid import uuid4

    connection = session.exec(
        select(MarketplaceConnection).where(MarketplaceConnection.id == connection_id)
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    if connection.status != ConnectionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Marketplace not connected")

    # Create sync record
    sync = MarketplaceOrderSync(
        id=uuid4(),
        companyId=connection.companyId,
        connectionId=connection_id,
        syncStartedAt=datetime.utcnow(),
        syncType="ORDERS",
        status="IN_PROGRESS"
    )
    session.add(sync)

    # Placeholder sync logic
    sync.syncCompletedAt = datetime.utcnow()
    sync.status = "COMPLETED"
    sync.ordersFound = 0
    sync.ordersCreated = 0
    sync.ordersUpdated = 0
    session.add(sync)

    connection.lastSyncAt = datetime.utcnow()
    session.add(connection)

    session.commit()

    return {
        "success": True,
        "syncId": str(sync.id),
        "ordersFound": sync.ordersFound,
        "ordersCreated": sync.ordersCreated,
        "ordersUpdated": sync.ordersUpdated
    }


@router.get("/{connection_id}/order-syncs", response_model=List[MarketplaceOrderSyncResponse])
def list_order_syncs(
    connection_id: UUID,
    limit: int = Query(20, ge=1, le=100),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List order sync history"""
    syncs = session.exec(
        select(MarketplaceOrderSync)
        .where(MarketplaceOrderSync.connectionId == connection_id)
        .order_by(MarketplaceOrderSync.syncStartedAt.desc())
        .limit(limit)
    ).all()
    return syncs


# ============================================================================
# Inventory Push
# ============================================================================

@router.post("/{connection_id}/push-inventory")
def push_inventory_to_marketplace(
    connection_id: UUID,
    sku_ids: Optional[List[UUID]] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Push inventory levels to marketplace"""
    from uuid import uuid4

    connection = session.exec(
        select(MarketplaceConnection).where(MarketplaceConnection.id == connection_id)
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    if connection.status != ConnectionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Marketplace not connected")

    # Create sync record
    sync = MarketplaceInventorySync(
        id=uuid4(),
        companyId=connection.companyId,
        connectionId=connection_id,
        syncStartedAt=datetime.utcnow(),
        status="IN_PROGRESS"
    )
    session.add(sync)

    # Placeholder push logic
    sync.syncCompletedAt = datetime.utcnow()
    sync.status = "COMPLETED"
    sync.skusPushed = len(sku_ids) if sku_ids else 0
    sync.successCount = sync.skusPushed
    sync.failureCount = 0
    session.add(sync)
    session.commit()

    return {
        "success": True,
        "syncId": str(sync.id),
        "skusPushed": sync.skusPushed
    }


@router.get("/{connection_id}/inventory-syncs", response_model=List[MarketplaceInventorySyncResponse])
def list_inventory_syncs(
    connection_id: UUID,
    limit: int = Query(20, ge=1, le=100),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List inventory sync history"""
    syncs = session.exec(
        select(MarketplaceInventorySync)
        .where(MarketplaceInventorySync.connectionId == connection_id)
        .order_by(MarketplaceInventorySync.syncStartedAt.desc())
        .limit(limit)
    ).all()
    return syncs


# ============================================================================
# Listings
# ============================================================================

@router.get("/{connection_id}/listings", response_model=List[MarketplaceListingResponse])
def list_marketplace_listings(
    connection_id: UUID,
    status: Optional[ListingStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List product listings for a marketplace"""
    query = select(MarketplaceListing).where(MarketplaceListing.connectionId == connection_id)

    if status:
        query = query.where(MarketplaceListing.status == status)

    query = query.offset(skip).limit(limit)
    listings = session.exec(query).all()
    return listings


@router.post("/{connection_id}/listings", response_model=MarketplaceListingResponse, status_code=status.HTTP_201_CREATED)
def create_listing(
    connection_id: UUID,
    data: MarketplaceListingCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a product listing"""
    connection = session.exec(
        select(MarketplaceConnection).where(MarketplaceConnection.id == connection_id)
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    from uuid import uuid4
    listing = MarketplaceListing(
        id=uuid4(),
        companyId=connection.companyId,
        connectionId=connection_id,
        status=ListingStatus.DRAFT,
        **data.model_dump()
    )
    session.add(listing)
    session.commit()
    session.refresh(listing)
    return listing


@router.post("/{connection_id}/update-listing/{listing_id}")
def update_marketplace_listing(
    connection_id: UUID,
    listing_id: UUID,
    price: Optional[float] = None,
    quantity: Optional[int] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a listing on marketplace"""
    listing = session.exec(
        select(MarketplaceListing)
        .where(MarketplaceListing.id == listing_id)
        .where(MarketplaceListing.connectionId == connection_id)
    ).first()

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if price is not None:
        listing.price = price
    if quantity is not None:
        listing.quantity = quantity

    listing.updatedAt = datetime.utcnow()
    session.add(listing)
    session.commit()

    return {"success": True, "message": "Listing updated"}


@router.post("/{connection_id}/listings/{listing_id}/publish")
def publish_listing(
    connection_id: UUID,
    listing_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Publish a listing to marketplace"""
    listing = session.exec(
        select(MarketplaceListing)
        .where(MarketplaceListing.id == listing_id)
        .where(MarketplaceListing.connectionId == connection_id)
    ).first()

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if listing.status != ListingStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only draft listings can be published")

    listing.status = ListingStatus.ACTIVE
    listing.publishedAt = datetime.utcnow()
    listing.updatedAt = datetime.utcnow()
    session.add(listing)
    session.commit()

    return {"success": True, "message": "Listing published"}


# ============================================================================
# Returns
# ============================================================================

@router.get("/{connection_id}/returns", response_model=List[MarketplaceReturnResponse])
def list_marketplace_returns(
    connection_id: UUID,
    status: Optional[MarketplaceReturnStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List returns from marketplace"""
    query = select(MarketplaceReturn).where(MarketplaceReturn.connectionId == connection_id)

    if status:
        query = query.where(MarketplaceReturn.status == status)

    query = query.order_by(MarketplaceReturn.createdAt.desc()).offset(skip).limit(limit)
    returns = session.exec(query).all()
    return returns


@router.post("/{connection_id}/sync-returns")
def sync_marketplace_returns(
    connection_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Sync returns from marketplace"""
    connection = session.exec(
        select(MarketplaceConnection).where(MarketplaceConnection.id == connection_id)
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    if connection.status != ConnectionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Marketplace not connected")

    # Placeholder sync logic
    return {
        "success": True,
        "message": "Returns sync initiated",
        "returnsFound": 0
    }


# ============================================================================
# Settlements
# ============================================================================

@router.get("/{connection_id}/settlements", response_model=List[MarketplaceSettlementResponse])
def list_marketplace_settlements(
    connection_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List settlements from marketplace"""
    settlements = session.exec(
        select(MarketplaceSettlement)
        .where(MarketplaceSettlement.connectionId == connection_id)
        .order_by(MarketplaceSettlement.settlementDate.desc())
        .offset(skip).limit(limit)
    ).all()
    return settlements


@router.post("/{connection_id}/import-settlement")
def import_marketplace_settlement(
    connection_id: UUID,
    settlement_id: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Import settlement from marketplace"""
    connection = session.exec(
        select(MarketplaceConnection).where(MarketplaceConnection.id == connection_id)
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    if connection.status != ConnectionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Marketplace not connected")

    # Placeholder import logic
    return {
        "success": True,
        "message": "Settlement import initiated",
        "settlementId": settlement_id
    }


# ============================================================================
# Dashboard
# ============================================================================

@router.get("/dashboard")
def get_marketplaces_dashboard(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get marketplace connections dashboard"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Connection counts by status
    status_counts = {}
    for s in ConnectionStatus:
        count = session.exec(
            select(func.count(MarketplaceConnection.id))
            .where(MarketplaceConnection.companyId == company_filter.company_id)
            .where(MarketplaceConnection.status == s)
        ).one()
        status_counts[s.value] = count

    # Connection counts by marketplace
    marketplace_counts = {}
    for m in MarketplaceType:
        count = session.exec(
            select(func.count(MarketplaceConnection.id))
            .where(MarketplaceConnection.companyId == company_filter.company_id)
            .where(MarketplaceConnection.marketplace == m)
            .where(MarketplaceConnection.status == ConnectionStatus.ACTIVE)
        ).one()
        if count > 0:
            marketplace_counts[m.value] = count

    # Recent syncs
    recent_syncs = session.exec(
        select(MarketplaceOrderSync)
        .where(MarketplaceOrderSync.companyId == company_filter.company_id)
        .order_by(MarketplaceOrderSync.syncStartedAt.desc())
        .limit(5)
    ).all()

    return {
        "connectionsByStatus": status_counts,
        "activeMarketplaces": marketplace_counts,
        "recentSyncs": [
            {
                "id": str(s.id),
                "type": s.syncType,
                "status": s.status,
                "startedAt": s.syncStartedAt.isoformat() if s.syncStartedAt else None
            }
            for s in recent_syncs
        ]
    }
