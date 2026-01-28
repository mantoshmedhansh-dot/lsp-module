"""
Bulk Upload Service

Handles CSV/Excel parsing and bulk record creation for WMS Inbound operations.
"""

import csv
import io
from datetime import datetime
from decimal import Decimal
from typing import List, Dict, Any, Optional, Tuple
from uuid import UUID, uuid4

from sqlmodel import Session, select

from app.models import (
    UploadBatch, UploadError, UploadResult,
    ExternalPurchaseOrder, ExternalPOItem,
    AdvanceShippingNotice, ASNItem,
    StockTransferOrder, STOItem,
    Inventory, Location, SKU, Bin, Zone
)


class BulkUploadService:
    """Service for processing bulk uploads."""

    def __init__(self, session: Session, company_id: UUID, user_id: UUID):
        self.session = session
        self.company_id = company_id
        self.user_id = user_id
        self.errors: List[UploadError] = []
        self.success_count = 0
        self.created_count = 0
        self.updated_count = 0

    def _generate_batch_no(self, prefix: str) -> str:
        """Generate unique batch number."""
        date_part = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        return f"{prefix}-{date_part}"

    def _parse_date(self, date_str: Optional[str]) -> Optional[datetime]:
        """Parse date string in various formats."""
        if not date_str:
            return None

        formats = [
            "%Y-%m-%d",
            "%d-%m-%Y",
            "%d/%m/%Y",
            "%Y/%m/%d",
            "%Y-%m-%d %H:%M:%S",
            "%d-%m-%Y %H:%M:%S",
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt)
            except ValueError:
                continue

        return None

    def _parse_decimal(self, value: Any) -> Optional[Decimal]:
        """Parse decimal value."""
        if value is None or value == "":
            return None
        try:
            return Decimal(str(value).strip())
        except:
            return None

    def _parse_int(self, value: Any) -> int:
        """Parse integer value."""
        if value is None or value == "":
            return 0
        try:
            return int(float(str(value).strip()))
        except:
            return 0

    def _add_error(self, row: int, field: Optional[str], value: Optional[str], error: str):
        """Add an error to the error log."""
        self.errors.append(UploadError(
            row=row,
            field=field,
            value=value,
            error=error
        ))

    def _get_or_create_sku(self, sku_code: str, sku_name: Optional[str] = None) -> Optional[SKU]:
        """Get existing SKU or return None (don't create)."""
        sku = self.session.exec(
            select(SKU)
            .where(SKU.code == sku_code)
            .where(SKU.companyId == self.company_id)
        ).first()
        return sku

    def _get_location_by_code(self, location_code: str) -> Optional[Location]:
        """Get location by code."""
        return self.session.exec(
            select(Location)
            .where(Location.code == location_code)
            .where(Location.companyId == self.company_id)
        ).first()

    def _get_bin_by_code(self, bin_code: str, location_id: UUID) -> Optional[Bin]:
        """Get bin by code within a location."""
        return self.session.exec(
            select(Bin)
            .where(Bin.code == bin_code)
            .where(Bin.locationId == location_id)
        ).first()

    # =========================================================================
    # External PO Upload
    # =========================================================================

    def process_external_po_upload(
        self,
        csv_content: str,
        file_name: str
    ) -> UploadResult:
        """Process External PO CSV upload."""
        batch_no = self._generate_batch_no("EPO")

        # Create upload batch
        batch = UploadBatch(
            id=uuid4(),
            company_id=self.company_id,
            batch_no=batch_no,
            upload_type="EXTERNAL_PO",
            file_name=file_name,
            file_size=len(csv_content),
            status="PROCESSING",
            uploaded_by=self.user_id
        )
        self.session.add(batch)

        # Parse CSV
        reader = csv.DictReader(io.StringIO(csv_content))
        rows = list(reader)
        batch.total_rows = len(rows)

        # Group rows by PO number
        po_groups: Dict[str, List[Dict]] = {}
        for row in rows:
            po_no = row.get("external_po_number", "").strip()
            if po_no:
                if po_no not in po_groups:
                    po_groups[po_no] = []
                po_groups[po_no].append(row)

        # Process each PO
        for po_no, items in po_groups.items():
            try:
                self._process_single_po(po_no, items, batch.id)
                self.success_count += len(items)
                self.created_count += 1
            except Exception as e:
                self._add_error(0, "external_po_number", po_no, str(e))

        # Update batch
        batch.success_rows = self.success_count
        batch.error_rows = len(self.errors)
        batch.error_log = [e.model_dump() for e in self.errors]
        batch.status = self._determine_status()
        batch.processed_at = datetime.utcnow()

        self.session.commit()

        return UploadResult(
            batch_id=batch.id,
            batch_no=batch_no,
            status=batch.status,
            total_rows=batch.total_rows,
            success_rows=batch.success_rows,
            error_rows=batch.error_rows,
            errors=self.errors,
            created_records=self.created_count
        )

    def _process_single_po(self, po_no: str, items: List[Dict], batch_id: UUID):
        """Process a single External PO with its items."""
        first_row = items[0]

        # Check if PO already exists
        existing = self.session.exec(
            select(ExternalPurchaseOrder)
            .where(ExternalPurchaseOrder.external_po_number == po_no)
            .where(ExternalPurchaseOrder.company_id == self.company_id)
        ).first()

        if existing:
            raise ValueError(f"PO {po_no} already exists")

        # Create PO
        po = ExternalPurchaseOrder(
            company_id=self.company_id,
            external_po_number=po_no,
            external_vendor_code=first_row.get("external_vendor_code", "").strip() or None,
            external_vendor_name=first_row.get("external_vendor_name", "").strip() or None,
            po_date=self._parse_date(first_row.get("po_date")),
            expected_delivery_date=self._parse_date(first_row.get("expected_delivery_date")),
            source="UPLOAD",
            upload_batch_id=batch_id
        )
        self.session.add(po)
        self.session.flush()

        # Create items
        for idx, row in enumerate(items):
            sku_code = row.get("external_sku_code", "").strip()
            if not sku_code:
                self._add_error(idx + 1, "external_sku_code", "", "SKU code is required")
                continue

            item = ExternalPOItem(
                external_po_id=po.id,
                external_sku_code=sku_code,
                external_sku_name=row.get("external_sku_name", "").strip() or None,
                ordered_qty=self._parse_int(row.get("ordered_qty", 0)),
                unit_price=self._parse_decimal(row.get("unit_price"))
            )
            self.session.add(item)

    # =========================================================================
    # ASN Upload
    # =========================================================================

    def process_asn_upload(
        self,
        csv_content: str,
        file_name: str,
        location_id: UUID
    ) -> UploadResult:
        """Process ASN CSV upload."""
        batch_no = self._generate_batch_no("ASN")

        # Create upload batch
        batch = UploadBatch(
            id=uuid4(),
            company_id=self.company_id,
            batch_no=batch_no,
            upload_type="ASN",
            file_name=file_name,
            file_size=len(csv_content),
            status="PROCESSING",
            uploaded_by=self.user_id
        )
        self.session.add(batch)

        # Parse CSV
        reader = csv.DictReader(io.StringIO(csv_content))
        rows = list(reader)
        batch.total_rows = len(rows)

        # Group by ASN number (or PO number if no ASN)
        asn_groups: Dict[str, List[Dict]] = {}
        for row in rows:
            asn_no = row.get("external_asn_no", "").strip()
            po_no = row.get("external_po_number", "").strip()
            key = asn_no or po_no or f"AUTO-{uuid4().hex[:8]}"
            if key not in asn_groups:
                asn_groups[key] = []
            asn_groups[key].append(row)

        # Process each ASN
        for asn_key, items in asn_groups.items():
            try:
                self._process_single_asn(asn_key, items, location_id, batch.id)
                self.success_count += len(items)
                self.created_count += 1
            except Exception as e:
                self._add_error(0, "external_asn_no", asn_key, str(e))

        # Update batch
        batch.success_rows = self.success_count
        batch.error_rows = len(self.errors)
        batch.error_log = [e.model_dump() for e in self.errors]
        batch.status = self._determine_status()
        batch.processed_at = datetime.utcnow()

        self.session.commit()

        return UploadResult(
            batch_id=batch.id,
            batch_no=batch_no,
            status=batch.status,
            total_rows=batch.total_rows,
            success_rows=batch.success_rows,
            error_rows=batch.error_rows,
            errors=self.errors,
            created_records=self.created_count
        )

    def _process_single_asn(
        self,
        asn_key: str,
        items: List[Dict],
        location_id: UUID,
        batch_id: UUID
    ):
        """Process a single ASN with its items."""
        first_row = items[0]
        external_asn_no = first_row.get("external_asn_no", "").strip() or None
        external_po_no = first_row.get("external_po_number", "").strip() or None

        # Find linked PO if provided
        linked_po_id = None
        if external_po_no:
            po = self.session.exec(
                select(ExternalPurchaseOrder)
                .where(ExternalPurchaseOrder.external_po_number == external_po_no)
                .where(ExternalPurchaseOrder.company_id == self.company_id)
            ).first()
            if po:
                linked_po_id = po.id

        # Create ASN
        asn = AdvanceShippingNotice(
            company_id=self.company_id,
            location_id=location_id,
            external_asn_no=external_asn_no,
            external_po_id=linked_po_id,
            carrier=first_row.get("carrier", "").strip() or None,
            tracking_number=first_row.get("tracking_number", "").strip() or None,
            expected_arrival=self._parse_date(first_row.get("expected_arrival")),
            source="UPLOAD",
            upload_batch_id=batch_id
        )
        self.session.add(asn)
        self.session.flush()

        # Create items
        for idx, row in enumerate(items):
            sku_code = row.get("external_sku_code", "").strip()
            if not sku_code:
                self._add_error(idx + 1, "external_sku_code", "", "SKU code is required")
                continue

            # Try to find matching SKU
            sku = self._get_or_create_sku(sku_code)

            item = ASNItem(
                asn_id=asn.id,
                external_sku_code=sku_code,
                sku_id=sku.id if sku else None,
                expected_qty=self._parse_int(row.get("expected_qty", 0)),
                batch_no=row.get("batch_no", "").strip() or None,
                expiry_date=self._parse_date(row.get("expiry_date")),
                cartons=self._parse_int(row.get("cartons")) or None
            )
            self.session.add(item)

    # =========================================================================
    # Opening Stock Upload
    # =========================================================================

    def process_opening_stock_upload(
        self,
        csv_content: str,
        file_name: str
    ) -> UploadResult:
        """Process Opening Stock CSV upload."""
        batch_no = self._generate_batch_no("OPN")

        # Create upload batch
        batch = UploadBatch(
            id=uuid4(),
            company_id=self.company_id,
            batch_no=batch_no,
            upload_type="OPENING_STOCK",
            file_name=file_name,
            file_size=len(csv_content),
            status="PROCESSING",
            uploaded_by=self.user_id
        )
        self.session.add(batch)

        # Parse CSV
        reader = csv.DictReader(io.StringIO(csv_content))
        rows = list(reader)
        batch.total_rows = len(rows)

        # Process each row as inventory record
        for idx, row in enumerate(rows, start=1):
            try:
                self._process_opening_stock_row(row, idx)
                self.success_count += 1
            except Exception as e:
                self._add_error(idx, None, None, str(e))

        # Update batch
        batch.success_rows = self.success_count
        batch.error_rows = len(self.errors)
        batch.error_log = [e.model_dump() for e in self.errors]
        batch.status = self._determine_status()
        batch.processed_at = datetime.utcnow()

        self.session.commit()

        return UploadResult(
            batch_id=batch.id,
            batch_no=batch_no,
            status=batch.status,
            total_rows=batch.total_rows,
            success_rows=batch.success_rows,
            error_rows=batch.error_rows,
            errors=self.errors,
            created_records=self.created_count,
            updated_records=self.updated_count
        )

    def _process_opening_stock_row(self, row: Dict, row_num: int):
        """Process a single opening stock row."""
        location_code = row.get("location_code", "").strip()
        sku_code = row.get("sku_code", "").strip()
        bin_code = row.get("bin_code", "").strip() or None
        quantity = self._parse_int(row.get("quantity", 0))

        if not location_code:
            raise ValueError("Location code is required")
        if not sku_code:
            raise ValueError("SKU code is required")
        if quantity <= 0:
            raise ValueError("Quantity must be greater than 0")

        # Get location
        location = self._get_location_by_code(location_code)
        if not location:
            raise ValueError(f"Location '{location_code}' not found")

        # Get SKU
        sku = self._get_or_create_sku(sku_code)
        if not sku:
            raise ValueError(f"SKU '{sku_code}' not found")

        # Get bin if provided
        bin_id = None
        if bin_code:
            bin_obj = self._get_bin_by_code(bin_code, location.id)
            if not bin_obj:
                raise ValueError(f"Bin '{bin_code}' not found in location")
            bin_id = bin_obj.id

        # Check for existing inventory
        query = select(Inventory).where(
            Inventory.companyId == self.company_id,
            Inventory.locationId == location.id,
            Inventory.skuId == sku.id
        )
        if bin_id:
            query = query.where(Inventory.binId == bin_id)

        existing = self.session.exec(query).first()

        if existing:
            # Update existing
            existing.quantity = (existing.quantity or 0) + quantity
            existing.availableQty = (existing.availableQty or 0) + quantity
            self.session.add(existing)
            self.updated_count += 1
        else:
            # Create new
            inv = Inventory(
                companyId=self.company_id,
                locationId=location.id,
                skuId=sku.id,
                binId=bin_id,
                quantity=quantity,
                availableQty=quantity,
                reservedQty=0,
                batchNo=row.get("batch_no", "").strip() or None,
                lotNo=row.get("lot_no", "").strip() or None,
                expiryDate=self._parse_date(row.get("expiry_date")),
                mfgDate=self._parse_date(row.get("mfg_date")),
                costPrice=self._parse_decimal(row.get("cost_price")),
                mrp=self._parse_decimal(row.get("mrp"))
            )
            self.session.add(inv)
            self.created_count += 1

    # =========================================================================
    # Stock Transfer Upload
    # =========================================================================

    def process_sto_upload(
        self,
        csv_content: str,
        file_name: str
    ) -> UploadResult:
        """Process Stock Transfer Order CSV upload."""
        batch_no = self._generate_batch_no("STO")

        # Create upload batch
        batch = UploadBatch(
            id=uuid4(),
            company_id=self.company_id,
            batch_no=batch_no,
            upload_type="STOCK_TRANSFER",
            file_name=file_name,
            file_size=len(csv_content),
            status="PROCESSING",
            uploaded_by=self.user_id
        )
        self.session.add(batch)

        # Parse CSV
        reader = csv.DictReader(io.StringIO(csv_content))
        rows = list(reader)
        batch.total_rows = len(rows)

        # Group by STO number
        sto_groups: Dict[str, List[Dict]] = {}
        for row in rows:
            sto_no = row.get("sto_number", "").strip()
            if not sto_no:
                sto_no = f"STO-{batch_no}-{len(sto_groups) + 1}"
            if sto_no not in sto_groups:
                sto_groups[sto_no] = []
            sto_groups[sto_no].append(row)

        # Process each STO
        for sto_no, items in sto_groups.items():
            try:
                self._process_single_sto(sto_no, items, batch.id)
                self.success_count += len(items)
                self.created_count += 1
            except Exception as e:
                self._add_error(0, "sto_number", sto_no, str(e))

        # Update batch
        batch.success_rows = self.success_count
        batch.error_rows = len(self.errors)
        batch.error_log = [e.model_dump() for e in self.errors]
        batch.status = self._determine_status()
        batch.processed_at = datetime.utcnow()

        self.session.commit()

        return UploadResult(
            batch_id=batch.id,
            batch_no=batch_no,
            status=batch.status,
            total_rows=batch.total_rows,
            success_rows=batch.success_rows,
            error_rows=batch.error_rows,
            errors=self.errors,
            created_records=self.created_count
        )

    def _process_single_sto(
        self,
        sto_no: str,
        items: List[Dict],
        batch_id: UUID
    ):
        """Process a single STO with its items."""
        first_row = items[0]

        source_code = first_row.get("source_location_code", "").strip()
        dest_code = first_row.get("destination_location_code", "").strip()

        if not source_code or not dest_code:
            raise ValueError("Source and destination location codes are required")

        source_loc = self._get_location_by_code(source_code)
        dest_loc = self._get_location_by_code(dest_code)

        if not source_loc:
            raise ValueError(f"Source location '{source_code}' not found")
        if not dest_loc:
            raise ValueError(f"Destination location '{dest_code}' not found")

        # Create STO
        sto = StockTransferOrder(
            company_id=self.company_id,
            sto_no=sto_no,
            source_location_id=source_loc.id,
            destination_location_id=dest_loc.id,
            required_by_date=self._parse_date(first_row.get("required_by_date")),
            priority=first_row.get("priority", "NORMAL").strip().upper(),
            source="UPLOAD",
            upload_batch_id=batch_id,
            requested_by=self.user_id
        )
        self.session.add(sto)
        self.session.flush()

        # Create items
        for idx, row in enumerate(items):
            sku_code = row.get("sku_code", "").strip()
            if not sku_code:
                self._add_error(idx + 1, "sku_code", "", "SKU code is required")
                continue

            sku = self._get_or_create_sku(sku_code)
            if not sku:
                self._add_error(idx + 1, "sku_code", sku_code, f"SKU '{sku_code}' not found")
                continue

            item = STOItem(
                stock_transfer_order_id=sto.id,
                sku_id=sku.id,
                requested_qty=self._parse_int(row.get("quantity", 0)),
                batch_no=row.get("batch_no", "").strip() or None,
                lot_no=row.get("lot_no", "").strip() or None
            )
            self.session.add(item)

    # =========================================================================
    # Helpers
    # =========================================================================

    def _determine_status(self) -> str:
        """Determine batch status based on results."""
        if not self.errors:
            return "COMPLETED"
        elif self.success_count == 0:
            return "FAILED"
        else:
            return "PARTIALLY_COMPLETED"


