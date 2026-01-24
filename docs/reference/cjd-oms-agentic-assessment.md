# CJD OMS: Agentic S&OP Platform Assessment

> Assessment Date: 2026-01-18
> Purpose: Evaluate current stack against agentic AI / decision traces vision

---

## Executive Summary

| Dimension | Current State | Gap to Vision | Effort |
|-----------|---------------|---------------|--------|
| **Tech Stack** | Modern, solid foundation | Minor gaps | Low |
| **Data Model** | Operational focus, no audit trail | Significant gap | Medium |
| **Decision Capture** | Not designed for this | Major gap | High |
| **AI Readiness** | Basic enums exist, no implementation | Major gap | High |
| **Multi-tenancy** | Built-in | Ready | None |

**Bottom Line:** You have a solid operational OMS. The decision trace layer doesn't exist yet, but the architecture can support it.

---

## Part 1: Current Stack Analysis

### Architecture Overview

```
┌─────────────────────────────────────────┐
│         NEXT.JS FRONTEND (Vercel)       │
│         Thin proxy layer                │
└────────────────┬────────────────────────┘
                 │ HTTP/REST
                 ▼
┌─────────────────────────────────────────┐
│         FASTAPI BACKEND (Render)        │
│         SQLModel ORM                    │
│         Business logic layer            │
└────────────────┬────────────────────────┘
                 │ SQLAlchemy
                 ▼
┌─────────────────────────────────────────┐
│         POSTGRESQL (Supabase)           │
│         79 Tables                       │
└─────────────────────────────────────────┘
```

### Stack Strengths

| Component | Technology | Agentic Readiness |
|-----------|------------|-------------------|
| Backend | FastAPI + SQLModel | Excellent - async, type-safe, OpenAPI |
| Database | PostgreSQL | Excellent - JSON, ARRAY support, extensible |
| Frontend | Next.js | Good - can add AI chat interfaces |
| Hosting | Vercel + Render + Supabase | Good - scalable cloud-native |
| Multi-tenant | CompanyId on all tables | Ready - core requirement met |
| ORM | SQLModel (SQLAlchemy + Pydantic) | Excellent - type-safe, validations |

### Data Model Summary

**Core Entities (79 tables):**

| Domain | Key Models | Decision Potential |
|--------|------------|-------------------|
| **Orders** | Order, OrderItem, Delivery | High - every order is a decision |
| **Fulfillment** | Wave, Picklist, WaveItem | High - allocation decisions |
| **Inventory** | SKU, Inventory, Inbound | Medium - stock decisions |
| **Customers** | Customer, Credit, B2B | High - credit decisions |
| **Returns** | Return, NDR, QC | High - exception decisions |
| **Analytics** | Snapshot, DemandForecast | Medium - predictions exist |
| **System** | User, Company, Location | Low - config, not decisions |

---

## Part 2: What You Have (Decision Trace Lens)

### Existing Building Blocks

**1. Rich Status Enums (enums.py)**
```python
class OrderStatus(str, Enum):
    CREATED, CONFIRMED, PROCESSING, ALLOCATED,
    PICKING, PACKED, SHIPPED, DELIVERED...

class WaveStatus(str, Enum):
    DRAFT, PLANNED, RELEASED, IN_PROGRESS, COMPLETED...

class AIActionStatus(str, Enum):  # INTERESTING!
    PENDING_APPROVAL, APPROVED, REJECTED, EXECUTED, FAILED
```

**2. Timestamp Tracking (base.py)**
```python
class BaseModel:
    id: UUID
    createdAt: datetime  # When created
    updatedAt: datetime  # When last modified
```

**3. AI Action Types Already Defined!**
```python
class AIActionType(str, Enum):
    NDR_CLASSIFICATION = "NDR_CLASSIFICATION"
    NDR_RESOLUTION = "NDR_RESOLUTION"
    FRAUD_DETECTION = "FRAUD_DETECTION"
    DEMAND_FORECAST = "DEMAND_FORECAST"
    CARRIER_SELECTION = "CARRIER_SELECTION"
```

**4. User/Role Tracking**
```python
class Wave:
    createdById: UUID      # Who created
    assignedToId: UUID     # Who's responsible
```

**5. Analytics Foundation**
```python
class DemandForecast:
    predictedDemand: int
    confidenceScore: Decimal
    modelVersion: str
    features: dict  # JSON - what inputs were used
```

### What's Missing for Decision Traces

| Required Element | Current State | Gap |
|------------------|---------------|-----|
| **Who approved** | createdById exists | No approval chain |
| **What policy** | Not tracked | Major gap |
| **What exception** | Not tracked | Major gap |
| **What precedent** | Not tracked | Major gap |
| **Why allowed** | Not tracked | Major gap |
| **Decision history** | Only current state | No event log |
| **Override tracking** | Not tracked | Major gap |

