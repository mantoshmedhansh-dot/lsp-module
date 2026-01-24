# o9 Solutions: FMCG Scenario Explainer

> Purpose: Understanding o9 components through an FMCG lens
> Date: 2026-01-18

---

## Part 1: o9 Platform Architecture

### The "Digital Brain" Concept

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           o9 DIGITAL BRAIN                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    DECISION LAYER (AI/ML)                               │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐               │ │
│  │  │ Composite│  │ Atomic   │  │ GenAI    │  │ Optimi-  │               │ │
│  │  │ Agents   │  │ Agents   │  │ Chat     │  │ zation   │               │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    ▲                                         │
│                                    │                                         │
│  ┌────────────────────────────────┴───────────────────────────────────────┐ │
│  │              ENTERPRISE KNOWLEDGE GRAPH (EKG)                           │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │ │
│  │  │  Digital Twin of Your Enterprise                                │   │ │
│  │  │  • Products, SKUs, BOMs                                         │   │ │
│  │  │  • Customers, Channels, Regions                                 │   │ │
│  │  │  • Suppliers, Lead Times, Costs                                 │   │ │
│  │  │  • Plants, Warehouses, Capacity                                 │   │ │
│  │  │  • Relationships & Constraints                                  │   │ │
│  │  │  • Tribal Knowledge & Expert Recipes                            │   │ │
│  │  └─────────────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    ▲                                         │
│                                    │                                         │
│  ┌────────────────────────────────┴───────────────────────────────────────┐ │
│  │                    DATA LAYER (Connectors)                              │ │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐              │ │
│  │  │  SAP   │ │ Oracle │ │ POS    │ │ Weather│ │ Market │              │ │
│  │  │  ERP   │ │  ERP   │ │ Data   │ │ Data   │ │ Data   │              │ │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Main Components of o9

### Component 1: Enterprise Knowledge Graph (EKG)

**What It Is:** A graph-based data model that connects all your enterprise data into a "digital twin"

**FMCG Example:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    FMCG KNOWLEDGE GRAPH                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│    [Brand: Maggi]                                                │
│         │                                                        │
│         ├──── [Product: Maggi 2-Min Noodles]                    │
│         │          │                                             │
│         │          ├──── [SKU: Maggi-Masala-70g]                │
│         │          │          │                                  │
│         │          │          ├── Sold via: [Modern Trade]      │
│         │          │          ├── Sold via: [General Trade]     │
│         │          │          ├── Made at: [Nanjangud Plant]    │
│         │          │          ├── Lead Time: 3 days             │
│         │          │          └── Shelf Life: 9 months          │
│         │          │                                             │
│         │          ├──── [SKU: Maggi-Masala-280g]               │
│         │          └──── [SKU: Maggi-Chicken-70g]               │
│         │                                                        │
│         └──── [Product: Maggi Sauce]                            │
│                                                                  │
│    [Customer: BigBazaar]                                         │
│         │                                                        │
│         ├──── Region: West                                       │
│         ├──── Credit Limit: ₹50L                                │
│         ├──── Payment Terms: Net 30                             │
│         └──── Preferred Delivery: Wednesday                     │
│                                                                  │
│    [Supplier: Wheat Flour Co.]                                   │
│         │                                                        │
│         ├──── Lead Time: 7 days                                 │
│         ├──── MOQ: 10 tons                                      │
│         └──── Supplies to: [Nanjangud Plant]                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Why It Matters:**
- All relationships are connected (not siloed in spreadsheets)
- Changes propagate instantly
- AI can query across the entire enterprise

---

### Component 2: Planning Modules

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         o9 PLANNING MODULES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │  DEMAND         │    │  SUPPLY         │    │  INVENTORY      │         │
│  │  PLANNING       │───▶│  PLANNING       │───▶│  OPTIMIZATION   │         │
│  │                 │    │                 │    │                 │         │
│  │ • Forecast      │    │ • Production    │    │ • Safety Stock  │         │
│  │ • Demand Sensing│    │ • Sourcing      │    │ • Reorder Points│         │
│  │ • Promotions    │    │ • Capacity      │    │ • MEIO          │         │
│  │ • New Products  │    │ • Allocation    │    │ • DIO Targets   │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│           │                      │                      │                   │
│           └──────────────────────┼──────────────────────┘                   │
│                                  ▼                                          │
│                    ┌─────────────────────────┐                              │
│                    │  INTEGRATED BUSINESS    │                              │
│                    │  PLANNING (S&OP/IBP)    │                              │
│                    │                         │                              │
│                    │ • Executive Dashboards  │                              │
│                    │ • Scenario Planning     │                              │
│                    │ • Financial Integration │                              │
│                    │ • Consensus Alignment   │                              │
│                    └─────────────────────────┘                              │
│                                  │                                          │
│           ┌──────────────────────┼──────────────────────┐                   │
│           ▼                      ▼                      ▼                   │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │  REVENUE        │    │  SUPPLY CHAIN   │    │  PROCUREMENT    │         │
│  │  MANAGEMENT     │    │  CONTROL TOWER  │    │  PLANNING       │         │
│  │                 │    │                 │    │                 │         │
│  │ • Pricing       │    │ • Visibility    │    │ • PO Management │         │
│  │ • Trade Promo   │    │ • Alerts        │    │ • Supplier Mgmt │         │
│  │ • Mix Optimize  │    │ • Exceptions    │    │ • Cost Analysis │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Component 3: AI/ML Capabilities

