# Type System Audit Report

## Summary
Comprehensive audit of TypeScript types, enums, and field matching between backend (FastAPI/SQLModel) and frontend (Next.js/React).

---

## 1. DATABASE vs PYTHON ENUM MISMATCH (Critical)

### ReturnStatus Enum
**Issue**: PostgreSQL database enum is missing values that exist in Python code.

| Value | Python Enum | Database Enum | Status |
|-------|-------------|---------------|--------|
| INITIATED | ✅ | ✅ | OK |
| PICKUP_SCHEDULED | ✅ | ✅ | OK |
| PICKED_UP | ✅ | ✅ | OK |
| IN_TRANSIT | ✅ | ✅ | OK |
| RECEIVED | ✅ | ✅ | OK |
| QC_PENDING | ✅ | ✅ | OK |
| QC_PASSED | ✅ | ✅ | OK |
| QC_FAILED | ✅ | ✅ | OK |
| **PROCESSED** | ✅ | ❌ MISSING | **CRITICAL** |
| REFUND_INITIATED | ✅ | ? | Unknown |
| **COMPLETED** | ✅ | ❌ MISSING | **CRITICAL** |
| CANCELLED | ✅ | ✅ | OK |

**Impact**: Runtime errors when trying to insert/update returns with PROCESSED or COMPLETED status.

**Fix Required**: Run database migration to add missing enum values:
```sql
ALTER TYPE "ReturnStatus" ADD VALUE 'PROCESSED';
ALTER TYPE "ReturnStatus" ADD VALUE 'COMPLETED';
```

---

## 2. FRONTEND HARDCODED STATUS MISMATCHES

### NDR Page (`control-tower/ndr/page.tsx`)

#### Status Filter Values (Lines 379-385)
Frontend uses statuses that don't match backend enum:

| Frontend (Hardcoded) | Backend (NDRStatus) | Match |
|---------------------|---------------------|-------|
| OPEN | OPEN | ✅ |
| CONTACTED | ❌ NOT IN ENUM | ❌ |
| CUSTOMER_RESPONDED | ❌ NOT IN ENUM | ❌ |
| REATTEMPT_SCHEDULED | REATTEMPT_SCHEDULED | ✅ |
| RESOLVED | RESOLVED | ✅ |
| RTO_PENDING | ❌ (should be RTO) | ❌ |

**Backend NDRStatus enum**:
- OPEN
- ACTION_REQUESTED
- REATTEMPT_SCHEDULED
- RESOLVED
- RTO
- CLOSED

#### Reason Filter Values (Lines 321-327)
Frontend uses reason keys that don't match backend enum:

| Frontend (Hardcoded) | Backend (NDRReason) | Match |
|---------------------|---------------------|-------|
| CUSTOMER_NOT_AVAILABLE | CUSTOMER_UNAVAILABLE | ❌ |
| WRONG_ADDRESS | WRONG_ADDRESS | ✅ |
| PHONE_UNREACHABLE | PHONE_UNREACHABLE | ✅ |
| REFUSED | CUSTOMER_REFUSED | ❌ |
| COD_NOT_READY | COD_NOT_READY | ✅ |
| CUSTOMER_RESCHEDULE | DELIVERY_RESCHEDULED | ❌ |
| OTHER | OTHER | ✅ |

**Backend NDRReason enum**:
- CUSTOMER_UNAVAILABLE
- WRONG_ADDRESS
- INCOMPLETE_ADDRESS
- CUSTOMER_REFUSED
- COD_NOT_READY
- PHONE_UNREACHABLE
- DELIVERY_RESCHEDULED
- ADDRESS_NOT_FOUND
- AREA_NOT_SERVICEABLE
- NATURAL_DISASTER
- OTHER

---

## 3. MISSING TYPE DEFINITIONS

### NDRListItem Missing `_count` Field (Line 502)
```typescript
// Current (using any cast)
{(ndr as any)._count?.outreachAttempts || 0}

// Backend returns this field but it's not in generated types
_count: Optional[dict] = None  // In NDRListItem model
```

**Fix**: The frontend generated types don't include `_count` field. Need to either:
1. Add to backend schema explicitly
2. Extend the type in frontend

---

## 4. FIELD NAME CONSISTENCY CHECK

### Return Model - Backend vs Frontend Generated Types
| Field (Backend) | Field (Frontend) | Match |
|----------------|------------------|-------|
| returnNo | returnNo | ✅ |
| type | type | ✅ |
| status | status | ✅ |
| orderId | orderId | ✅ |
| awbNo | awbNo | ✅ |
| reason | reason | ✅ |
| remarks | remarks | ✅ |
| qcStatus | qcStatus | ✅ |
| qcCompletedAt | qcCompletedAt | ✅ |
| qcCompletedBy | qcCompletedBy | ✅ |
| qcRemarks | qcRemarks | ✅ |
| initiatedAt | initiatedAt | ✅ |
| receivedAt | receivedAt | ✅ |
| processedAt | processedAt | ✅ |
| refundAmount | refundAmount | ✅ |
| refundStatus | refundStatus | ✅ |
| createdAt | createdAt | ✅ |
| updatedAt | updatedAt | ✅ |
| **companyId** | ❌ MISSING | ❌ |

### NDR Model - Backend vs Frontend
All fields match ✅

### Order Model - Backend vs Frontend
All fields match ✅

---

## 5. API ENDPOINT PARAMETER MISMATCHES

### Returns List Endpoint
```
Backend: GET /api/v1/returns?skip=0&limit=50&return_type=RTO
Frontend Hook: useReturnList({ skip, limit, returnType })
```
- Parameter name: `return_type` (backend) vs `returnType` (frontend)
- **Status**: Frontend API client handles this correctly via OpenAPI generation ✅

---

## 6. FIXES APPLIED

### ✅ FIXED: NDR Page (`control-tower/ndr/page.tsx`)
- Status filter values updated to match backend NDRStatus enum
- Reason filter keys updated to match backend NDRReason enum
- Status display badges updated with correct enum values
- Changed `_count` to `outreachCount` for proper serialization

### ✅ FIXED: Returns Page (`returns/page.tsx`)
- Replaced invalid RESTOCKED/DISPOSED/REFUNDED with valid ReturnStatus values
- Replaced VENDOR_RETURN with EXCHANGE in ReturnType filter
- Updated status filter dropdown to use valid enum values
- Fixed stat card to use QC_PASSED instead of RESTOCKED

### ✅ FIXED: RTO Page (`returns/rto/page.tsx`)
- Updated statusColors to use valid ReturnStatus values
- Fixed status filter dropdown options
- Fixed stat card references

### ✅ FIXED: Backend Schemas
- Added `companyId` to `ReturnResponse` schema
- Changed `_count` to `outreachCount` in `NDRListItem` schema

### ⏳ PENDING: Database Migration
Alembic migration created at `backend/alembic/versions/001_add_return_status_enum_values.py`

To run the migration, execute in Supabase SQL editor:
```sql
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PROCESSED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ReturnStatus')) THEN
        ALTER TYPE "ReturnStatus" ADD VALUE 'PROCESSED';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'COMPLETED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ReturnStatus')) THEN
        ALTER TYPE "ReturnStatus" ADD VALUE 'COMPLETED';
    END IF;
END $$;
```

---

## 7. VERIFICATION COMMANDS

```bash
# Check TypeScript compilation
cd apps/web && npx tsc --noEmit

# Regenerate OpenAPI client (after backend changes)
cd apps/web && npm run generate:api

# Test backend enum values
curl -s https://cjdquick-api-vr4w.onrender.com/api/v1/returns/summary
```

---

Generated: 2026-01-16