---

## Part 3: Gap Analysis

### Gap 1: No Event/Decision Log

**Current:** Only stores current state
**Needed:** Event sourcing or decision log table

```python
# MISSING: Something like this
class DecisionEvent(BaseModel, table=True):
    entityType: str      # "Order", "Wave", "Allocation"
    entityId: UUID       # Which order/wave/etc
    decisionType: str    # "STATUS_CHANGE", "OVERRIDE", "EXCEPTION"
    previousValue: dict  # What it was
    newValue: dict       # What it became
    decidedBy: UUID      # User who decided
    approvedBy: UUID     # User who approved (if different)
    policyId: UUID       # Which policy applied
    exceptionGranted: bool
    precedentRef: UUID   # Reference to similar past decision
    reasoning: str       # Why this decision
    metadata: dict       # Additional context
```

### Gap 2: No Policy/Rule Engine

**Current:** Business rules are hardcoded in Python
**Needed:** Externalized, versioned policies

```python
# MISSING: Something like this
class Policy(BaseModel, table=True):
    name: str
    version: str
    domain: str          # "allocation", "credit", "returns"
    rules: dict          # JSON rule definition
    thresholds: dict     # Configurable thresholds
    approvalRequired: bool
    approvalLevel: str   # "MANAGER", "ADMIN", etc.
    isActive: bool
    effectiveFrom: datetime
    effectiveTo: datetime
```

### Gap 3: No Precedent Storage

**Current:** Decisions are one-off, not searchable
**Needed:** Precedent database

```python
# MISSING: Something like this
class Precedent(BaseModel, table=True):
    decisionEventId: UUID
    category: str        # "allocation_exception", "credit_override"
    context: dict        # Searchable context
    outcome: str         # What happened
    wasSuccessful: bool  # Did it work out?
    tags: List[str]      # For similarity search
    embedding: List[float]  # Vector for semantic search
```

### Gap 4: No Approval Workflow

**Current:** Single-user actions
**Needed:** Approval chains, delegation

```python
# MISSING: Something like this
class ApprovalRequest(BaseModel, table=True):
    decisionEventId: UUID
    requestedBy: UUID
    approverLevel: str
    status: str          # PENDING, APPROVED, REJECTED
    approvedBy: UUID
    approvedAt: datetime
    comments: str
    delegatedFrom: UUID  # If delegated
```

---

## Part 4: Agentic AI Readiness

### Current AI Foundation

**You already have:**
```python
class AIActionType(str, Enum):
    NDR_CLASSIFICATION    # Classify delivery failures
    NDR_RESOLUTION        # Suggest resolution
    FRAUD_DETECTION       # Flag suspicious orders
    DEMAND_FORECAST       # Predict demand
    CARRIER_SELECTION     # Choose transporter
```

**And:**
```python
class AIActionStatus(str, Enum):
    PENDING_APPROVAL      # Agent suggested, human must approve
    APPROVED              # Human approved
    REJECTED              # Human rejected
    EXECUTED              # Action taken
    FAILED                # Execution failed
```

This is a **good start** - you've already thought about human-in-the-loop!

### What's Needed for Agentic AI

| Capability | Status | Priority |
|------------|--------|----------|
| **AI Suggestions** | Enums exist, no implementation | High |
| **Human Approval** | Status enum exists, no workflow | High |
| **Decision Logging** | Not implemented | Critical |
| **Learning Loop** | Not implemented | Medium |
| **Explainability** | Not implemented | Medium |

---

## Part 5: Roadmap Assessment

### Phase 1: Decision Trace Foundation (4-6 weeks)

**Goal:** Capture every significant decision

```
New Tables:
├── DecisionEvent       # Core decision log
├── DecisionContext     # Rich context capture
└── DecisionOutcome     # What happened after

Changes to Existing:
├── Add policyVersion to Order, Wave, etc.
├── Add approvedBy to status changes
└── Add reasonCode to all updates
```

