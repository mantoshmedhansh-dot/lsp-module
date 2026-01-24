# Decision Traces & Context Graphs: CJD OMS Mapping

> Date: 2026-01-19
> Purpose: Map three frameworks to CJD OMS current state and gaps

---

## The Three Frameworks

### 1. Jaya Gupta (Foundation Capital) - "Decision Traces"

> "The next trillion-dollar platforms will be built by capturing decision traces - the exceptions, overrides, precedents, and cross-system context."

**What decision traces capture:**
- Who approved this decision?
- What policy version was applied?
- What exception was invoked?
- What precedent was referenced?
- Why was this allowed?

---

### 2. Animesh Koratana (PlayerZero) - "Two Clocks Problem"

> "We've built trillion-dollar infrastructure for what's true now. Almost nothing for why it became true."

**Two types of infrastructure:**

| State Clock | Event Clock |
|-------------|-------------|
| What is true NOW | What HAPPENED and WHY |
| CRM deal value | Why the deal was priced that way |
| Ticket status: "Resolved" | How it was resolved, by whom, what was tried |
| Order status: "SHIPPED" | Why this carrier was chosen, who approved exception |

**Key insight:** Context graphs are NOT databases. They require probabilistic joining across 5 incompatible geometries:
1. Events (sequential)
2. Timeline (linear)
3. Semantics (vector space)
4. Attribution (graph-structured)
5. Outcomes (causal DAGs)

---

### 3. Prukalpa Sankar (Atlan) - "Context is King" (Counter-view)

> "In 2025, context is king. AI can't do anything without context."

**Her view differs slightly:**
- Focus on **metadata** and **business meaning** around data
- Less about capturing every decision, more about making existing data AI-ready
- The value is in **connecting** systems, not just logging decisions

**Practical implication:** Don't over-engineer decision capture. Focus on:
- What does this data mean?
- Who can access it?
- Where did it come from?
- How does it connect to other data?

---

## CJD OMS: Current State Analysis

### What You HAVE (State Clock - Strong)

Based on the code, CJD OMS captures **current state** well:

```
┌─────────────────────────────────────────────────────────────────┐
│                     CJD OMS STATE CLOCK                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Orders          → status: CREATED, CONFIRMED, SHIPPED...      │
│  NDRs            → status: OPEN, IN_PROGRESS, RESOLVED...      │
│  Deliveries      → current carrier, AWB, tracking status       │
│  Inventory       → current stock levels, locations             │
│  Detection Rules → current rules, conditions, thresholds       │
│  AI Action Logs  → what AI did, confidence, success/fail       │
│                                                                 │
│  ✅ You know WHAT IS TRUE NOW                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**AIActionLog captures:**
```python
- entityType: "NDR", "Order", "Delivery"
- entityId: which specific entity
- actionType: "AUTO_CLASSIFY", "AUTO_OUTREACH", "AUTO_RESOLVE"
- actionDetails: JSON blob of what happened
- status: SUCCESS, FAILED, PENDING
- confidence: 0.85
- processingTime: 1200ms
```

**DetectionRule captures:**
```python
- conditions: [{"field": "status", "operator": "=", "value": "CREATED"}]
- severityRules: {"CRITICAL": 24, "HIGH": 12}
- aiActionEnabled: true
- aiActionType: "AUTO_ESCALATE"
- executionCount: 1547
- exceptionsCreated: 89
```

---

### What You're MISSING (Event Clock - Gap)

```
┌─────────────────────────────────────────────────────────────────┐
│                     CJD OMS EVENT CLOCK                        │
│                         (MISSING)                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ❌ WHO approved the carrier exception?                         │
│  ❌ WHAT policy version was active when this decision was made? │
│  ❌ WHAT precedent was this decision based on?                  │
│  ❌ WHY was the standard rule overridden?                       │
│  ❌ WHAT alternatives were considered?                          │
│  ❌ HOW did the human modify the AI suggestion?                 │
│                                                                 │
│  You DON'T know WHY THINGS BECAME TRUE                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Concrete Examples in CJD OMS Context

### Example 1: NDR Resolution

**What you capture today:**
```json
{
  "entityType": "NDR",
  "entityId": "ndr-123",
  "actionType": "AUTO_RESOLVE",
  "status": "SUCCESS",
  "confidence": 0.87,
  "actionDetails": {
    "resolution": "REATTEMPT",
    "newDeliveryDate": "2026-01-20"
  }
}
```

**What decision traces would capture:**
```json
{
  "entityType": "NDR",
  "entityId": "ndr-123",
  "decisionType": "RESOLUTION",

  // THE MISSING PARTS:
  "decidedBy": "ai-agent",
  "approvedBy": "user-456",           // WHO approved
  "approvalLevel": "AGENT_OVERRIDE",

  "policyId": "ndr-policy-v3",        // WHAT policy
  "policyVersion": "3.2.1",

  "precedentRef": "ndr-089",          // WHAT precedent
  "precedentSimilarity": 0.92,
  "precedentOutcome": "SUCCESS",

  "reasoning": "Customer confirmed availability via WhatsApp. Similar case ndr-089 succeeded with reattempt.",

  "alternativesConsidered": [
    {"action": "REFUND", "score": 0.34, "rejected": "customer wants delivery"},
    {"action": "RTO", "score": 0.21, "rejected": "high value order"}
  ],

  "exceptionGranted": false,
  "overrideReason": null
}
```

---

### Example 2: Carrier Selection

**What you capture today:**
```json
{
  "order": "ORD-456",
  "carrier": "Delhivery",
  "awb": "DEL123456"
}
```