| Capability | What It Does | FMCG Example |
|------------|--------------|--------------|
| **ML Demand Forecasting** | Predicts demand using 100+ variables | "Maggi sales will spike 15% next week due to rain forecast" |
| **Demand Sensing** | Near-real-time demand signals | POS data shows Maggi selling out in Mumbai |
| **Composite Agents** | Multi-step AI workflows | Agent analyzes promotion, adjusts forecast, recalculates supply |
| **GenAI Chat** | Natural language queries | "Why did we miss forecast in North region?" |
| **Optimization** | Mathematical optimization | Optimal production schedule across 5 plants |

---

## Part 3: FMCG Scenario Walkthrough

### The Company: "NutriSnacks India"

```
Company Profile:
├── Revenue: ₹2,000 Cr
├── SKUs: 500+
├── Brands: 5 (Snacks, Beverages, Dairy, Noodles, Sauces)
├── Plants: 4 (North, South, East, West)
├── Warehouses: 12 regional DCs
├── Channels: Modern Trade (40%), General Trade (50%), E-commerce (10%)
├── Customers: 50 key accounts + 10,000 distributors
└── ERP: SAP S/4HANA
```

---

### Monthly S&OP Cycle with o9

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MONTHLY S&OP CYCLE (FMCG)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  WEEK 1: DEMAND REVIEW                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Participants: Sales, Marketing, Category Managers                      │ │
│  │                                                                         │ │
│  │  o9 Does:                                                               │ │
│  │  • Generates statistical forecast (ML models)                          │ │
│  │  • Incorporates demand sensing (POS, search trends)                    │ │
│  │  • Overlays promotion calendar                                         │ │
│  │  • Flags new product launches                                          │ │
│  │  • Shows forecast accuracy of previous cycle                           │ │
│  │                                                                         │ │
│  │  Team Does:                                                             │ │
│  │  • Reviews AI forecast, adds market intelligence                       │ │
│  │  • Adjusts for competitor activity                                     │ │
│  │  • Confirms promotion uplift assumptions                               │ │
│  │  • Signs off on "Consensus Demand"                                     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      ▼                                       │
│  WEEK 2: SUPPLY REVIEW                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Participants: Supply Chain, Manufacturing, Procurement                 │ │
│  │                                                                         │ │
│  │  o9 Does:                                                               │ │
│  │  • Runs supply feasibility against demand                              │ │
│  │  • Checks capacity constraints at each plant                           │ │
│  │  • Identifies material shortages                                       │ │
│  │  • Suggests production allocation across plants                        │ │
│  │  • Calculates inventory projections                                    │ │
│  │                                                                         │ │
│  │  Team Does:                                                             │ │
│  │  • Reviews capacity utilization                                        │ │
│  │  • Decides on overtime/outsourcing                                     │ │
│  │  • Confirms supplier commitments                                       │ │
│  │  • Signs off on "Constrained Supply Plan"                              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      ▼                                       │
│  WEEK 3: PRE-S&OP (DEMAND-SUPPLY BALANCING)                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Participants: Cross-functional planning team                           │ │
│  │                                                                         │ │
│  │  o9 Does:                                                               │ │
│  │  • Shows demand vs supply gaps                                         │ │
│  │  • Runs "what-if" scenarios:                                           │ │
│  │    - Scenario A: Add 3rd shift at South plant                         │ │
│  │    - Scenario B: Reduce promotion in North                            │ │
│  │    - Scenario C: Air-freight materials                                │ │
│  │  • Calculates financial impact of each scenario                        │ │
│  │  • Recommends optimal scenario                                         │ │
│  │                                                                         │ │
│  │  Team Does:                                                             │ │
│  │  • Evaluates trade-offs                                                │ │
│  │  • Selects preferred scenario                                          │ │
│  │  • Documents decisions and rationale                                   │ │
│  │  • Prepares executive summary                                          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      ▼                                       │
│  WEEK 4: EXECUTIVE S&OP                                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Participants: CEO, CFO, COO, Sales Head, Supply Head                   │ │
│  │                                                                         │ │
│  │  o9 Does:                                                               │ │
│  │  • Presents integrated dashboard                                       │ │
│  │  • Shows financial plan alignment                                      │ │
│  │  • Highlights key risks and opportunities                              │ │
│  │  • Tracks KPIs vs targets                                              │ │
│  │                                                                         │ │
│  │  Team Does:                                                             │ │
│  │  • Approves final plan                                                 │ │
│  │  • Makes strategic decisions (new capacity, product discontinuation)   │ │
│  │  • Aligns on financial commitments                                     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Specific FMCG Scenario: Diwali Planning

