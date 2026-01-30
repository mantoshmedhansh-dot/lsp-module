"""
Marketplace Integration API Endpoints
"""
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select
from sqlalchemy import and_

from app.core.database import get_session
from app.models.marketplace import (
    MarketplaceConnection, MarketplaceListing, MarketplaceOrderSync,
    MarketplaceInventorySync, MarketplaceReturn, MarketplaceSettlement,
    MarketplaceType, ConnectionStatus, SyncStatus, ListingStatus, ReturnStatus,
    MarketplaceConnectionCreate, MarketplaceConnectionResponse,
    OAuthConnectRequest, OAuthConnectResponse,
    SyncOrdersRequest, SyncOrdersResponse,
    PushInventoryRequest, PushInventoryResponse,
    ListingResponse, UpdateListingRequest, MarketplaceReturnResponse
)
from app.services.marketplace import marketplace_registry

router = APIRouter()


# ==================== Connection Management ====================

@router.post("", response_model=MarketplaceConnectionResponse)
async def create_connection(
    connection: MarketplaceConnectionCreate,
    db: Session = Depends(get_session)
):
    """Create a new marketplace connection."""
    new_connection = MarketplaceConnection(**connection.model_dump())
    db.add(new_connection)
    db.commit()
    db.refresh(new_connection)
    return new_connection


@router.get("", response_model=List[MarketplaceConnectionResponse])
async def list_connections(
    marketplace: Optional[MarketplaceType] = None,
    status: Optional[ConnectionStatus] = None,
    warehouse_id: Optional[UUID] = None,
    db: Session = Depends(get_session)
):
    """List marketplace connections."""
    stmt = select(MarketplaceConnection)
    if marketplace:
        stmt = stmt.where(MarketplaceConnection.marketplace == marketplace)
    if status:
        stmt = stmt.where(MarketplaceConnection.status == status)
    if warehouse_id:
        stmt = stmt.where(MarketplaceConnection.warehouseId == warehouse_id)
    stmt = stmt.order_by(MarketplaceConnection.createdAt.desc())
    return db.exec(stmt).all()


@router.get("/{connection_id}", response_model=MarketplaceConnectionResponse)
async def get_connection(
    connection_id: UUID,
    db: Session = Depends(get_session)
):
    """Get connection details."""
    stmt = select(MarketplaceConnection).where(MarketplaceConnection.id == connection_id)
    connection = db.exec(stmt).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    return connection


@router.delete("/{connection_id}")
async def delete_connection(
    connection_id: UUID,
    db: Session = Depends(get_session)
):
    """Delete a marketplace connection."""
    stmt = select(MarketplaceConnection).where(MarketplaceConnection.id == connection_id)
    connection = db.exec(stmt).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    connection.status = ConnectionStatus.DISCONNECTED
    db.add(connection)
    db.commit()
    return {"message": "Connection deleted"}


# ==================== OAuth ====================

@router.post("/{connection_id}/connect", response_model=OAuthConnectResponse)
async def initiate_oauth(
    connection_id: UUID,
    request: OAuthConnectRequest,
    db: Session = Depends(get_session)
):
    """Initiate OAuth flow for marketplace."""
    stmt = select(MarketplaceConnection).where(MarketplaceConnection.id == connection_id)
    connection = db.exec(stmt).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    adapter = marketplace_registry.get_adapter(connection)
    import uuid
    state = str(uuid.uuid4())
    auth_url = await adapter.get_authorization_url(request.redirectUri, state)

    return OAuthConnectResponse(authorizationUrl=auth_url, state=state)


@router.post("/{connection_id}/callback")
async def oauth_callback(
    connection_id: UUID,
    code: str = Query(...),
    redirect_uri: str = Query(...),
    db: Session = Depends(get_session)
):
    """Handle OAuth callback."""
    stmt = select(MarketplaceConnection).where(MarketplaceConnection.id == connection_id)
    connection = db.exec(stmt).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    adapter = marketplace_registry.get_adapter(connection)
    tokens = await adapter.exchange_code(code, redirect_uri)

    connection.accessToken = tokens.get("access_token")
    connection.refreshToken = tokens.get("refresh_token")
    connection.status = ConnectionStatus.CONNECTED
    db.add(connection)
    db.commit()

    return {"message": "Connection authorized"}


