"""
SKU Mappings API v1 - Marketplace SKU mapping management
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    User,
    SKU,
    MarketplaceConnection,
    MarketplaceSkuMapping,
    MarketplaceSkuMappingCreate,
    MarketplaceSkuMappingUpdate,
    MarketplaceSkuMappingResponse,
    MarketplaceSkuMappingBulkCreate,
    MarketplaceSkuMappingBulkResponse,
    SkuMappingStatus,
)


router = APIRouter(prefix="/sku-mappings", tags=["SKU Mappings"])


# ============================================================================
# List and Search Mappings
# ============================================================================

@router.get("", response_model=List[MarketplaceSkuMappingResponse])
def list_sku_mappings(
    channel: Optional[str] = None,
    sku_id: Optional[UUID] = None,
    connection_id: Optional[UUID] = None,
    status: Optional[SkuMappingStatus] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List SKU mappings with filters"""
    query = select(MarketplaceSkuMapping)

    query = company_filter.apply_filter(query, MarketplaceSkuMapping.companyId)

    if channel:
        query = query.where(MarketplaceSkuMapping.channel == channel.upper())

    if sku_id:
        query = query.where(MarketplaceSkuMapping.skuId == sku_id)

    if connection_id:
        query = query.where(MarketplaceSkuMapping.connectionId == connection_id)

    if status:
        query = query.where(MarketplaceSkuMapping.listingStatus == status)

    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (MarketplaceSkuMapping.marketplaceSku.ilike(search_pattern)) |
            (MarketplaceSkuMapping.marketplaceSkuName.ilike(search_pattern))
        )

    query = query.order_by(MarketplaceSkuMapping.createdAt.desc())
    query = query.offset(skip).limit(limit)

    mappings = session.exec(query).all()
    return mappings