# ============================================================================
# CSV Template Generation
# ============================================================================

def generate_external_po_template() -> str:
    """Generate CSV template for External PO upload."""
    headers = [
        "external_po_number",
        "external_vendor_code",
        "external_vendor_name",
        "po_date",
        "expected_delivery_date",
        "external_sku_code",
        "external_sku_name",
        "ordered_qty",
        "unit_price"
    ]
    return ",".join(headers) + "\n"


def generate_asn_template() -> str:
    """Generate CSV template for ASN upload."""
    headers = [
        "external_asn_no",
        "external_po_number",
        "carrier",
        "tracking_number",
        "expected_arrival",
        "external_sku_code",
        "expected_qty",
        "batch_no",
        "expiry_date",
        "cartons"
    ]
    return ",".join(headers) + "\n"


def generate_opening_stock_template() -> str:
    """Generate CSV template for Opening Stock upload."""
    headers = [
        "location_code",
        "sku_code",
        "bin_code",
        "quantity",
        "batch_no",
        "lot_no",
        "expiry_date",
        "mfg_date",
        "cost_price",
        "mrp"
    ]
    return ",".join(headers) + "\n"


def generate_sto_template() -> str:
    """Generate CSV template for Stock Transfer upload."""
    headers = [
        "sto_number",
        "source_location_code",
        "destination_location_code",
        "required_by_date",
        "priority",
        "sku_code",
        "quantity",
        "batch_no",
        "lot_no"
    ]
    return ",".join(headers) + "\n"