# ==================== Order Sync ====================

@router.post("/{connection_id}/sync-orders", response_model=SyncOrdersResponse)
async def sync_orders(
    connection_id: UUID,
    request: SyncOrdersRequest,
    db: Session = Depends(get_session)
):
    """Sync orders from marketplace."""
    stmt = select(MarketplaceConnection).where(MarketplaceConnection.id == connection_id)
    connection = db.exec(stmt).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    adapter = marketplace_registry.get_adapter(connection)
    orders = await adapter.fetch_orders(
        start_date=request.startDate,
        end_date=request.endDate,
        order_ids=request.orderIds
    )

    synced = 0
    failed = 0

    for order in orders:
        try:
            order_sync = MarketplaceOrderSync(
                connectionId=connection.id,
                marketplace=connection.marketplace,
                marketplaceOrderId=order.get("orderId") or order.get("AmazonOrderId"),
                syncStatus=SyncStatus.COMPLETED,
                syncDirection="INBOUND",
                orderDate=datetime.now(timezone.utc),
                orderAmount=float(order.get("orderTotal", {}).get("Amount", 0) or order.get("priceDetails", {}).get("totalPrice", 0)),
                syncedAt=datetime.now(timezone.utc),
                rawData=order
            )
            db.add(order_sync)
            synced += 1
        except Exception:
            failed += 1

    connection.lastSyncAt = datetime.now(timezone.utc)
    db.add(connection)
    db.commit()

    return SyncOrdersResponse(
        connectionId=connection_id,
        marketplace=connection.marketplace,
        totalOrders=len(orders),
        synced=synced,
        failed=failed,
        syncedAt=datetime.now(timezone.utc)
    )


# ==================== Inventory Sync ====================

@router.post("/{connection_id}/push-inventory", response_model=PushInventoryResponse)
async def push_inventory(
    connection_id: UUID,
    request: PushInventoryRequest,
    db: Session = Depends(get_session)
):
    """Push inventory to marketplace."""
    stmt = select(MarketplaceConnection).where(MarketplaceConnection.id == connection_id)
    connection = db.exec(stmt).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    # Get listings to push
    listings_stmt = select(MarketplaceListing).where(
        MarketplaceListing.connectionId == connection_id
    )
    if request.skus:
        listings_stmt = listings_stmt.where(MarketplaceListing.sku.in_(request.skus))
    listings = db.exec(listings_stmt).all()

    adapter = marketplace_registry.get_adapter(connection)
    result = await adapter.push_inventory([
        {"sku": l.marketplaceSku or l.sku, "quantity": l.quantity}
        for l in listings
    ])

    # Log sync
    for listing in listings:
        inv_sync = MarketplaceInventorySync(
            connectionId=connection.id,
            listingId=listing.id,
            marketplace=connection.marketplace,
            sku=listing.sku,
            previousQuantity=listing.quantity,
            newQuantity=listing.quantity,
            syncStatus=SyncStatus.COMPLETED,
            syncedAt=datetime.now(timezone.utc)
        )
        db.add(inv_sync)

    db.commit()

    return PushInventoryResponse(
        connectionId=connection_id,
        marketplace=connection.marketplace,
        totalListings=len(listings),
        updated=result.get("accepted", len(listings)),
        failed=result.get("failed", 0) if isinstance(result.get("failed"), int) else len(result.get("errors", [])),
        syncedAt=datetime.now(timezone.utc)
    )


# ==================== Listings ====================

