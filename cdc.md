# Concept Design Document (CDD)

## ForgeCraft AI: The Persistent Community RPG & Economy Engine

---

## 1. Executive Summary

### 1.1 Product Vision

**ForgeCraft AI** reimagines community engagement on Discord by transforming everyday server chat activity into a living, persistent role-playing game (RPG) and dynamic economic ecosystem. Rather than requiring users to type repetitive commands to earn static points, ForgeCraft AI passively analyzes natural chat sentiment, context, and quality to drive world events, resource generation, and player progression.

By binding server activity directly to an evolving narrative and marketplace, ForgeCraft AI establishes an active retention loop that organically improves chat quality and builds deep community immersion.

### 1.2 Core Value Proposition

- **Passive Engagement:** Rewards genuine conversations over command spamming.
- **Dynamic Lore Generation:** Uses Large Language Models (LLMs) to write contextual server history based on real member actions.
- **True Economy Simulation:** Implements a supply-and-demand driven commodity marketplace tied to server metrics.
- **Immersive Spatial Design:** Converts distinct Discord text and voice channels into functional geographic zones within the game world.

---

## 2. Architectural Design & System Topology

To handle real-time Discord gateway traffic, fast database lookups, and asynchronous AI text generation, the bot relies on a decoupled, tiered backend layout.
+-----------------------------------+
| Discord API Gateway |
+-----------------------------------+
│
[Gateway Events / Websocket]
▼
+-----------------------------------+
| Discord Bot Instance |
| (Node.js / Discord.js v14) |
+-----------------------------------+
│
┌───────────────────────┴───────────────────────┐
▼ ▼
+-----------------------+ +-----------------------+
| Redis Cache | | AI Analytics Engine |
| (Cooldowns, Market, | | (Groq / OpenAI API |
| Active Sessions) | | with Memory Buffer) |
+-----------------------+ +-----------------------+
│ │
└───────────────────────┬───────────────────────┘
▼
+-----------------------------------+
| PostgreSQL Database |
| (Persistent States & Inventories) |
+-----------------------------------+

### 2.1 Technology Stack Details

- **Application Framework:** Node.js utilizing `Discord.js` v14 for robust, asynchronous event loop processing.
- **Primary Database:** PostgreSQL. Relational structuring is mandatory to support complex asset-ownership joins, transactional logs, and player attribute maps.
- **Caching & State Management:** Redis. Used to intercept frequent reads (e.g., checking user cooldowns, matching valid marketplace items, or scaling active voice minutes) to shield the primary database from bottlenecks.
- **AI Engine:** Groq API or OpenAI API leveraging lightweight models (e.g., Llama-3-8B or GPT-4o-mini) tailored with structured JSON outputs for low-latency message categorization and text synthesis.

---

## 3. Database Schema Blueprint

The data model utilizes PostgreSQL to guarantee absolute data integrity, especially during high-velocity marketplace transactions.

