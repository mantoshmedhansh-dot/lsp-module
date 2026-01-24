# Agentic S&OP Research Synthesis

> Date: 2026-01-18
> Purpose: Executive summary of strategic research for decision trace S&OP platform

---

## The Core Thesis

### Jaya Gupta (Foundation Capital) - "Context Graphs"
> "The next trillion-dollar platforms will be built by capturing **decision traces** - the exceptions, overrides, precedents, and cross-system context that currently live in Slack threads, deal desk conversations, escalation calls, and people's heads."

### Prukalpa Sankar (Atlan) - "Context is King"
> "In 1996, Bill Gates wrote 'content is king.' In 2025, you can actually say in this new era, **context is king**. AI can't do anything without context."

### The Synthesis
Both are saying the same thing differently:
- Jaya: Capture **how decisions were made** (governance)
- Prukalpa: Capture **business meaning around data** (metadata)

**Combined insight:** The valuable layer is not the AI that makes recommendations - it's the context that makes AI trustworthy.

---

## The Market Gap

### What Incumbents Do Well

| Player | Strength | Score |
|--------|----------|-------|
| **o9 Solutions** | Optimization, EKG, Composite Agents | 9/10 |
| **Kinaxis** | Scenario planning, speed, concurrent planning | 9/10 |
| **SAP IBP** | ERP integration, ecosystem | 7/10 |
| **project44** | Real-time visibility | 9/10 |
| **Zip** | Procurement agentic automation | 8/10 |

### What No One Does

| Gap | Description | Opportunity Score |
|-----|-------------|-------------------|
| **Decision Trace Capture** | Who approved, what policy, what exception, what precedent | 10/10 |
| **SMB S&OP** | All players enterprise-only, $100K+ entry | 9/10 |
| **Fast Time-to-Value** | Even fastest is 12 weeks | 8/10 |
| **Outcome Pricing** | Everyone on seat-based SaaS | 7/10 |
| **Cross-functional Context** | Siloed by demand, supply, finance | 8/10 |

---

## CJD OMS Position

### Current State
```
Operational OMS:     ████████████░░░░ 80%
Decision Traces:     █░░░░░░░░░░░░░░░  5%
AI Agents:           ██░░░░░░░░░░░░░░ 10%
Context Graph:       ░░░░░░░░░░░░░░░░  0%
Full Agentic S&OP:   ██░░░░░░░░░░░░░░ 10%
```

### Stack Readiness

| Component | Status | Agentic Ready? |
|-----------|--------|----------------|
| FastAPI Backend | Production | Excellent |
| PostgreSQL (JSON, ARRAY) | Production | Excellent |
| SQLModel ORM | Production | Excellent |
| Multi-tenancy | Built-in | Ready |
| AI Enums (AIActionType, AIActionStatus) | Defined | Ready for implementation |
| Decision Event Logging | Not implemented | Critical gap |
| Policy Engine | Not implemented | Major gap |
| Precedent Storage | Not implemented | Major gap |

### Recommended Path

**Phase 1: NDR Agent (Weeks 1-8)**
- Already have AIActionType.NDR_CLASSIFICATION, NDR_RESOLUTION
- Exception-heavy domain (perfect for decision traces)
- Clear outcome measurement (delivery success)
- Human-in-loop natural (customer contact decisions)

**Phase 2: Decision Event Schema (Weeks 1-4 parallel)**
```python
class DecisionEvent(BaseModel, table=True):
    entityType: str      # "Order", "Wave", "NDR"
    entityId: UUID
    decisionType: str    # "STATUS_CHANGE", "OVERRIDE", "EXCEPTION"
    previousValue: dict
    newValue: dict
    decidedBy: UUID
    approvedBy: UUID
    policyId: UUID
    exceptionGranted: bool
    precedentRef: UUID
    reasoning: str
    metadata: dict
```

**Phase 3: Expand to Other Domains (Weeks 9-20)**
- Allocation decisions
- Forecast overrides
- Credit decisions

**Phase 4: Context Graph (Weeks 21-32)**
- Precedent database
- Embedding/vector search
- Similarity matching

---

## VC Narrative Options