@router.get("/{connection_id}/listings", response_model=List[ListingResponse])
async def list_listings(
    connection_id: UUID,
    status: Optional[ListingStatus] = None,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_session)
):
    """Get product listings."""
    stmt = select(MarketplaceListing).where(
        MarketplaceListing.connectionId == connection_id
    )
    if status:
        stmt = stmt.where(MarketplaceListing.status == status)
    stmt = stmt.limit(limit)
    return db.exec(stmt).all()


@router.post("/{connection_id}/update-listing")
async def update_listing(
    connection_id: UUID,
    listing_id: UUID = Query(...),
    request: UpdateListingRequest = None,
    db: Session = Depends(get_session)
):
    """Update a product listing."""
    stmt = select(MarketplaceListing).where(
        and_(
            MarketplaceListing.id == listing_id,
            MarketplaceListing.connectionId == connection_id
        )
    )
    listing = db.exec(stmt).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if request:
        if request.price is not None:
            listing.price = request.price
        if request.salePrice is not None:
            listing.salePrice = request.salePrice
        if request.quantity is not None:
            listing.quantity = request.quantity
        if request.status is not None:
            listing.status = request.status

    db.add(listing)
    db.commit()

    return {"message": "Listing updated"}


# ==================== Returns ====================

@router.get("/{connection_id}/returns", response_model=List[MarketplaceReturnResponse])
async def list_returns(
    connection_id: UUID,
    status: Optional[ReturnStatus] = None,
    start_date: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_session)
):
    """Get marketplace returns."""
    stmt = select(MarketplaceReturn).where(
        MarketplaceReturn.connectionId == connection_id
    )
    if status:
        stmt = stmt.where(MarketplaceReturn.status == status)
    if start_date:
        stmt = stmt.where(MarketplaceReturn.initiatedDate >= start_date)
    stmt = stmt.order_by(MarketplaceReturn.initiatedDate.desc()).limit(limit)
    return db.exec(stmt).all()


@router.post("/{connection_id}/sync-returns")
async def sync_returns(
    connection_id: UUID,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_session)
):
    """Sync returns from marketplace."""
    stmt = select(MarketplaceConnection).where(MarketplaceConnection.id == connection_id)
    connection = db.exec(stmt).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    adapter = marketplace_registry.get_adapter(connection)
    returns = await adapter.fetch_returns(start_date=start_date, end_date=end_date)

    synced = 0
    for ret in returns:
        mp_return = MarketplaceReturn(
            connectionId=connection.id,
            marketplace=connection.marketplace,
            marketplaceReturnId=ret.get("returnId", ""),
            marketplaceOrderId=ret.get("orderId", ""),
            status=ReturnStatus.INITIATED,
            initiatedDate=datetime.now(timezone.utc),
            syncStatus=SyncStatus.COMPLETED,
            rawData=ret
        )
        db.add(mp_return)
        synced += 1

    db.commit()
    return {"message": f"Synced {synced} returns"}


# ==================== Settlements ====================

@router.post("/{connection_id}/import-settlement")
async def import_marketplace_settlement(
    connection_id: UUID,
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    db: Session = Depends(get_session)
):
    """Import settlement from marketplace."""
    stmt = select(MarketplaceConnection).where(MarketplaceConnection.id == connection_id)
    connection = db.exec(stmt).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    adapter = marketplace_registry.get_adapter(connection)
    settlements = await adapter.fetch_settlements(start_date=start_date, end_date=end_date)

    imported = 0
    for stl in settlements:
        mp_settlement = MarketplaceSettlement(
            connectionId=connection.id,
            marketplace=connection.marketplace,
            settlementId=stl.get("settlementId", ""),
            settlementDate=datetime.now(timezone.utc),
            periodStart=start_date,
            periodEnd=end_date,
            totalAmount=stl.get("totalAmount", 0) or stl.get("netPayable", 0),
            syncStatus=SyncStatus.COMPLETED,
            importedAt=datetime.now(timezone.utc),
            rawData=stl
        )
        db.add(mp_settlement)
        imported += 1

    db.commit()
    return {"message": f"Imported {imported} settlements"}