````sql
-- Enable UUID extension for robust distributed keys if necessary
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users & Global Progression State
CREATE TABLE users (
    discord_id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    experience_points BIGINT DEFAULT 0,
    player_class VARCHAR(30) DEFAULT 'Adventurer',
    gold_balance NUMERIC(15, 2) DEFAULT 100.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Items Master Catalog
CREATE TABLE items (
    item_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    rarity VARCHAR(20) CHECK (rarity IN ('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary')),
    base_value NUMERIC(12, 2) NOT NULL,
    is_consumable BOOLEAN DEFAULT FALSE
);

-- 3. Player Inventory (Join Table)
CREATE TABLE user_inventories (
    discord_id VARCHAR(64) REFERENCES users(discord_id) ON DELETE CASCADE,
    item_id INT REFERENCES items(item_id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity >= 0),
    PRIMARY KEY (discord_id, item_id)
);

-- 4. Dynamic Commodity Market Registry
CREATE TABLE market_commodities (
    commodity_id SERIAL PRIMARY KEY,
    item_id INT REFERENCES items(item_id) ON DELETE CASCADE,
    current_price NUMERIC(12, 2) NOT NULL,
    supply_pool INT NOT NULL DEFAULT 1000,
    demand_multiplier NUMERIC(4, 2) DEFAULT 1.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Server Global Lore Ledger
CREATE TABLE lore_ledger (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL,
    raw_trigger_summary TEXT NOT NULL,
    generated_lore TEXT NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index optimizations for high-throughput reads
CREATE INDEX idx_users_xp ON users(experience_points DESC);
CREATE INDEX idx_inventory_lookup ON user_inventories(discord_id);
CREATE INDEX idx_market_prices ON market_commodities(current_price);
4. Mechanical Design & Core Loops
4.1 AI-Driven Context Analysis (Passive Loop)
Rather than executing a loop on every single message (which incurs massive API costs), ForgeCraft AI uses a rolling window or a sliding threshold buffer to ingest chat lines.

[User Chat Input] ──> [Buffer Queue: 10 Messages] ──> [Batch Keyword & Sentiment Check]
                                                               │
                                                               ▼
[Database / State Update] <─── [Trigger Event] <─── [Threshold Met (e.g. Deep Coding Chat)]
Step 1: Messages are fed into a text length and quality buffer.

Step 2: When a channel's activity metric reaches an optimized threshold, the batched text block is assessed by the local analytical module or LLM.

Step 3: Based on the taxonomy evaluation, the bot outputs structured updates:

JSON
    {
      "context_detected": "deep_technical_discussion",
      "intensity_score": 0.87,
      "world_event_triggered": true,
      "reward_item": "Silicon Crystal Core",
      "flavor_text": "The conceptual density of this channel's algorithmic debate has crystallized the atmospheric energy, condensing a Silicon Crystal Core into the town vault!"
    }
    ```

### 4.2 Channels as Geographic Zones
To build immersion, Discord text and voice channels are categorized internally into regional flags.

* `#general` (Town Square): Hub for trading items via `/market`, checking player statistics, and resting. No dangerous events occur here.
* `#development` / `#coding` (The High-Tech Spire): High probability of passive mining drops related to technology assets (e.g., Scrap Metal, Rare Silicon).
* `#gaming` (The Arena): Active combat triggers. Passive chats generate hostile encounters where users must react or work together to defeat a prompt-driven threat.
* `Voice Channels` (The Mystic Leylines): Gathering zones. Every 10 consecutive minutes of multi-user audio activity updates the market supply pool of localized crafting elements.

### 4.3 Market Supply & Demand Algorithm
The price of items fluctuated programmatically using an internal feedback algorithm modeled against activity metrics.

$$\text{Current Price} = \text{Base Value} \times \left( \frac{\text{Demand Multiplier}}{\ln(\text{Supply Pool} + 2)} \right)$$

When server voice activity or general messaging rate spikes, raw materials associated with that channel are injected into the economy pool, driving the price down. Conversely, when players purchase a high volume of a single consumable item (e.g., Health Elixirs), the `Supply Pool` shrinks, and the algorithm shifts the cost structure upward. This creates an environment ripe for community day-trading and user-driven economic planning.

---

## 5. Command Interface Structure (UX)

The user experience relies completely on clean, native Discord Slash Commands (`/`).

### 5.1 Player Profile Commands
* `/profile view [target_user]`
    * Displays character sheet, active class, experience progression, gold, and historical tags as an embedded graphic.
* `/inventory`
    * Generates a paginated list of current item holdings, grouped by item rarities with dropdown item inspection menus.

### 5.2 Economic Marketplace Commands
* `/market ticker`
    * Renders a real-time visualization of the top-performing commodity prices on the server, showcasing positive and negative directional shifts over the trailing 24 hours.
* `/market buy [item_name] [quantity]`
    * Executes an instant atomic balance extraction and adds items to player stock if the user has sufficient gold balances.
* `/market sell [item_name] [quantity]`
    * Liquidates item holdings back into the global commodity pool based on current live valuations.

### 5.3 Chronicle Logs
* `/chronicle lookup [event_id]`
    * Fetches historical server events created by the AI engine, preserving the community's collective folklore.

---

## 6. Implementation & Scaling Roadmap

Phase 1: Foundation (W1-W3)  ──>  Phase 2: Economy Engine (W4-W5)  ──>  Phase 3: AI Integration (W6-W8)

Basic Discord.js Framework       - PostgreSQL Database Migrations       - Core LLM Endpoint Connectors

Slash Command Framework          - Inventory & Marketplace System       - Passive Sentiment/Context Filters

Memory Caching Configuration     - Algorithm Testing & Validation       - Server Expansion & Beta Release


### Phase 1: Foundation (Weeks 1-3)
* Establish codebase structure using Node.js and TypeScript for typing security.
* Deploy PostgreSQL database and write initial data models.
* Configure Redis memory stores to handle user message tracking.

### Phase 2: Economy Engine (Weeks 4-5)
* Develop dynamic trading calculations and test economic balancing scripts under simulated volume tests.
* Implement player profile structures and basic leveling updates.

### Phase 3: AI Analytics & Narrative Engine (Weeks 6-8)
* Integrate API pipelines for contextual analysis.
* Deploy sliding-window message aggregation queues.
* Initiate staging betas in safe developer test environments before deploying the fully featured application pubic-wide.
````