**Effort:** Medium
**Risk:** Low (additive, doesn't break existing)

### Phase 2: Policy Engine (4-6 weeks)

**Goal:** Externalize business rules

```
New Tables:
├── Policy              # Rule definitions
├── PolicyVersion       # Version history
├── PolicyThreshold     # Configurable limits
└── PolicyViolation     # When rules broken

New Service:
└── PolicyEngine        # Evaluate rules at runtime
```

**Effort:** Medium-High
**Risk:** Medium (requires refactoring business logic)

### Phase 3: AI Agent Layer (6-8 weeks)

**Goal:** Implement agentic capabilities

```
New Tables:
├── AgentAction         # What agent did
├── AgentSuggestion     # What agent recommends
├── AgentFeedback       # Human feedback on suggestions
└── AgentLearning       # Patterns learned

New Services:
├── AllocationAgent     # Suggest order allocation
├── ForecastAgent       # Demand predictions
├── ExceptionAgent      # Handle NDR, returns
└── AgentOrchestrator   # Coordinate agents
```

**Effort:** High
**Risk:** Medium (new territory)

### Phase 4: Context Graph (8-12 weeks)

**Goal:** Searchable precedent database

```
New Tables:
├── Precedent           # Past decisions
├── PrecedentEmbedding  # Vector embeddings
└── PrecedentMatch      # When precedent used

New Services:
├── EmbeddingService    # Generate embeddings
├── SimilaritySearch    # Find similar decisions
└── PrecedentSuggester  # Suggest relevant history
```

**Effort:** High
**Risk:** High (requires ML/embedding infrastructure)

---

## Part 6: Distance Assessment

### How Close Are You?

| Layer | You Have | You Need | Distance |
|-------|----------|----------|----------|
| **Operational OMS** | 80% | 100% | Close |
| **Decision Logging** | 5% | 100% | Far |
| **Policy Engine** | 0% | 100% | Far |
| **AI Suggestions** | 10% (enums) | 100% | Far |
| **Human-in-Loop** | 5% (enums) | 100% | Far |
| **Precedent Search** | 0% | 100% | Very Far |
| **Full Agentic S&OP** | 5% | 100% | Very Far |

### Realistic Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Decision Trace MVP | 4-6 weeks | 6 weeks |
| Policy Engine MVP | 4-6 weeks | 12 weeks |
| AI Agent MVP | 6-8 weeks | 20 weeks |
| Context Graph MVP | 8-12 weeks | 32 weeks |
| **Full Vision** | **32-40 weeks** | **~8 months** |

---

## Part 7: Strategic Options

### Option A: Build Decision Layer First

**Approach:** Add decision traces to current OMS
**Advantage:** Compounds value, differentiates product
**Disadvantage:** Longer to "agentic AI"
**Best for:** Building defensible moat

### Option B: Build AI Features First

**Approach:** Add AI suggestions without full decision traces
**Advantage:** Faster to demo AI
**Disadvantage:** No learning loop, no precedent
**Best for:** Quick market validation

### Option C: Focused Vertical Agent

**Approach:** Build one agent well (e.g., NDR Resolution)
**Advantage:** Fastest to production value
**Disadvantage:** Narrow scope
**Best for:** Proving the thesis

### Recommendation: Option C → A

1. **Start with NDR Agent** (you already have enums!)
   - NDR is exception-heavy (perfect for decision traces)
   - Clear outcome measurement (delivery success)
   - Human-in-loop natural (customer contact)

2. **Add Decision Traces to NDR**
   - Every NDR resolution = decision event
   - Track what worked, what didn't
   - Build precedent database for this domain

3. **Expand Pattern to Other Domains**
   - Allocation decisions
   - Forecast overrides
   - Credit decisions

---

## Summary

### What You Have
- Solid tech stack (FastAPI, PostgreSQL, SQLModel)
- Rich data model (79 tables)
- Multi-tenancy built in
- AI enums already defined
- Good architecture (backend-centric)

### What's Missing
- Decision event logging
- Policy/rule engine
- Approval workflows
- Precedent storage
- AI agent implementation
- Explainability layer

### Distance to Vision

```
Current State        Vision
     │                  │
     ├─ Operational OMS │
     │  ████████████░░░░│ 80%
     │                  │
     ├─ Decision Traces │
     │  █░░░░░░░░░░░░░░░│ 5%
     │                  │
     ├─ AI Agents       │
     │  ██░░░░░░░░░░░░░░│ 10%
     │                  │
     ├─ Context Graph   │
     │  ░░░░░░░░░░░░░░░░│ 0%
     │                  │
     └─ Full Agentic    │
        ██░░░░░░░░░░░░░░│ 10%
```

**You are:** At the starting line with good equipment
**Time to MVP:** 3-4 months for meaningful decision traces
**Time to Full Vision:** 8-10 months

---

## Next Steps

1. **Immediate:** Design DecisionEvent schema
2. **Week 1-2:** Implement decision logging for one domain (NDR?)
3. **Week 3-4:** Add policy versioning
4. **Week 5-8:** Build first AI agent (NDR Resolution)
5. **Week 9-12:** Add precedent search
6. **Ongoing:** Expand to other domains