**Situation:** It's August. Diwali is in November. NutriSnacks needs to plan.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DIWALI PLANNING SCENARIO                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CHALLENGE:                                                                  │
│  • Diwali drives 25% of annual sales in 6-week window                       │
│  • Gift packs need 8-week production lead time                              │
│  • Raw material (dry fruits, packaging) needs 12-week lead time             │
│  • Retailers want stock 4 weeks before Diwali                               │
│  • Last year: 15% stockouts, 8% excess inventory post-Diwali                │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  HOW o9 HELPS:                                                               │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  STEP 1: DEMAND SENSING (August)                                    │    │
│  │                                                                      │    │
│  │  o9 Analyzes:                                                        │    │
│  │  • Last 3 years' Diwali sales by SKU/region                         │    │
│  │  • Google search trends for "Diwali gifts"                          │    │
│  │  • Economic indicators (disposable income, inflation)               │    │
│  │  • Competitor pricing and promotions                                │    │
│  │  • E-commerce pre-booking data                                      │    │
│  │                                                                      │    │
│  │  Output: "Diwali demand will be +8% vs last year, concentrated      │    │
│  │           in premium gift packs (+15%) and e-commerce (+25%)"       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  STEP 2: SUPPLY FEASIBILITY (August)                                │    │
│  │                                                                      │    │
│  │  o9 Checks:                                                          │    │
│  │  • Plant capacity: South plant at 95%, needs overflow               │    │
│  │  • Raw materials: Cashew supply tight, need to lock now             │    │
│  │  • Packaging: Gift box supplier can only do 80% of need             │    │
│  │  • Warehouse: Need temporary space in Mumbai                        │    │
│  │                                                                      │    │
│  │  Output: "Gap of 12% between demand and supply capacity.            │    │
│  │           Critical bottleneck: Gift box packaging."                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  STEP 3: SCENARIO PLANNING (August S&OP)                            │    │
│  │                                                                      │    │
│  │  o9 Generates Scenarios:                                             │    │
│  │                                                                      │    │
│  │  Scenario A: "Conservative"                                          │    │
│  │  • Plan for 5% growth (not 8%)                                      │    │
│  │  • Use existing packaging supplier only                             │    │
│  │  • Risk: Stockouts, lost sales ~₹15Cr                               │    │
│  │  • Upside: No excess inventory                                      │    │
│  │                                                                      │    │
│  │  Scenario B: "Aggressive"                                            │    │
│  │  • Plan for 10% growth                                              │    │
│  │  • Add 2nd packaging supplier (higher cost)                         │    │
│  │  • Add 3rd shift at South plant                                     │    │
│  │  • Risk: Excess inventory ~₹8Cr                                     │    │
│  │  • Upside: Capture full demand                                      │    │
│  │                                                                      │    │
│  │  Scenario C: "Balanced" (o9 RECOMMENDED)                             │    │
│  │  • Plan for 8% growth                                               │    │
│  │  • Add 2nd packaging supplier for gift packs only                   │    │
│  │  • Pre-position inventory in high-demand regions                    │    │
│  │  • Risk: Minor stockouts in low-priority SKUs                       │    │
│  │  • Expected outcome: +₹18Cr revenue, -2% waste vs last year         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  STEP 4: EXECUTION & MONITORING (Sept-Nov)                          │    │
│  │                                                                      │    │
│  │  o9 Control Tower:                                                   │    │
│  │  • Daily POS tracking vs forecast                                   │    │
│  │  • Alerts when demand deviates >10%                                 │    │
│  │  • Automatic reallocation suggestions                               │    │
│  │  • Supplier delivery tracking                                       │    │
│  │                                                                      │    │
│  │  Week 3 Alert: "Mumbai gift pack sales +22% vs forecast.            │    │
│  │                 Recommend diverting 5,000 units from Pune DC."      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 4: System Integrations

