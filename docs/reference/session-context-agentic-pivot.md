# Session Context: Agentic AI Pivot Strategy

> Date: 2026-01-18
> Purpose: Capture strategic discussion for continuation in future sessions

---

## Who is Puneet

Founder and entrepreneur. Tech savvy. Deeply interested in AI's impact on work, productivity, business, and innovation.

**Current investments:**
1. **CJ Darcl** - Family business (logistics). Limited influence, hard to drive change in decision-making.
2. **Fretron** - TMS (Transportation Management System) product. Currently hard sell, sees it shrinking in importance.

**The challenge:** Needs a product pivot. Trying to build a mental model of the world 3-4 years out with AI.

---

## The Strategic Question

Puneet is exploring whether to build an **agentic AI platform with decision traces** in the supply chain space.

### Core beliefs:
- AI labs will have significant power
- What happened to coding will happen to all functions
- Agentic AI is definitely the direction
- The "decision traces" thesis (Jaya Gupta / Foundation Capital) is compelling

### The uncertainty:
- Which domain to bet on?
- Is TMS the right place to start, or does he need to move up the stack?
- What's the immediate validation path?

---

## The TMS Problem (Key Insight)

Puneet raised a critical go-to-market constraint:

> "Whenever I talk to supply chain leaders or C-suite people, the transport management is usually delegated down three levels, and they don't even want to engage around it."

**The implication:** TMS is a "manager buys, manager uses" tool. Hard to create a VC-scale story when your buyer is 3 levels down from decision-makers.

### Buyer Level by Function

| Function | Who buys | Budget level | C-suite cares? |
|----------|----------|--------------|----------------|
| S&OP / IBP | Chief Supply Chain Officer | $1M+ | Yes - it's their job |
| Procurement | CFO / CPO | $500K+ | Yes - direct margin impact |
| Demand Planning | VP Supply Chain | $200K+ | Yes - revenue/inventory |
| Visibility | CSCO / COO | $200K+ | Yes - risk, customer experience |
| **TMS** | **Logistics Manager** | **$50-100K** | **No - delegated** |
| WMS | Warehouse Director | $100-200K | Rarely |

---

## Two Strategic Paths Identified

### Path A: Elevate TMS to C-suite conversation
- project44/FourKites did this by reframing transport as "customer experience risk" and "supply chain visibility"
- But that took $500M+ in funding and years of market education
- Requires reframing from "move trucks efficiently" to "customer delivery experience" or "supply chain risk"

### Path B: Move up the stack
- Use TMS as data source and domain expertise
- Sell into S&OP / demand-supply matching where C-suite engages
- Fretron's transport data becomes an *input* to a bigger decision
- Target the functions where decisions are strategic, not operational

**Open question:** Which path feels more honest to where Fretron could actually win?

---

## The Decision Traces Thesis

### Jaya Gupta (Foundation Capital) - "Context Graphs"
> "The next trillion-dollar platforms will be built by capturing decision traces - the exceptions, overrides, precedents, and cross-system context that currently live in Slack threads, deal desk conversations, escalation calls, and people's heads."

### Prukalpa Sankar (Atlan) - "Context is King"
> "In 1996, Bill Gates wrote 'content is king.' In 2025, context is king. AI can't do anything without context."

### The synthesis:
- The valuable layer is not the AI that makes recommendations
- It's the **context that makes AI trustworthy**
- Capture **how and why decisions were made** (governance), not just what was decided

### The gap no one fills:
| What incumbents capture | What decision traces capture |
|------------------------|------------------------------|
| What to do (optimization) | How decisions were made |
| Patterns and recipes | Who approved, what policy |
| Plan vs actual deviations | What exception was granted |
| Root cause analysis | What precedent was referenced |

---

## Competitive Landscape Summary

### The Big Players

