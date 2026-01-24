# o9 Agentic AI Deep Dive: Architecture & Decision Traces Gap

> Research Date: 2026-01-18

---

## Executive Summary

o9 has built the most sophisticated agentic planning system in the market. However, there's a **critical gap** between what o9 captures (operational knowledge and patterns) and what the "decision traces" thesis describes (governance context, approval chains, searchable precedent).

**Key Finding:** o9 captures **what to do** (expert recipes, patterns, optimization). The opportunity is capturing **how and why decisions were made** (the governance layer).

---

## Part 1: o9 Agentic Architecture

### The Stack

```
┌─────────────────────────────────────────┐
│          Composite Agents               │  ← Orchestrate complex workflows
│    (Cross-functional planning)          │
├─────────────────────────────────────────┤
│           Atomic Agents                 │  ← Specific tasks (analysis, retrieval)
│    (Data, forecasting, diagnosis)       │
├─────────────────────────────────────────┤
│    Enterprise Knowledge Graph (EKG)     │  ← Memory + Context + Relationships
│         + Large Knowledge Model         │
├─────────────────────────────────────────┤
│         Graph-Cube Technology           │  ← In-memory, real-time processing
├─────────────────────────────────────────┤
│     Data Layer (SAP, Oracle, etc.)      │  ← ETL, connectors, harmonization
└─────────────────────────────────────────┘
```

### Atomic Agents

Individual AI units that perform specific tasks:
- Retrieve information from EKG
- Analyze data patterns
- Generate responses to queries
- Mine unstructured data (transcripts, documents)

### Composite Agents

Orchestrate multiple atomic agents for complex workflows:
- Trained on "recipes" from planning experts
- Sequence atomic agents to achieve business outcomes
- Learn from feedback and improve over time
- Operate within EKG context

**Example Workflow:**
```
Composite Agent: "Investigate $300M inventory spike"
  ├── Atomic Agent 1: Query EKG for inventory data
  ├── Atomic Agent 2: Identify high-risk SKUs (80/20)
  ├── Atomic Agent 3: Analyze forecast vs actual
  ├── Atomic Agent 4: Root-cause diagnosis
  └── Composite Agent: Synthesize findings + recommend actions
```

### Enterprise Knowledge Graph (EKG)

The foundational layer that enables everything:

| What It Stores | How It's Used |
|----------------|---------------|
| Data relationships | Graph-based, not siloed |
| Constraints | Business rules, limits |
| Tribal knowledge | Expert recipes, patterns |
| Digital twin | Real-time enterprise state |
| Cross-functional context | Sales, supply, finance, procurement |

**Key Innovation:** Graph-Cube technology allows real-time processing vs. batch ETL.

---

## Part 2: What o9 Captures (And Doesn't)

### What o9 DOES Capture

| Capability | Description | Status |
|------------|-------------|--------|
| **Expert Recipes** | How experts solve problems, digitized via GenAI | Production |
| **Plan vs Actual** | Deviations between planned and realized | Production |
| **Root Cause Analysis** | Why KPIs were missed | Production |
| **Pattern Learning** | Accumulated knowledge from cycles | Production |
| **Tribal Knowledge** | From emails, docs, Teams chat | Production |

### The "Decision Replay System"

o9's approach to decision learning:

```
Planning Decision → Execution → Outcome
        ↓                           ↓
        └─────── Comparison ────────┘
                     ↓
            Root Cause Analysis
                     ↓
            Corrective Recommendations
                     ↓
            Model Improvement
```

**What This Captures:**
- What decisions were made (the outputs)
- What actually happened (the outcomes)
- Why there was a gap (causal analysis)
- How to improve (recommendations)

### What o9 Does NOT Capture (The Gap)

Based on research, o9's public documentation does **NOT** describe:

| Decision Trace Element | o9 Status |
|------------------------|-----------|
| Who approved the decision | Not documented |
| What policy version was applied | Not documented |
| What exception was invoked | Not documented |
| What precedent was referenced | Not documented |
| Why exception was allowed | Not documented |
| Approval chain / governance | Not documented |

---

## Part 3: Foundation Capital's "Decision Traces" Thesis

### The Core Argument

From Jaya Gupta (Foundation Capital, Dec 2025):

> "The next trillion-dollar platforms will be built by capturing **decision traces** - the exceptions, overrides, precedents, and cross-system context that currently live in Slack threads, deal desk conversations, escalation calls, and people's heads."

### What Decision Traces Capture

| Element | Description |
|---------|-------------|
| **What inputs were gathered** | Which data sources, which systems |
| **What policy was evaluated** | Version, parameters, thresholds |
| **What exception was invoked** | Deviation from standard process |
| **Who approved** | Approval chain, authority level |
| **What precedent was referenced** | Past decisions that informed this one |
| **What state was written** | The outcome, the change made |

### Why This Matters for Agents

> "AI agents don't just need rules. They need access to the **decision traces** that show how rules were applied in the past."

Without decision traces, agents can't:
- Know when an exception is appropriate (no precedent)
- Understand why similar cases were handled differently
- Act autonomously with confidence (no approval patterns)
- Learn the "real rules" vs. the "documented rules"

---

## Part 4: The Critical Gap

### Side-by-Side Comparison

| Dimension | o9 EKG | Context Graph Thesis |
|-----------|--------|----------------------|
| **Primary Focus** | Operational planning | Decision governance |
| **Core Question** | "What should we do?" | "How were past decisions made?" |
| **Knowledge Type** | Patterns, recipes, outcomes | Traces, approvals, precedents |
| **Learning From** | Plan vs actual deviations | Decision lineage and context |
| **Searchability** | Knowledge patterns | Specific precedents |
| **Governance** | Not emphasized | Central focus |