### What Systems Does o9 Connect To?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         o9 INTEGRATION LANDSCAPE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                              ┌─────────────┐                                │
│                              │     o9      │                                │
│                              │   DIGITAL   │                                │
│                              │    BRAIN    │                                │
│                              └──────┬──────┘                                │
│                                     │                                        │
│      ┌──────────────────────────────┼──────────────────────────────┐        │
│      │                              │                              │        │
│      ▼                              ▼                              ▼        │
│  ┌───────────────┐          ┌───────────────┐          ┌───────────────┐   │
│  │  ERP SYSTEMS  │          │  DATA SOURCES │          │  EXECUTION    │   │
│  │               │          │               │          │  SYSTEMS      │   │
│  │ • SAP S/4HANA │          │ • POS Data    │          │ • WMS         │   │
│  │ • SAP ECC     │          │ • Nielsen/IRI │          │ • TMS         │   │
│  │ • Oracle ERP  │          │ • Weather     │          │ • MES         │   │
│  │ • Microsoft   │          │ • Social      │          │ • OMS         │   │
│  │   Dynamics    │          │ • Economic    │          │ • Salesforce  │   │
│  │ • JD Edwards  │          │ • Search      │          │ • EDI         │   │
│  │ • Infor       │          │   Trends      │          │               │   │
│  └───────────────┘          └───────────────┘          └───────────────┘   │
│                                                                              │
│      ┌───────────────┐          ┌───────────────┐          ┌───────────────┐│
│      │  DATA LAYER   │          │  BI/ANALYTICS │          │  COLLABORATION││
│      │               │          │               │          │               ││
│      │ • Snowflake   │          │ • Power BI    │          │ • Slack       ││
│      │ • Databricks  │          │ • Tableau     │          │ • Teams       ││
│      │ • BigQuery    │          │ • Looker      │          │ • Email       ││
│      │ • Azure       │          │               │          │               ││
│      │   Synapse     │          │               │          │               ││
│      └───────────────┘          └───────────────┘          └───────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Integration by Data Type

| Data Type | Source Systems | Direction | Frequency |
|-----------|---------------|-----------|-----------|
| **Master Data** | SAP (Materials, Customers, Vendors) | ERP → o9 | Daily |
| **Transactions** | SAP (Sales Orders, POs, Invoices) | ERP → o9 | Real-time/Hourly |
| **Inventory** | WMS, ERP | WMS → o9 | Real-time |
| **POS/Sellout** | Retailers, Nielsen, IRI | External → o9 | Daily |
| **Demand Signals** | Google Trends, Social, Weather | External → o9 | Daily |
| **Production** | MES, ERP | MES → o9 | Real-time |
| **Plans** | o9 (Forecasts, Production Plans) | o9 → ERP | Weekly |
| **Alerts** | o9 (Exceptions, Recommendations) | o9 → Slack/Email | Real-time |

---

### FMCG-Specific Integrations

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FMCG INTEGRATION EXAMPLE: NUTRI SNACKS                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FROM SAP S/4HANA:                                                           │
│  ├── Material Master (SKUs, BOMs, shelf life)                               │
│  ├── Customer Master (retailers, distributors)                              │
│  ├── Sales Orders (B2B orders from retailers)                               │
│  ├── Purchase Orders (raw material purchases)                               │
│  ├── Production Orders (manufacturing schedules)                            │
│  └── Inventory (stock levels by location)                                   │
│                                                                              │
│  FROM WMS (e.g., Manhattan, Blue Yonder):                                    │
│  ├── Real-time inventory by bin/location                                    │
│  ├── Inbound receipts                                                       │
│  ├── Outbound shipments                                                     │
│  └── Inventory adjustments                                                  │
│                                                                              │
│  FROM RETAILER PORTALS:                                                      │
│  ├── BigBazaar: Daily POS data                                              │
│  ├── DMart: Weekly sellout reports                                          │
│  ├── Amazon: Real-time sales & inventory                                    │
│  ├── Flipkart: Daily sales data                                             │
│  └── Reliance Retail: Weekly stock levels                                   │
│                                                                              │
│  FROM EXTERNAL SOURCES:                                                      │
│  ├── Nielsen: Category performance, market share                            │
│  ├── Weather API: Temperature, rainfall (affects snack demand)              │
│  ├── Google Trends: Search interest in products                             │
│  ├── Economic Data: Inflation, consumer sentiment                           │
│  └── Competitor Tracking: Pricing, promotions                               │
│                                                                              │
│  TO SAP S/4HANA:                                                             │
│  ├── Demand Forecast (by SKU, location, week)                               │
│  ├── Production Plan (quantities, timing)                                   │
│  ├── Procurement Plan (PO recommendations)                                  │
│  └── Distribution Plan (DRP)                                                │
│                                                                              │
│  TO COLLABORATION:                                                           │
│  ├── Slack: Exception alerts, approval requests                             │
│  ├── Email: Weekly planning summaries                                       │
│  └── Power BI: Executive dashboards                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 5: Value Delivered by o9 S&OP