| Player | Focus | Funding | Target | Gap |
|--------|-------|---------|--------|-----|
| **o9 Solutions** | S&OP, AI-first | $533M, $3.7B val | Enterprise only | No SMB, no decision traces |
| **Kinaxis** | Scenario planning | Public | Enterprise | No decision traces |
| **SAP IBP** | ERP integration | SAP ecosystem | Enterprise | 67% implementations stall |
| **project44** | Visibility | $912M | Enterprise | Maturing, less upside |
| **Zip** | Procurement AI | $190M, $2.2B val | Enterprise | 50+ agents, hot category |

### White Space

1. **SMB S&OP** - All players enterprise-focused ($100K+ entry)
2. **Decision trace capture** - No one captures governance context
3. **Fast time-to-value** - Even fastest (Kinaxis) is 12 weeks
4. **TMS elevated to strategic** - Only project44/FourKites attempted, took massive funding

---

## CJD OMS Technical Foundation

Puneet has built a CJD Quick OMS application that could serve as foundation:

### Stack
- **Backend:** FastAPI + SQLModel (SQLAlchemy + Pydantic)
- **Database:** PostgreSQL (Supabase) - 79 tables
- **Frontend:** Next.js (thin proxy layer)
- **Multi-tenancy:** Built-in (companyId on all tables)

### AI Readiness
Already defined but not implemented:
```python
class AIActionType(str, Enum):
    NDR_CLASSIFICATION = "NDR_CLASSIFICATION"
    NDR_RESOLUTION = "NDR_RESOLUTION"
    FRAUD_DETECTION = "FRAUD_DETECTION"
    DEMAND_FORECAST = "DEMAND_FORECAST"
    CARRIER_SELECTION = "CARRIER_SELECTION"

class AIActionStatus(str, Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXECUTED = "EXECUTED"
    FAILED = "FAILED"
```

### Distance to Vision
```
Operational OMS:     ████████████░░░░ 80%
Decision Traces:     █░░░░░░░░░░░░░░░  5%
AI Agents:           ██░░░░░░░░░░░░░░ 10%
Context Graph:       ░░░░░░░░░░░░░░░░  0%
```

---

## Reference Documents Created

All in `docs/reference/`:

| Document | Content |
|----------|---------|
| `repricing-of-software.md` | SaaS disruption thesis - AI changing pricing models |
| `agentic-ai-opportunity-analysis.md` | Full opportunity evaluation across domains |
| `startup-pitch-narratives.md` | Pitch patterns from Harvey, Sierra, Cognition, etc. |
| `scp-platform-comparison.md` | o9 vs Kinaxis vs SAP IBP detailed comparison |
| `o9-agentic-deep-dive.md` | o9 architecture vs decision traces thesis |
| `o9-fmcg-explainer.md` | o9 components illustrated with FMCG scenario |
| `cjd-oms-agentic-assessment.md` | CJD OMS readiness assessment |
| `funded-startups-landscape.md` | 25+ funded startups analysis |
| `agentic-sop-research-synthesis.md` | Executive synthesis of all research |

---

## Key Questions Still Open

1. **Path choice:** Elevate TMS to C-suite, or move up the stack to S&OP?

2. **Validation:** What's the smallest experiment to prove decision traces create value?

3. **Go-to-market:** How to get C-suite engagement without $500M in funding?

4. **Fretron pivot:** Can existing TMS data become input to a strategic decision layer?

5. **Timeline:** How fast is the window? Is there time to experiment or need to commit?

---

## Puneet's Patterns to Note

From his CLAUDE.md:
- Tends toward analysis paralysis - researching one more thing
- Needs nudging toward action
- The right question unlocks action
- When circling, ask: "What would you need to know to make a decision?"

**Current state:** Has done extensive research. The constraint is clear (TMS = delegated buyer). The paths are identified (elevate TMS vs move up stack). Needs to choose and act.

---

## Suggested Next Session Focus

Instead of more research, the next session should focus on:

1. **Decision:** Path A or Path B?
2. **If Path B:** What does "S&OP lite" look like that Fretron could build?
3. **Validation design:** What's the 2-week experiment to test the thesis?
4. **Story:** What's the one-liner that gets a CSCO to take a meeting?

The research phase is complete. The action phase needs to begin.