**What decision traces would capture:**
```json
{
  "entityType": "Order",
  "entityId": "ORD-456",
  "decisionType": "CARRIER_SELECTION",

  "decidedBy": "allocation-rule-engine",
  "approvedBy": null,                 // Auto-approved by rule

  "ruleApplied": "rule-pincode-priority",
  "ruleVersion": "2.1.0",

  "candidatesEvaluated": [
    {"carrier": "Delhivery", "score": 0.94, "reason": "best SLA for pincode"},
    {"carrier": "BlueDart", "score": 0.88, "reason": "slightly higher cost"},
    {"carrier": "Ekart", "score": 0.72, "reason": "longer transit time"}
  ],

  "factors": {
    "pincode_serviceability": 0.95,
    "carrier_performance_30d": 0.91,
    "cost_optimization": 0.85,
    "customer_preference": null
  },

  "precedentRef": null,
  "exceptionGranted": false
}
```

---

### Example 3: Exception Override

**This is where decision traces matter most:**

```json
{
  "entityType": "Order",
  "entityId": "ORD-789",
  "decisionType": "CARRIER_OVERRIDE",

  "decidedBy": "user-123",            // Human override
  "approvedBy": "user-123",           // Self-approved (within authority)

  "standardDecision": {
    "carrier": "Delhivery",
    "reason": "Rule: pincode-priority"
  },

  "overrideDecision": {
    "carrier": "BlueDart",
    "reason": "Customer specifically requested BlueDart"
  },

  "exceptionGranted": true,
  "exceptionType": "CUSTOMER_REQUEST",
  "exceptionPolicy": "policy-customer-override-v2",
  "authorityLevel": "OPERATIONS_MANAGER",

  "precedentRef": "ORD-234",
  "precedentNote": "Similar override approved last week for same customer",

  "outcome": null  // Filled after delivery completes
}
```

---

## The Prukalpa Counter-View Applied

Prukalpa would argue: **Don't over-engineer this.**

Instead of building a full decision trace system, focus on:

### 1. Make existing data AI-ready
```
Current: Order.status = "SHIPPED"
AI-ready: Order.status = "SHIPPED" +
          Order.statusHistory = [{status, timestamp, changedBy, reason}]
```

### 2. Connect systems
```
Current: NDR exists, Order exists, Delivery exists (separate)
Connected: NDR → links to → Delivery → links to → Order → links to → Customer history
```

### 3. Add business context
```
Current: carrier = "Delhivery"
With context: carrier = "Delhivery" +
              carrierPerformance = {last30d: 94%, thisCustomer: 88%} +
              selectionReason = "pincode-priority-rule"
```

**Her argument:** You don't need a separate "decision trace" system. You need your existing data to carry more context.

---

## Gap Assessment: CJD OMS

| Framework Element | CJD OMS Status | Gap |
|-------------------|----------------|-----|
| **State Clock** (what is true now) | ✅ Strong | None |
| **Event Clock** (what happened, why) | ❌ Missing | Major |
| **Who approved** | ❌ Not tracked | Major |
| **What policy** | ⚠️ Partial (rules exist, versions not tracked) | Medium |
| **What precedent** | ❌ Not tracked | Major |
| **Why allowed** | ❌ Not tracked | Major |
| **Alternatives considered** | ❌ Not tracked | Medium |
| **Override tracking** | ❌ Not tracked | Major |
| **AI-ready metadata** (Prukalpa) | ⚠️ Partial | Medium |

---

## Recommendation: Pragmatic Path

Given the three frameworks, here's the pragmatic path for CJD OMS:

### Phase 1: Add Event History (Low Effort, High Value)
Don't build a separate decision trace system. Add history to existing models:

```python
# Add to Order model
statusHistory: List[Dict] = []  # [{status, timestamp, changedBy, reason}]

# Add to NDR model
resolutionHistory: List[Dict] = []  # [{action, timestamp, decidedBy, approvedBy, reason}]

# Add to Delivery model
carrierSelectionLog: Dict = {}  # {candidates, selectedCarrier, reason, rule}
```

### Phase 2: Track Overrides (Medium Effort)
When someone overrides an AI suggestion or rule:

```python
class Override(BaseModel, table=True):
    entityType: str
    entityId: UUID
    standardDecision: Dict    # What the system would have done
    overrideDecision: Dict    # What the human chose
    overrideReason: str
    decidedBy: UUID
    approvedBy: UUID
    timestamp: datetime
```

### Phase 3: Link Precedents (Higher Effort)
When resolving similar cases, capture the reference:

```python
class PrecedentLink(BaseModel, table=True):
    entityType: str
    entityId: UUID
    precedentEntityId: UUID
    similarity: float
    outcome: str  # Did following precedent work?
```

---

## Key Insight

**Animesh's framing is most useful for you:**

You've built the state clock (what is true now). The gap is the event clock (why it became true).

But **Prukalpa's caution is valid:** Don't over-engineer. Start by adding history/context to your existing models, not by building a separate decision trace infrastructure.

**The 80/20:**
1. Add `statusHistory` arrays to key models (Order, NDR, Delivery)
2. Log the `reason` field on every status change
3. Track `overrides` as a first-class entity
4. Connect related entities (NDR → Order → Customer)

This gets you 80% of the decision trace value without building a separate context graph system.

---

## Sources

- [Foundation Capital: Context Graphs](https://foundationcapital.com/context-graphs-ais-trillion-dollar-opportunity/)
- [What Are Context Graphs, Really? (Subramanya N on Animesh Koratana)](https://subramanya.ai/2026/01/01/what-are-context-graphs-really/)
- Prukalpa Sankar podcasts and Atlan blog posts

