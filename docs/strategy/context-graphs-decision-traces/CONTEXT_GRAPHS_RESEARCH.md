# Context Graphs & Decision Traces: Complete Research Compendium

> **Purpose**: Comprehensive synthesis of the "trillion-dollar opportunity" debate across 18 source articles.
> **Last Updated**: January 2026

---

## Table of Contents

1. [The Core Debate](#the-core-debate)
2. [Primary Sources](#primary-sources)
3. [Technical Deep-Dives](#technical-deep-dives)
4. [Domain Applications](#domain-applications)
5. [Implementation Frameworks](#implementation-frameworks)
6. [Key Concepts Glossary](#key-concepts-glossary)
7. [Source Links](#source-links)

---

## The Core Debate

### The Trillion-Dollar Question

> "The last generation of enterprise software became trillion-dollar platforms by becoming systems of record—Salesforce for customers, Workday for employees, SAP for operations. The next generation will be systems of record for decisions—not what data exists, but why it was acted on."
> — Jaya Gupta, Foundation Capital

### Three Competing Theses

| Thesis | Proponent | Core Argument | Who Wins |
|--------|-----------|---------------|----------|
| **Systems of Record Evolve** | Jamin Ball | Agents raise the bar for data quality, not replace SORs | Existing platforms with semantic contracts |
| **Vertical Agents Own Context** | Jaya Gupta | Whoever sits in execution path captures decision traces | Domain-specific agent startups |
| **Integrators Win** | Prukalpa (Atlan) | Heterogeneity means no vertical can see full context | Universal context platforms |

### The Synthesis View

Ed Sim (Boldstart Ventures) synthesizes:
> "Models don't create leverage on their own—the execution intelligence layer does. The moat isn't the query-response interaction—it gets much stronger when workflows are automated, when humans are pulled into decision-making, when exceptions are handled, and when systems learn from those outcomes."

---

## Primary Sources

### 1. Jamin Ball — "Long Live Systems of Record"
**Source**: [Clouded Judgement Newsletter](https://cloudedjudgement.substack.com/p/clouded-judgement-121225-long-live)

**Key Arguments**:

- Agents are **cross-system** (orchestrating across CRM, CPQ, billing) and **action-oriented** (changing state, not just reporting)
- This combination demands clarity about which system owns which truth
- "Agents will happily automate total chaos if your source of truth is fuzzy"

**The Emerging Architecture**:
```
┌─────────────────────────────────────────┐
│         SEMANTIC CONTRACTS              │
│  "official_arr" = Finance's number      │
│  "sales_arr" = Sales' number            │
│  "product_arr" = Product's number       │
└─────────────────────────────────────────┘
              ↓ serves
┌─────────────────────────────────────────┐
│         DATA SUBSTRATE                  │
│    Warehouses storing canonical facts   │
└─────────────────────────────────────────┘
              ↓ feeds
┌─────────────────────────────────────────┐
│         CONTROL PLANES                  │
│   Policies for access/modification      │
└─────────────────────────────────────────┘
              ↓ enforces
┌─────────────────────────────────────────┐
│      OPERATIONAL SYSTEMS (APIs)         │
│   CRM, ERP as "state machines"          │
└─────────────────────────────────────────┘
```

**Bottom Line**: "Agents are not replacing systems of record. They are raising the standards for what constitutes a solid one."

---

### 2. Jaya Gupta & Ashu Garg — "Context Graphs: AI's Trillion-Dollar Opportunity"
**Source**: [Foundation Capital](https://foundationcapital.com/context-graphs-ais-trillion-dollar-opportunity/) | [LinkedIn](https://www.linkedin.com/pulse/ais-trillion-dollar-opportunity-context-graphs-jaya-gupta-cobue)

**Key Distinction — Rules vs Decision Traces**:

| Type | Example | Limitation |
|------|---------|------------|
| **Rule** | "Max 10% discount for new customers" | Doesn't handle exceptions |
| **Decision Trace** | "We gave 15% because they're referral from biggest client, VP approved" | Captures the WHY and PRECEDENT |

**Why Vertical Agents Have Structural Advantage**:
```
At decision time, the agent sees:
├── What inputs were gathered (from 6 systems)
├── What policy was evaluated
├── What exception route was invoked
├── Who approved
├── What state was written
└── What outcome resulted

This complete trace ONLY exists in the execution path.
```

**Why Incumbents Can't Build This**:
- **Operational platforms** (Salesforce): Built around current state, not decision lineage
- **Warehouse players** (Snowflake): Only see data post-decision via ETL

**Three Startup Paths**:
1. **Full replacement**: AI-native CRM/ERP (Regie replacing Outreach)
2. **Module replacement**: Specific decision workflows (Maximor for cash/close)
3. **New systems of record**: Orchestration → authority (PlayerZero for engineering)

**Signal Detection for High-Value Domains**:
- 50+ people doing routing/triaging = automatable complex logic
- "Glue functions" at system intersections (RevOps, DevOps, Security Ops)

---

### 3. Prukalpa (Atlan) — "Who Actually Captures the Trillion Dollars?"
**Source**: [Metadata Weekly](https://metadataweekly.substack.com/p/context-graphs-are-a-trillion-dollar)

**The Heterogeneity Counter-Argument**:

A single renewal decision requires context from 6+ systems:
```
┌────────────────────────────────────────────────────┐
│              ONE RENEWAL DECISION                  │
├────────────────────────────────────────────────────┤
│  PagerDuty        → Incident history              │
│  Zendesk          → Escalation threads            │
│  Slack            → VP approval from last quarter │
│  Salesforce       → Deal record                   │
│  Snowflake        → Usage data                    │
│  Semantic Layer   → "Healthy customer" definition │
└────────────────────────────────────────────────────┘
```

**The Integration Reality**:
- Every enterprise has different system combinations
- Vertical agent would need 50-100+ integrations
- Every vertical agent rebuilds the same integrations

**Two Types of Context**:
| Type | What It Stores | Where It Lives |
|------|---------------|----------------|
| **Operational** | SOPs, exception policies, institutional knowledge | Knowledge bases, wikis, people's heads |
| **Analytical** | Metric definitions, calculations, semantic meaning | Semantic layers, data catalogs |

**The Compounding Flywheel**:
```
Accuracy → Trust → Adoption → Feedback → Accuracy
     ↑___________________________________|

Vertical agents run this for ONE workflow.
Universal platforms run it for ALL workflows.
```

**The Iceberg Lesson**:
> "Enterprises learned a lesson from cloud data warehouses. They handed over both data AND compute, then watched as their most strategic asset became someone else's leverage."

Companies will want to **own** their context, not rent it.

---

### 4. Tomasz Tunguz — "The Two Context Databases"
**Source**: [tomtunguz.com](https://tomtunguz.com/operational-analytical-context-databases/)

**Two Types of Context Databases**:

| Type | Stores | Example |
|------|--------|---------|
| **Operational** | SOPs, institutional knowledge | "When customer calls about password reset, do X" |
| **Analytical** | Metric definitions, business reasoning | "Revenue = X calculated as Y" |

**The Key Insight**:
> "The key to both operational & analytical context databases isn't the databases themselves. It's the feedback loops within them."

**The Feedback Loop Mechanism**:
```
1. System makes decision based on current context
2. Outcome is tracked (success/failure)
3. System learns from outcome
4. Context is refined
5. Next decision is smarter
        ↺ (repeat)
```

**RPA 2.0**: Context databases represent robotic process automation enhanced with non-determinism—enabling exception handling and reasoning.

---

### 5. Ed Sim — "Execution Intelligence Layer"
**Source**: [X/Twitter](https://x.com/edsim/status/2004935604706914745)

**Three Converging Essays**:
- Ivan Zhao (Notion): "Steam, Steel and Infinite Minds"
- Aaron Levie (Box): "Jevon's Paradox for Knowledge Work"
- Jaya Gupta (Foundation Capital): "Context Graphs"

**The Convergence**:
> "We are not just layering AI onto existing software—we are rebuilding how work, decisions, and enterprise systems function at their core."

**What Context Really Means**:
Not metadata or better prompts—**decision-time understanding**:
- Inputs + Intent + Constraints
- History + Permissions + Exceptions
- Outcomes

**The Moat**:
> "The moat isn't the query-response interaction—it gets much stronger when workflows are automated, when humans are pulled into decision-making, when exceptions are handled, and when systems learn from those outcomes."

---

## Technical Deep-Dives

### 6. Kirk Marple (Graphlit) — "Building the Event Clock"
**Source**: [Graphlit Blog](https://www.graphlit.com/blog/building-the-event-clock)

**The Two Clocks Metaphor**:
- **State Clock**: What's true now (elaborate infrastructure exists)
- **Event Clock**: How it became true (almost nothing exists)

**Three-Layer Technical Architecture**:

```
LAYER 3: FACTS
├── Temporal assertions with validity modeling
├── validAt / invalidAt timestamps
├── Status: Canonical, Superseded, Corroborated, Synthesized
└── Entity mentions + source references

LAYER 2: ENTITIES
├── Identity-resolved mentions
├── "Sarah Chen" = "S. Chen" = "@sarah"
└── People, organizations, places, products

LAYER 1: CONTENT
├── Immutable source documents
├── Evidence trail
└── Never edited/deleted
```

**Synthesized Facts**:
Instead of scattered observations, derive: "Paula worked at Google from January 2020 to March 2024" from multiple source facts.

---

### 7. TrustGraph — "Context Graph Manifesto"
**Source**: [TrustGraph](https://trustgraph.ai/news/context-graph-manifesto/)

**Core Definition**:
> "A context graph is a triples-representation of data that is optimized for usage with AI."

**The Triple Structure**: Subject → Predicate → Object

**Eight Development Stages**:
1. LLM training data alone
2. RAG with semantic similarity
3. GraphRAG with flexible representations
4. Ontology-driven retrieval
5. Type-specific retrieval analytics
6. Self-describing information systems
7. Dynamic retrieval strategies
8. **Autonomous learning loops** ← The goal

**Key Finding**:
> "Structured formats like Cypher or RDF produce superior LLM outputs compared to plain text, because the structure itself carries information."

---

### 8. Anthony Alcaraz — "Two-Layer Context Architecture"
**Source**: [LinkedIn](https://www.linkedin.com/posts/anthony-alcaraz-b80763155_foundation-capital-just-published-context-activity-7410253380641734656-RuYD)

**Layer 1: Operational Context (Foundation)**
```
├── Identity Resolution: "Sarah Chen" = "S. Chen" = "sarah@company.com"
├── Relationship Modeling: Ownership chains, accountability
└── Temporal State: What data looked like AT DECISION TIME
```

**Layer 2: Decision Context (Built on Layer 1)**
```
├── Inputs considered
├── Policy versions applied
├── Exceptions granted + by whom
└── Searchable precedent
```

**Critical Insight**: "Layer 2 cannot exist without Layer 1."

---

### 9. Animesh Koratana — "How to Build a Context Graph"
**Source**: [X/Twitter](https://x.com/akoratana/status/2005303231660867619)

**The Problem**:
> "Your CRM stores the final deal value, not the negotiation. Your ticket system stores 'resolved,' not the reasoning. We've built trillion-dollar infrastructure for what's true now. Almost nothing for why it became true."

**Building Challenges**:
1. No universal ontology—every org has different entities/relationships
2. "Customer" means different things at different companies
3. Everything changes daily—you're tracking change, not documenting static reality

**The Economic Model**:
> "The agents aren't building the context graph—they're solving problems worth paying for. The context graph is the exhaust."

**The Compound Effect**:
```
Better context → More capable agents → More deployments
       ↑                                      │
       └──────── More trajectories ←──────────┘
```

**The Goal**:
> "If you can ask 'what if?' and get useful answers, you've built something real. Not agents that complete tasks—organizational intelligence that compounds."

---

### 10. Kirk Marple (Graphlit) — "The Context Layer AI Agents Need"
**Source**: [Graphlit Blog](https://www.graphlit.com/blog/context-layer-ai-agents-need)

**Two Essential Layers**:

**Operational Context (Foundation)**:
- Identity resolution across fragmented systems
- Ownership and relationships
- Temporal state (historical data at decision time)
- Cross-system synthesis

**Decision Context (Built on Top)**:
- Decision traces with policies applied
- Exceptions granted + approvers
- Complete audit trails

**Why Current Approaches Fail**:
- RAG retrieves text similarity, not organizational meaning
- AI memory platforms store transcripts, not structural relationships

---

## Domain Applications

### 11. Pixee — "AppSec's Next Frontier: Systems of Decision"
**Source**: [Pixee Blog](https://www.pixee.ai/blog/appsec-systems-of-decision-context-graphs)

**The Shift**: Systems of Detection → Systems of Decision

**Four Layers of Security Context**:
```
1. Raw Context       → Vulnerabilities, dependencies, configs
2. Process Context   → Security policies, governance rules
3. Kinetic Context   → Exploit verification, reachability
4. Human Feedback    → Developer preferences, precedents
```

**The Lost Knowledge Problem**:
> "When your team deprioritizes a finding, where does the reasoning go? Slack thread. Gone."

**Pixee's Result**: 76% merge rate through feedback loop on developer acceptance patterns.

---

### 12. Sandeep Seshadri — "Context Graphs in Financial Recovery"
**Source**: [LinkedIn](https://www.linkedin.com/pulse/decoding-decision-my-exploration-incorporating-context-seshadri-ntc4c)

**The Cold Start Problem**:
Traditional systems track "what happened" (status changes) but not "why" (reasoning).

**Solution: Audit Log Mining with LLMs**:

```
RAW AUDIT LOG:
- Status → New Case
- Note: "T/MKR NA" (Tried Maker, No Answer)
- Status → Field Chase Request

SYNTHETIC DECISION TRACE:
"Collector pivoted to physical visit because Maker
became unreachable by phone, indicating avoidance risk."
```

**Structured Decision Objects**:
```
├── Trigger:  The initiating event
├── Evidence: What the user observed
├── Logic:    The reasoning
└── Outcome:  Success/failure metrics
```

**The Transformation**:
> AI evolves from "policy-checkers" to "navigators of precedents"

---

### 13. Arvind Jain (Glean) — "Context Graph Observability"
**Source**: [LinkedIn](https://www.linkedin.com/posts/jain-arvind_theres-been-a-lot-of-excitement-about-context-activity-7414733088691458048-g3L-)

**Three-Stage Framework**:

1. **Data Collection**: Tap into ALL enterprise data, not narrow view
2. **Sequential Understanding**: What happened, in what order, how state changed
3. **Pattern Recognition**: From logs → understanding how org actually operates

**Key Distinction**:
> "A lot of 'why' will always live in human judgment, but the observable *how*—decision velocity, handoffs, stalls, recoveries—can be captured."

---

### 14. Subramanya N — "Governance Stack for Context Graphs"
**Source**: [subramanya.ai](https://subramanya.ai/2025/12/26/context-graphs-my-thoughts-on-the-trillion-dollar-evolution-of-agentic-memory/)

**Three-Phase Evolution of Agentic Infrastructure**:

| Phase | Focus | Analogy |
|-------|-------|---------|
| 1 | Tools (MCP) | Agent has a hammer |
| 2 | Skills (Agent Skills) | Agent has carpentry manual |
| 3 | Context (Context Graphs) | Agent accesses complete building history |

**Governance Stack**:
```
├── Agent Registries
├── Tool Registries
├── Skill Registries
└── Policy Engines
```

This infrastructure transforms exceptions into precedents.

---

## Implementation Frameworks

### 15. Prukalpa (Atlan) — "The AI Context Gap"
**Source**: [Atlan](https://atlan.com/know/closing-the-context-gap/)

**The Problem**: AI's next cycle is about **accountability**, not experimentation.
- 95% of AI projects fail to exit pilot phase
- Data without meaning, governance lag

**Enterprise Context Layer Framework**:

```
┌─────────────────────────────────────────────────────┐
│            CONTEXT EXTRACTION                        │
│   Pull structure from data, docs, workflows         │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│              CONTEXT STORE                           │
│   Versioned repo of definitions, relationships      │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│            CONTEXT RETRIEVAL                         │
│   Real-time interface for agents + humans           │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│          CONTEXT FEEDBACK LOOPS                      │
│   Human-in-the-loop refinement                      │
└─────────────────────────────────────────────────────┘
```

---

### 16. Prukalpa (Atlan) — "The AI Value Chasm"
**Source**: [Atlan](https://atlan.com/know/ai-value-chasm/)

**Three Core Obstacles**:
1. **Fragmented Data Context**: "We have 1000 AI use cases but don't know what data we have"
2. **Misaligned Business Meaning**: "Customer" means different things across departments
3. **Outdated Governance**: Static policies can't enforce intent in real-time

**The Reality**: 49% of organizations report AI hasn't delivered full potential.

**The Solution — Three Foundational Layers**:
1. Data discovery and metadata management
2. Business meaning alignment (data contracts, certified products)
3. Real-time governance (shift left, embed rules)

---

### 17. Theory VC — "From Context Engineering to Context Platforms"
**Source**: [Theory VC](https://theoryvc.com/blog-posts/from-context-engineering-to-context-platforms)

**The Problem Today**:
- Forward Deployed AI Engineers manually gather context
- Update system prompts by hand
- Every vertical agent does the same work for each customer

**The Shift**:

| From | To |
|------|----|
| Manual context engineering | Automated context platforms |
| Hardcoded prompts | Dynamic context retrieval |
| Vendor-dependent maintenance | Self-serve or automated |

**Three Core Capabilities of Context Platforms**:
1. **Automated context creation** from existing data
2. **Dynamic context delivery** from databases
3. **Continuous maintenance** (automated/self-serve)

---

### 18. The Great Data Debate 2026
**Source**: [Atlan Event Page](https://atlan.com/great-data-debate-2026/)

**Event**: February 5, 2026, 11 AM ET (Virtual, Free)

**Debate 1**: "Will AI Analysts Kill 70% of Dashboards by 2026?"
- Cindi Howson (ThoughtSpot)
- Barry McCardel (Hex)
- Tristan Handy (dbt Labs)

**Debate 2**: "Context Graphs: The Next $1T Opportunity — But Who Owns Them?"
- Bob Muglia (Former Snowflake CEO)
- Karthik Ravindran (Microsoft)
- Tony Gentilcore (Glean)
- Prukalpa Sankar (Atlan)
- Jaya Gupta (Foundation Capital)

---

## Key Concepts Glossary

| Term | Definition |
|------|------------|
| **Context Graph** | A queryable historical record of decision traces across entities and time |
| **Decision Trace** | The complete record of a decision: inputs, reasoning, approvers, outcome |
| **Execution Path** | The system/workflow where decisions actually execute |
| **Semantic Contract** | Explicit agreement about which system owns which definition |
| **Operational Context** | SOPs, institutional knowledge, exception policies |
| **Analytical Context** | Metric definitions, calculations, semantic meaning |
| **Event Clock** | Infrastructure capturing WHY things happened (vs State Clock = WHAT is true now) |
| **Synthesized Fact** | Derived insight from multiple source facts (e.g., "worked at X from Y to Z") |
| **Context Flywheel** | Accuracy → Trust → Adoption → Feedback → Accuracy (compounds over time) |
| **Cold Start Problem** | How to bootstrap decision traces when historical reasoning wasn't captured |

---

## Source Links (Complete — 18 Articles)

### Primary Theses
1. [Long Live Systems of Record](https://cloudedjudgement.substack.com/p/clouded-judgement-121225-long-live) — Jamin Ball
2. [Context Graphs: AI's Trillion-Dollar Opportunity](https://foundationcapital.com/context-graphs-ais-trillion-dollar-opportunity/) — Jaya Gupta
3. [Who Actually Captures the Trillion Dollars?](https://metadataweekly.substack.com/p/context-graphs-are-a-trillion-dollar) — Prukalpa

### Technical Deep-Dives
4. [Two Context Databases](https://tomtunguz.com/operational-analytical-context-databases/) — Tomasz Tunguz
5. [Building the Event Clock](https://www.graphlit.com/blog/building-the-event-clock) — Kirk Marple
6. [Context Graph Manifesto](https://trustgraph.ai/news/context-graph-manifesto/) — TrustGraph
7. [Context Layer AI Agents Need](https://www.graphlit.com/blog/context-layer-ai-agents-need) — Kirk Marple
8. [Two-Layer Context Architecture](https://www.linkedin.com/posts/anthony-alcaraz-b80763155_foundation-capital-just-published-context-activity-7410253380641734656-RuYD) — Anthony Alcaraz
9. [How to Build a Context Graph](https://x.com/akoratana/status/2005303231660867619) — Animesh Koratana
10. [Execution Intelligence Layer](https://x.com/edsim/status/2004935604706914745) — Ed Sim

### Domain Applications
11. [AppSec Systems of Decision](https://www.pixee.ai/blog/appsec-systems-of-decision-context-graphs) — Pixee
12. [Context Graphs in Financial Recovery](https://www.linkedin.com/pulse/decoding-decision-my-exploration-incorporating-context-seshadri-ntc4c) — Sandeep Seshadri
13. [Context Graph Observability](https://www.linkedin.com/posts/jain-arvind_theres-been-a-lot-of-excitement-about-context-activity-7414733088691458048-g3L-) — Arvind Jain
14. [Governance Stack for Context Graphs](https://subramanya.ai/2025/12/26/context-graphs-my-thoughts-on-the-trillion-dollar-evolution-of-agentic-memory/) — Subramanya N

### Implementation Frameworks
15. [Closing the Context Gap](https://atlan.com/know/closing-the-context-gap/) — Atlan
16. [The AI Value Chasm](https://atlan.com/know/ai-value-chasm/) — Atlan
17. [From Context Engineering to Context Platforms](https://theoryvc.com/blog-posts/from-context-engineering-to-context-platforms) — Theory VC

### Events
18. [The Great Data Debate 2026](https://atlan.com/great-data-debate-2026/) — Feb 5, 2026

---

*Research compiled: January 2026*