### What This Means

**o9 captures:** "In Q3, we had a forecast override that led to $50M excess inventory."

**Decision traces would capture:** "In Q3, John (VP Supply) approved a 20% forecast override based on a customer verbal commitment, referencing the similar Q1 situation where this worked. Policy 4.2.1 allows VP-level overrides up to 25%. The customer confirmed order came in at 80% of expected."

### The Missing Layer

```
┌─────────────────────────────────────────┐
│        WHAT O9 HAS TODAY                │
│  ┌─────────────────────────────────┐    │
│  │  Expert Recipes                 │    │
│  │  Pattern Recognition            │    │
│  │  Plan vs Actual Analysis        │    │
│  │  Root Cause Diagnosis           │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
                    ↓
         THE MISSING LAYER
                    ↓
┌─────────────────────────────────────────┐
│     DECISION GOVERNANCE CONTEXT         │
│  ┌─────────────────────────────────┐    │
│  │  Who approved this?             │    │
│  │  Under what policy?             │    │
│  │  What exception was granted?    │    │
│  │  What precedent was cited?      │    │
│  │  Why was this allowed?          │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

---

## Part 5: Why This Gap Is The Opportunity

### Foundation Capital's Structural Advantage Argument

> "Systems of agents startups have a structural advantage - they sit in the execution path. They see what inputs were gathered across systems, what policy was evaluated, what exception route was invoked, who approved, and what state was written. If you persist those traces, you get a queryable record of how decisions were made."

### Why o9 May Not Fill This Gap

1. **Focus:** o9 is optimizing planning, not governing decisions
2. **Architecture:** EKG is a digital twin of operations, not a decision ledger
3. **Value Prop:** They sell "touchless planning," not "decision auditability"
4. **Market:** Enterprise planning software, not governance/compliance

### The Startup Opportunity

Build the **decision trace layer** that sits:
- Above ERP/planning systems (captures their outputs)
- In the workflow (sees approvals, exceptions, precedents)
- Across functions (not siloed to supply chain)

This layer becomes:
- The context that makes AI agents smarter
- The audit trail enterprises need
- The learning loop that compounds value
- Potentially: the platform that incumbents integrate with

---

## Part 6: What o9 Gets Right (And Can Be Learned From)

### Tribal Knowledge Digitization

o9's approach to capturing expert knowledge:

1. **Expert Replay:** Experts show what they would do, LLMs capture it
2. **Conversational Training:** Simple dialogue to extract recipes
3. **Unstructured Data Mining:** Pull from emails, docs, Teams
4. **Pattern Accumulation:** Each cycle adds knowledge

**Lesson:** Capturing tacit knowledge is possible and valuable.

### Neural-Symbolic AI

o9 combines:
- **Neural AI:** Learning, pattern recognition, intuition
- **Symbolic AI:** Rules, constraints, explainability

**Lesson:** Hybrid approaches work better than pure LLM.

### Closed-Loop Learning

```
Plan → Execute → Measure → Analyze → Improve → Plan
```

**Lesson:** The feedback loop is essential for compounding value.

---

## Part 7: Implications for S&OP Opportunity

### If Building in This Space

**Don't compete on:**
- Optimization (o9 is excellent)
- Scenarios (Kinaxis owns this)
- ERP integration (SAP has ecosystem)

**Compete on:**
- Decision trace capture (no one does this well)
- Governance context (who approved what, why)
- Searchable precedent (what happened last time)
- SMB accessibility (all incumbents are enterprise)

### The Value Prop

> "We don't just help you make better planning decisions. We capture HOW decisions were made - the exceptions, approvals, precedents, and context. Your AI gets smarter because it knows not just what happened, but why it was allowed to happen."

### Potential Architecture

```
┌─────────────────────────────────────────┐
│         User Workflow Layer             │
│   (Where decisions are made/approved)   │
├─────────────────────────────────────────┤
│        Decision Trace Capture           │  ← THE NEW LAYER
│  • Who approved                         │
│  • What policy                          │
│  • What exception                       │
│  • What precedent                       │
├─────────────────────────────────────────┤
│        Context Graph / Memory           │
│  • Searchable precedent                 │
│  • Decision lineage                     │
│  • Governance patterns                  │
├─────────────────────────────────────────┤
│         AI Agent Layer                  │
│  • Pattern-match against precedent      │
│  • Suggest based on history             │
│  • Explain reasoning                    │
├─────────────────────────────────────────┤
│      Integration Layer                  │
│  (ERP, Planning, existing systems)      │
└─────────────────────────────────────────┘
```

---

## Summary

| Aspect | o9 Today | The Gap/Opportunity |
|--------|----------|---------------------|
| **Knowledge** | Expert recipes, patterns | Decision governance context |
| **Learning** | From outcomes | From decision traces |
| **Searchable** | Knowledge patterns | Specific precedents |
| **Explainability** | Why deviation happened | Why decision was allowed |
| **Governance** | Not emphasized | Central focus |
| **Agent Autonomy** | Within trained recipes | Based on precedent matching |

**Bottom Line:** o9 is the best at "what to do." The opportunity is "how and why decisions were made" - the governance layer that enables true agent autonomy.

---

## Key Sources

- o9 Solutions documentation (Digital Brain, EKG, Composite Agents)
- Foundation Capital: "AI's Trillion-Dollar Opportunity: Context Graphs" (Dec 2025)
- aim10x Europe 2025 announcements
- ComputerWeekly: o9 agentic functions analysis
- Gartner Magic Quadrant for Supply Chain Planning
