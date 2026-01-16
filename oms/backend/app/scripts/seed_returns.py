"""
Seed script for Returns/RTO test data
Run with: python -m app.scripts.seed_returns
"""
import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4
import random

from sqlmodel import Session, select
from app.core.database import engine
from app.models import Return, Order, Company
from app.models.enums import ReturnType, ReturnStatus, QCStatus


# Sample RTO reasons
RTO_REASONS = [
    "Customer refused delivery",
    "Address incorrect/incomplete",
    "Customer not available",
    "Phone unreachable",
    "COD amount not ready",
    "Customer requested cancellation",
    "Delivery attempted 3 times",
    "Area not serviceable",
]


def generate_return_no(index: int) -> str:
    """Generate a unique return number"""
    return f"RTO-{datetime.now().strftime('%Y%m')}-{str(index).zfill(4)}"


def generate_awb() -> str:
    """Generate a fake AWB number"""
    carriers = ["DEL", "BLU", "DTC", "EKT", "SHY"]
    carrier = random.choice(carriers)
    return f"{carrier}{random.randint(100000000, 999999999)}"


def seed_returns():
    """Seed RTO return data for testing"""
    with Session(engine) as session:
        # Check if we already have returns
        existing_returns = session.exec(select(Return).limit(1)).first()
        if existing_returns:
            print("Returns already exist, skipping seed...")
            return

        # Get a company ID (if any exists)
        company = session.exec(select(Company).limit(1)).first()
        company_id = company.id if company else None

        # Get some orders to link (if any exist)
        orders = session.exec(select(Order).limit(20)).all()
        order_ids = [o.id for o in orders] if orders else []

        print(f"Found {len(order_ids)} orders to link")
        print(f"Company ID: {company_id}")

        # Create RTO returns with various statuses
        returns_data = []

        # Distribution of statuses for realistic data
        status_distribution = [
            (ReturnStatus.INITIATED, 5),
            (ReturnStatus.IN_TRANSIT, 8),
            (ReturnStatus.RECEIVED, 6),
            (ReturnStatus.QC_PENDING, 10),
            (ReturnStatus.QC_PASSED, 4),
            (ReturnStatus.QC_FAILED, 2),
            (ReturnStatus.PROCESSED, 3),
            (ReturnStatus.COMPLETED, 7),
        ]

        index = 1
        for status, count in status_distribution:
            for _ in range(count):
                # Random dates in the past 30 days
                days_ago = random.randint(0, 30)
                initiated_at = datetime.utcnow() - timedelta(days=days_ago)

                # Set received/processed dates based on status
                received_at = None
                processed_at = None
                qc_status = None

                if status in [ReturnStatus.RECEIVED, ReturnStatus.QC_PENDING,
                             ReturnStatus.QC_PASSED, ReturnStatus.QC_FAILED,
                             ReturnStatus.PROCESSED, ReturnStatus.COMPLETED]:
                    received_at = initiated_at + timedelta(days=random.randint(1, 5))

                if status in [ReturnStatus.QC_PASSED, ReturnStatus.QC_FAILED,
                             ReturnStatus.PROCESSED, ReturnStatus.COMPLETED]:
                    qc_status = QCStatus.PASSED if status != ReturnStatus.QC_FAILED else QCStatus.FAILED

                if status in [ReturnStatus.PROCESSED, ReturnStatus.COMPLETED]:
                    processed_at = received_at + timedelta(days=random.randint(1, 3)) if received_at else None

                return_obj = Return(
                    id=uuid4(),
                    returnNo=generate_return_no(index),
                    type=ReturnType.RTO,
                    status=status,
                    orderId=random.choice(order_ids) if order_ids else None,
                    awbNo=generate_awb(),
                    reason=random.choice(RTO_REASONS),
                    remarks=f"RTO due to: {random.choice(RTO_REASONS)}" if random.random() > 0.5 else None,
                    qcStatus=qc_status,
                    initiatedAt=initiated_at,
                    receivedAt=received_at,
                    processedAt=processed_at,
                    refundAmount=Decimal(random.randint(200, 5000)) if status == ReturnStatus.COMPLETED else None,
                    companyId=company_id,
                    createdAt=initiated_at,
                    updatedAt=datetime.utcnow(),
                )
                returns_data.append(return_obj)
                index += 1

        # Also add some customer returns for variety
        for i in range(10):
            days_ago = random.randint(0, 30)
            initiated_at = datetime.utcnow() - timedelta(days=days_ago)
            status = random.choice([ReturnStatus.INITIATED, ReturnStatus.RECEIVED,
                                   ReturnStatus.QC_PENDING, ReturnStatus.COMPLETED])

            return_obj = Return(
                id=uuid4(),
                returnNo=f"RET-{datetime.now().strftime('%Y%m')}-{str(index).zfill(4)}",
                type=ReturnType.CUSTOMER_RETURN,
                status=status,
                orderId=random.choice(order_ids) if order_ids else None,
                awbNo=generate_awb(),
                reason=random.choice(["Wrong size", "Defective product", "Not as described", "Changed mind"]),
                initiatedAt=initiated_at,
                companyId=company_id,
                createdAt=initiated_at,
                updatedAt=datetime.utcnow(),
            )
            returns_data.append(return_obj)
            index += 1

        # Bulk insert
        for r in returns_data:
            session.add(r)

        session.commit()
        print(f"Successfully seeded {len(returns_data)} returns ({index - 11} RTOs + 10 Customer Returns)")


if __name__ == "__main__":
    seed_returns()
