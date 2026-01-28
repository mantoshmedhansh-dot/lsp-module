# CJDQuick OMS - Structural Audit Report

**Audit Date:** 2026-01-28
**Status:** ISSUES FOUND AND PARTIALLY FIXED

---

## Executive Summary

| Check | Status | Notes |
|-------|--------|-------|
| Database ↔ Backend Models | OK | 106 tables aligned |
| Backend ↔ Frontend Types | FIXED | Types regenerated |
| Naming Convention | OK | camelCase throughout |
| Decimal Handling | OK | String serialization |
| Critical Fields | OK | companyId present |

---

## 1. TYPE GENERATION STATUS

### Before Fix (Jan 26)
| Model | Backend | Frontend | Status |
|-------|---------|----------|--------|
| OrderResponse | 37 | 18 | CRITICAL MISMATCH |
| Missing: companyId, customerId, shippingAddress, billingAddress, B2B fields

### After Fix (Jan 28)
| Model | Backend | Frontend | Status |
|-------|---------|----------|--------|
| OrderResponse | 37 | 37 | OK |
| CustomerResponse | 34 | 34 | OK |
| SKUResponse | 30 | 30 | OK |
| WaveResponse | 31 | 31 | OK |
| NDRResponse | 27 | 27 | OK |
| ReturnResponse | 20 | 20 | OK |
| CompanyResponse | 16 | 16 | OK |
| LocationResponse | 15 | 15 | OK |
| UserResponse | 12 | 12 | OK |
| InventoryResponse | 18 | 10 | INVESTIGATE |

---

## 2. PROJECT STRUCTURE PATTERNS

### Naming Convention: camelCase (Consistent)

| Layer | Convention | Example |
|-------|------------|---------|
| Database (Supabase) | camelCase | `companyId`, `createdAt` |
| Backend Models | camelCase | `companyId: UUID` |
| Backend Response | camelCase | `companyId` |
| Frontend Types | camelCase | `companyId: string` |

### Required Fields (All Tables)

```python
# Backend Model Pattern
class Entity(BaseModel, table=True):
    __tablename__ = "Entity"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    # ... entity-specific fields ...
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)
```

```typescript
// Frontend Type Pattern
export type EntityResponse = {
    id: string;
    // ... entity-specific fields ...
    companyId: string;
    createdAt: string;
    updatedAt: string;
};
```

---

## 3. TYPE SYNCHRONIZATION PROCESS

### How Types Are Generated

```
Backend SQLModel → FastAPI → OpenAPI spec → @hey-api/openapi-ts → Frontend types
```

### Command to Regenerate

```bash
cd apps/web && npm run generate-api:prod
```

### Configuration File

```typescript
// apps/web/openapi-ts.config.ts
export default defineConfig({
  client: 'legacy/fetch',
  input: 'https://cjdquick-api-vr4w.onrender.com/openapi.json',
  output: {
    path: './src/lib/api/generated',
    format: 'prettier',
  },
  types: {
    enums: 'javascript',
  },
});
```

---

## 4. DECIMAL HANDLING

### Pattern (Consistent)

| Backend (Python) | OpenAPI | Frontend (TypeScript) |
|------------------|---------|----------------------|
| `Decimal` | `string` (pattern) | `string` |

### Frontend Parsing Helper

```typescript
// apps/web/src/lib/utils.ts
export const parseDecimal = (value: string | number | null): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'string') return parseFloat(value) || 0;
  return value;
};

// Usage
const total = parseDecimal(order.subtotal) + parseDecimal(order.taxAmount);
```

---

## 5. API RESPONSE PATTERNS

### Standard Response Structure

```python
# Single item
{"id": "uuid", "field": "value", "createdAt": "...", "updatedAt": "..."}

# List
[{"id": "uuid1", ...}, {"id": "uuid2", ...}]

# Error
{"detail": "Error message"}
```

### Response Models

```python
# Backend API pattern
@router.get("", response_model=List[EntityBrief])  # List view
def list_entities(...): ...

@router.get("/{id}", response_model=EntityResponse)  # Detail view
def get_entity(...): ...

@router.post("", response_model=EntityResponse)  # Create
def create_entity(...): ...
```

---

## 6. KNOWN ISSUES

### InventoryResponse Mismatch

**Backend InventoryResponse (18 fields):**
- id, quantity, reservedQty, batchNo, lotNo, expiryDate, mfgDate
- mrp, costPrice, serialNumbers, valuationMethod, fifoSequence
- skuId, binId, locationId, createdAt, updatedAt, availableQty

**Frontend InventoryResponse (10 fields):**
- id, quantity, reservedQty, availableQty, batchNo
- skuId, skuCode, skuName, binId, locationId

**Missing in Frontend:**
- lotNo, expiryDate, mfgDate
- mrp, costPrice, serialNumbers
- valuationMethod, fifoSequence
- createdAt, updatedAt

**Extra in Frontend:**
- skuCode, skuName (joined fields)

**Action:** Investigate OpenAPI schema generation for Inventory endpoints

---

## 7. VERIFICATION COMMANDS

### Check Backend Health
```bash
curl https://cjdquick-api-vr4w.onrender.com/health
```

### Check OpenAPI Schema
```bash
curl -s https://cjdquick-api-vr4w.onrender.com/openapi.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
schemas = data.get('components', {}).get('schemas', {})
print(f'Total schemas: {len(schemas)}')
for name in sorted(schemas.keys()):
    if 'Response' in name:
        fields = len(schemas[name].get('properties', {}))
        print(f'  {name}: {fields} fields')
"
```

### Regenerate Frontend Types
```bash
cd apps/web && npm run generate-api:prod
```

### Verify Types Match
```bash
# Count fields in frontend types
grep -A 100 "export type OrderResponse" apps/web/src/lib/api/generated/types.gen.ts | head -50
```

---

## 8. RECOMMENDATIONS

### Immediate Actions
1. ✅ Regenerate frontend types (DONE - Jan 28)
2. ⚠️ Investigate InventoryResponse OpenAPI mismatch
3. ⚠️ Add pre-commit hook to verify type sync

### Weekly Maintenance
1. Run `npm run generate-api:prod` after backend changes
2. Verify critical Response schemas match
3. Test Decimal parsing in calculations

### Development Guidelines
1. Always add `companyId`, `createdAt`, `updatedAt` to new models
2. Use `parseDecimal()` for all numeric calculations in frontend
3. Run type generation after adding/modifying Response schemas

---

## 9. FILE REFERENCES

| Purpose | Path |
|---------|------|
| Backend Models | `backend/app/models/` |
| Backend APIs | `backend/app/api/v1/` |
| Frontend Types | `apps/web/src/lib/api/generated/types.gen.ts` |
| Type Gen Config | `apps/web/openapi-ts.config.ts` |
| Utils (parseDecimal) | `apps/web/src/lib/utils.ts` |

---

**Report Generated:** 2026-01-28
**Types Last Regenerated:** 2026-01-28