### Option A: "The Decision Layer"
> "We capture the decision traces that power S&OP. Not just the numbers, but how conflicts were resolved, who approved what, which precedents govern reality. We make this searchable."

**Proof points needed:**
- X% faster consensus in S&OP meetings
- Y decisions captured and reused per cycle
- Z% reduction in repeated exception discussions

### Option B: "SMB-First S&OP"
> "o9 and Kinaxis are excellent for Fortune 500. We're building S&OP for the other 28 million businesses. Start in days, not months. Pay for outcomes, not seats."

**Proof points needed:**
- Time to value (days vs weeks)
- Entry cost (<$10K vs $100K+)
- Self-service adoption rate

### Option C: "The Obsolescence Pivot"
> "We realized our OMS was going to be made obsolete by AI. Instead of waiting to be disrupted, we became the disruptor. We went from tracking orders to making decisions."

**Proof points needed:**
- Revenue from AI product vs SaaS
- Growth trajectory comparison
- Customer outcome metrics

---

## Competitive Positioning Matrix

```
                    GOVERNANCE FOCUS
                         HIGH
                          │
                          │
         [WHITE SPACE]    │    [COMPLIANCE/GRC]
         Decision Traces  │
         + SMB S&OP       │
                          │
 SMB ─────────────────────┼───────────────────── ENTERPRISE
                          │
                          │
         [BASIC TOOLS]    │    [o9/KINAXIS]
         Spreadsheets     │    Optimization
         Basic S&OP       │    Enterprise planning
                          │
                         LOW
```

**Target Position:** Upper-left quadrant - Governance focus for SMB/mid-market.

---

## Key Reference Documents

| Document | Purpose |
|----------|---------|
| `agentic-ai-opportunity-analysis.md` | Full opportunity evaluation |
| `startup-pitch-narratives.md` | Pitch patterns and templates |
| `scp-platform-comparison.md` | o9 vs Kinaxis vs SAP IBP |
| `o9-agentic-deep-dive.md` | o9 architecture analysis |
| `o9-fmcg-explainer.md` | o9 components illustrated |
| `cjd-oms-agentic-assessment.md` | Current stack assessment |
| `funded-startups-landscape.md` | Competitive funding landscape |
| `repricing-of-software.md` | SaaS disruption thesis |

---

## Decision Points

### Strategic Questions to Resolve

1. **Target Market**
   - [ ] Enterprise (compete with o9/Kinaxis)
   - [ ] Mid-market (underserved)
   - [ ] SMB (no one serves)

2. **Entry Point**
   - [ ] S&OP decision layer (horizontal)
   - [ ] NDR/exceptions (vertical, narrow)
   - [ ] Demand-supply matching (functional)

3. **Business Model**
   - [ ] SaaS per user
   - [ ] Outcome-based (per decision)
   - [ ] Consumption-based

4. **Build vs Partner**
   - [ ] Build optimization (compete with o9)
   - [ ] Build decision layer (complement o9)
   - [ ] Partner/integrate

### Recommended Strategy

**Start narrow, prove the thesis:**
1. Build NDR agent with decision traces
2. Show value in one domain (delivery exceptions)
3. Expand to adjacent decisions (allocation, forecasting)
4. Position as "decision layer" that complements existing systems

**Why this works:**
- Low implementation risk (builds on existing OMS)
- Clear outcome metrics (delivery success rate)
- Natural human-in-loop workflow
- Expandable to full S&OP thesis

---

## Summary

| Dimension | Assessment |
|-----------|------------|
| **Market Opportunity** | Large ($100B+ TAM in supply chain software) |
| **Gap Existence** | Validated (no one captures decision traces) |
| **Technical Readiness** | Foundation exists (FastAPI, PostgreSQL, AI enums) |
| **Distance to MVP** | 3-4 months for meaningful decision traces |
| **Distance to Full Vision** | 8-10 months |
| **Competitive Moat** | Decision context (compounds over time) |
| **VC Narrative** | Strong (aligns with Foundation Capital, Atlan theses) |

**Bottom Line:** The opportunity is real, the gap is validated, the foundation exists. The question is execution priority and go-to-market strategy.