### Before o9 (Typical FMCG Pain Points)

| Problem | Impact |
|---------|--------|
| Forecast in Excel, updated monthly | Stale, inaccurate |
| Each function has own numbers | "Which forecast is right?" |
| S&OP meeting = 4 hours of data reconciliation | No time for decisions |
| Can't see impact of promotions until after | Lost sales or excess stock |
| Manual scenario planning | Takes weeks, done rarely |
| No visibility to retailer sellout | React only to orders, not demand |

### After o9 (Measured Outcomes)

| Metric | Typical FMCG Improvement |
|--------|-------------------------|
| **Forecast Accuracy** | +10-20% improvement |
| **Inventory Days** | -15-25% reduction |
| **Service Level** | +5-10% improvement |
| **Lost Sales** | -20-30% reduction |
| **Planner Productivity** | +30-50% (less manual work) |
| **S&OP Cycle Time** | -40-60% (faster decisions) |
| **Scenario Analysis** | From 1/month to 10/day |

### Real FMCG Customer Results

| Company | Results |
|---------|---------|
| **Kraft Heinz** | 11% monthly forecast accuracy improvement, 20% safety stock reduction |
| **PepsiCo** | Uses o9 for demand sensing and S&OP |
| **Nestlé** | Global demand planning transformation |
| **AB InBev** | 90% touchless planning in advanced markets |
| **Unilever** | AI-driven demand forecasting |

---

## Part 6: How o9 S&OP Actually Helps (Summary)

### The Core Value Proposition

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│    BEFORE o9                              AFTER o9                          │
│    ─────────                              ────────                          │
│                                                                              │
│    Sales says: "We'll sell 100K"          o9 says: "AI predicts 92K        │
│    Supply says: "We can make 80K"          based on POS, weather, trends.  │
│    Finance says: "Budget is 90K"           Here's why, and here's what     │
│    Who's right? ¯\_(ツ)_/¯                 happens in each scenario."      │
│                                                                              │
│    ─────────────────────────────────────────────────────────────────────    │
│                                                                              │
│    Excel + Email + Meetings               Single Source of Truth            │
│    4-week cycle                           Continuous, real-time             │
│    Backward-looking                       Forward-looking + sensing         │
│    "What happened?"                       "What will happen? What should    │
│                                            we do?"                          │
│                                                                              │
│    ─────────────────────────────────────────────────────────────────────    │
│                                                                              │
│    Decisions based on gut                 Decisions based on AI +           │
│                                           human judgment                    │
│                                                                              │
│    Hope we got it right                   Know the trade-offs,              │
│                                           pick the best option              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Three "Whats" o9 Answers

| Question | How o9 Answers |
|----------|----------------|
| **What happened and why?** | Root cause analysis, variance explanations |
| **What will happen?** | ML forecasting, demand sensing, scenario modeling |
| **What should we do?** | Optimization, recommendations, agent suggestions |

---

## Appendix: Glossary for FMCG

| Term | Meaning |
|------|---------|
| **S&OP** | Sales & Operations Planning - monthly process to align demand, supply, and finance |
| **IBP** | Integrated Business Planning - evolved S&OP with financial integration |
| **Demand Sensing** | Using near-real-time data (POS, trends) to improve short-term forecasts |
| **MEIO** | Multi-Echelon Inventory Optimization - optimizing inventory across the network |
| **DIO** | Days of Inventory Outstanding - how many days of stock you're holding |
| **Fill Rate** | % of orders shipped complete on time |
| **Modern Trade** | Organized retail (BigBazaar, DMart, Reliance Retail) |
| **General Trade** | Traditional retail (kirana stores) |
| **Sellout** | What consumers actually bought (vs. sell-in = what you sold to retailers) |
| **Shelf Life** | How long product can sit before expiry (critical for FMCG) |
| **SKU Rationalization** | Deciding which products to keep/discontinue |