@router.get("/summary")
def get_mapping_summary(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get SKU mapping summary statistics"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Total mappings
    total = session.exec(
        select(func.count(MarketplaceSkuMapping.id))
        .where(MarketplaceSkuMapping.companyId == company_filter.company_id)
    ).one()

    # Active mappings
    active = session.exec(
        select(func.count(MarketplaceSkuMapping.id))
        .where(MarketplaceSkuMapping.companyId == company_filter.company_id)
        .where(MarketplaceSkuMapping.listingStatus == SkuMappingStatus.ACTIVE)
    ).one()

    # Mappings by channel
    by_channel = {}
    channels = session.exec(
        select(MarketplaceSkuMapping.channel, func.count(MarketplaceSkuMapping.id))
        .where(MarketplaceSkuMapping.companyId == company_filter.company_id)
        .group_by(MarketplaceSkuMapping.channel)
    ).all()

    for channel, count in channels:
        by_channel[channel] = count

    # Unmapped SKUs count
    total_skus = session.exec(
        select(func.count(SKU.id))
        .where(SKU.companyId == company_filter.company_id)
        .where(SKU.isActive == True)
    ).one()

    mapped_sku_ids = session.exec(
        select(MarketplaceSkuMapping.skuId)
        .where(MarketplaceSkuMapping.companyId == company_filter.company_id)
        .distinct()
    ).all()

    unmapped = total_skus - len(set(mapped_sku_ids))

    return {
        "totalMappings": total,
        "activeMappings": active,
        "unmappedSkus": max(0, unmapped),
        "byChannel": by_channel
    }


@router.get("/unmapped")
def get_unmapped_skus(
    channel: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get SKUs without marketplace mappings"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Get all SKU IDs that have mappings
    mapped_query = select(MarketplaceSkuMapping.skuId).where(
        MarketplaceSkuMapping.companyId == company_filter.company_id
    )

    if channel:
        mapped_query = mapped_query.where(MarketplaceSkuMapping.channel == channel.upper())

    mapped_sku_ids = set(session.exec(mapped_query).all())

    # Get SKUs without mappings
    query = select(SKU).where(
        SKU.companyId == company_filter.company_id,
        SKU.isActive == True,
        SKU.id.notin_(mapped_sku_ids) if mapped_sku_ids else True
    ).offset(skip).limit(limit)

    unmapped_skus = session.exec(query).all()

    return [
        {
            "skuId": str(sku.id),
            "skuCode": sku.skuCode,
            "skuName": sku.name,
            "category": sku.category,
        }
        for sku in unmapped_skus
    ]


# ============================================================================
# CRUD Operations
# ============================================================================

@router.post("", response_model=MarketplaceSkuMappingResponse, status_code=status.HTTP_201_CREATED)
def create_sku_mapping(
    data: MarketplaceSkuMappingCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Create a new SKU mapping"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Verify SKU exists
    sku = session.exec(
        select(SKU)
        .where(SKU.id == data.skuId)
        .where(SKU.companyId == company_filter.company_id)
    ).first()

    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")

    # Check for duplicate mapping
    existing = session.exec(
        select(MarketplaceSkuMapping)
        .where(MarketplaceSkuMapping.companyId == company_filter.company_id)
        .where(MarketplaceSkuMapping.channel == data.channel.upper())
        .where(MarketplaceSkuMapping.marketplaceSku == data.marketplaceSku)
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Mapping already exists for {data.channel}/{data.marketplaceSku}"
        )

    # Verify connection if provided
    if data.connectionId:
        connection = session.exec(
            select(MarketplaceConnection)
            .where(MarketplaceConnection.id == data.connectionId)
            .where(MarketplaceConnection.companyId == company_filter.company_id)
        ).first()

        if not connection:
            raise HTTPException(status_code=404, detail="Marketplace connection not found")

    from uuid import uuid4

    mapping = MarketplaceSkuMapping(
        id=uuid4(),
        companyId=company_filter.company_id,
        channel=data.channel.upper(),
        **data.model_dump(exclude={"channel"})
    )

    session.add(mapping)
    session.commit()
    session.refresh(mapping)

    return mapping


@router.get("/{mapping_id}", response_model=MarketplaceSkuMappingResponse)
def get_sku_mapping(
    mapping_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific SKU mapping"""
    query = select(MarketplaceSkuMapping).where(MarketplaceSkuMapping.id == mapping_id)

    query = company_filter.apply_filter(query, MarketplaceSkuMapping.companyId)

    mapping = session.exec(query).first()

    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")

    return mapping


@router.patch("/{mapping_id}", response_model=MarketplaceSkuMappingResponse)
def update_sku_mapping(
    mapping_id: UUID,
    data: MarketplaceSkuMappingUpdate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Update a SKU mapping"""
    query = select(MarketplaceSkuMapping).where(MarketplaceSkuMapping.id == mapping_id)

    query = company_filter.apply_filter(query, MarketplaceSkuMapping.companyId)

    mapping = session.exec(query).first()

    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")

    # Check for duplicate if changing marketplace SKU
    if data.marketplaceSku and data.marketplaceSku != mapping.marketplaceSku:
        existing = session.exec(
            select(MarketplaceSkuMapping)
            .where(MarketplaceSkuMapping.companyId == mapping.companyId)
            .where(MarketplaceSkuMapping.channel == mapping.channel)
            .where(MarketplaceSkuMapping.marketplaceSku == data.marketplaceSku)
            .where(MarketplaceSkuMapping.id != mapping_id)
        ).first()

        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Mapping already exists for {mapping.channel}/{data.marketplaceSku}"
            )

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(mapping, key, value)

    mapping.updatedAt = datetime.utcnow()
    session.add(mapping)
    session.commit()
    session.refresh(mapping)

    return mapping


@router.delete("/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sku_mapping(
    mapping_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Delete a SKU mapping"""
    query = select(MarketplaceSkuMapping).where(MarketplaceSkuMapping.id == mapping_id)

    query = company_filter.apply_filter(query, MarketplaceSkuMapping.companyId)

    mapping = session.exec(query).first()

    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")

    session.delete(mapping)
    session.commit()


# ============================================================================
# Bulk Operations
# ============================================================================

@router.post("/bulk", response_model=MarketplaceSkuMappingBulkResponse)
def bulk_create_sku_mappings(
    data: MarketplaceSkuMappingBulkCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Bulk create/update SKU mappings"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    created = 0
    updated = 0
    failed = 0
    errors = []

    from uuid import uuid4

    for item in data.mappings:
        try:
            # Verify SKU exists
            sku = session.exec(
                select(SKU)
                .where(SKU.id == item.skuId)
                .where(SKU.companyId == company_filter.company_id)
            ).first()

            if not sku:
                failed += 1
                errors.append({
                    "skuId": str(item.skuId),
                    "marketplaceSku": item.marketplaceSku,
                    "error": "SKU not found"
                })
                continue

            # Check for existing mapping
            existing = session.exec(
                select(MarketplaceSkuMapping)
                .where(MarketplaceSkuMapping.companyId == company_filter.company_id)
                .where(MarketplaceSkuMapping.channel == item.channel.upper())
                .where(MarketplaceSkuMapping.marketplaceSku == item.marketplaceSku)
            ).first()

            if existing:
                # Update existing
                existing.skuId = item.skuId
                existing.marketplaceSkuName = item.marketplaceSkuName
                existing.marketplaceListingId = item.marketplaceListingId
                existing.price = item.price
                existing.mrp = item.mrp
                existing.syncEnabled = item.syncEnabled
                existing.updatedAt = datetime.utcnow()
                session.add(existing)
                updated += 1
            else:
                # Create new
                mapping = MarketplaceSkuMapping(
                    id=uuid4(),
                    companyId=company_filter.company_id,
                    channel=item.channel.upper(),
                    **item.model_dump(exclude={"channel"})
                )
                session.add(mapping)
                created += 1

        except Exception as e:
            failed += 1
            errors.append({
                "skuId": str(item.skuId),
                "marketplaceSku": item.marketplaceSku,
                "error": str(e)
            })

    session.commit()

    return MarketplaceSkuMappingBulkResponse(
        created=created,
        updated=updated,
        failed=failed,
        errors=errors
    )


@router.post("/bulk/upload")
async def upload_sku_mappings(
    file: UploadFile = File(...),
    channel: str = Query(..., description="Channel for all mappings"),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Upload SKU mappings from CSV file"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    import csv
    from io import StringIO

    content = await file.read()
    text_content = content.decode('utf-8')
    reader = csv.DictReader(StringIO(text_content))

    created = 0
    updated = 0
    failed = 0
    errors = []

    from uuid import uuid4

    required_columns = {'sku_code', 'marketplace_sku'}
    if not required_columns.issubset(set(reader.fieldnames or [])):
        raise HTTPException(
            status_code=400,
            detail=f"CSV must contain columns: {required_columns}"
        )

    for row_num, row in enumerate(reader, start=2):
        try:
            sku_code = row.get('sku_code', '').strip()
            marketplace_sku = row.get('marketplace_sku', '').strip()

            if not sku_code or not marketplace_sku:
                failed += 1
                errors.append({
                    "row": row_num,
                    "error": "Missing required fields"
                })
                continue

            # Find SKU by code
            sku = session.exec(
                select(SKU)
                .where(SKU.skuCode == sku_code)
                .where(SKU.companyId == company_filter.company_id)
            ).first()

            if not sku:
                failed += 1
                errors.append({
                    "row": row_num,
                    "skuCode": sku_code,
                    "error": "SKU not found"
                })
                continue

            # Check for existing
            existing = session.exec(
                select(MarketplaceSkuMapping)
                .where(MarketplaceSkuMapping.companyId == company_filter.company_id)
                .where(MarketplaceSkuMapping.channel == channel.upper())
                .where(MarketplaceSkuMapping.marketplaceSku == marketplace_sku)
            ).first()

            if existing:
                existing.skuId = sku.id
                existing.marketplaceSkuName = row.get('marketplace_sku_name', '').strip() or None
                existing.updatedAt = datetime.utcnow()
                session.add(existing)
                updated += 1
            else:
                mapping = MarketplaceSkuMapping(
                    id=uuid4(),
                    companyId=company_filter.company_id,
                    skuId=sku.id,
                    channel=channel.upper(),
                    marketplaceSku=marketplace_sku,
                    marketplaceSkuName=row.get('marketplace_sku_name', '').strip() or None,
                )
                session.add(mapping)
                created += 1

        except Exception as e:
            failed += 1
            errors.append({
                "row": row_num,
                "error": str(e)
            })

    session.commit()

    return {
        "success": True,
        "created": created,
        "updated": updated,
        "failed": failed,
        "errors": errors[:50]  # Limit errors returned
    }


# ============================================================================
# Lookup by Marketplace SKU
# ============================================================================

@router.get("/lookup/{channel}/{marketplace_sku}")
def lookup_sku_mapping(
    channel: str,
    marketplace_sku: str,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Lookup internal SKU by marketplace SKU"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    mapping = session.exec(
        select(MarketplaceSkuMapping)
        .where(MarketplaceSkuMapping.companyId == company_filter.company_id)
        .where(MarketplaceSkuMapping.channel == channel.upper())
        .where(MarketplaceSkuMapping.marketplaceSku == marketplace_sku)
    ).first()

    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")

    # Get SKU details
    sku = session.exec(
        select(SKU).where(SKU.id == mapping.skuId)
    ).first()

    return {
        "mapping": MarketplaceSkuMappingResponse.model_validate(mapping),
        "sku": {
            "id": str(sku.id),
            "skuCode": sku.skuCode,
            "name": sku.name,
            "category": sku.category,
            "brand": sku.brand,
        } if sku else None
    }
