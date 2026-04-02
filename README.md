# 🐟 Fish! Appraiser Engine

[![Node.js](https://img.shields.io/badge/Node.js-Native-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Vanilla JS](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?style=flat-square&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-brightgreen?style=flat-square)](#)

A high-performance, zero-dependency local web engine built to reverse-engineer and calculate the exact dynamic economy of the VRChat world **Fish!**. 

> *I was bored and wanted something to do during my down time at work, so I went a little too far for a fishing game lol.* — **Vixenlicious**

---

## 📑 Table of Contents
1. [Installation & Setup](https://github.com/VixenCreations/Fish-Appraiser-Engine#%EF%B8%8F-installation--setup)
2. [Usage & Navigation](https://github.com/VixenCreations/Fish-Appraiser-Engine#-usage--navigation)
3. [Server Configuration (Local & Production SSL)](https://github.com/VixenCreations/Fish-Appraiser-Engine#%EF%B8%8F-server-configuration)
4. [Engine Previews](https://github.com/VixenCreations/Fish-Appraiser-Engine#-engine-previews)
5. [Core Features & Technical Capabilities](https://github.com/VixenCreations/Fish-Appraiser-Engine#-core-features--technical-capabilities)
6. [Architecture & Topology](https://github.com/VixenCreations/Fish-Appraiser-Engine#-architecture--topology)
7. [The Nerd Stuff: Reverse-Engineered Mechanics](https://github.com/VixenCreations/Fish-Appraiser-Engine#-the-nerd-stuff-reverse-engineered-mechanics)

---

## 🛠️ Installation & Setup

This engine runs entirely on native Node.js modules (`http`, `fs`, `path`, `https`). There are **no dependencies** to install (`npm install` is not required). Ensure you have Git and Node.js installed on your system before proceeding.

### 🪟 Windows Setup
1. Open **Command Prompt** or **PowerShell**.
2. Clone the repository and enter the directory:
cmd
git clone https://github.com/VixenCreations/Fish-Appraiser-Engine.git
cd Fish-Appraiser-Engine

3. Start the local server:
cmd
node server.js

*(Note: If updating from an older version, simply run `update.bat`)*

### 🐧 Linux Setup (Ubuntu/Debian)
1. Open your terminal. If you don't have Git and Node.js installed, grab them first:
bash
sudo apt update
sudo apt install git nodejs -y

2. Clone the repository and enter the directory:
bash
git clone https://github.com/VixenCreations/Fish-Appraiser-Engine.git
cd Fish-Appraiser-Engine

3. Start the local server:
bash
node server.js

*(Note: If updating from an older version, simply run `./update.sh`)*

[⬆ Back to Top](https://github.com/VixenCreations/Fish-Appraiser-Engine#-table-of-contents)

---

## 🌐 Usage & Navigation

Once your terminal confirms the server is online, launch your browser and navigate using the same route structure defined by the app's internal routing:

---

### 🧭 Root: Main Appraiser
`/`

**URL:** http://localhost:8080

The primary interface defined in `index.html`.

**Capabilities:**
- Appraise individual catches (price + XP)
- Analyze Big Catch weight distribution shifts
- Simulate Luck scaling and rarity drop tables
- Forecast XP/hour and cycle efficiency
- Browse full fish database (search + filter matrix)

**UI Entry Points:**
- `Fish! Validator` button → routes to `/tools`
- `Stats for Nerds` → opens in-app modal (no route change)
- `Credits` → opens in-app modal

---

### 🧪 Tools: Data Miner Terminal
`/tools`

**URL:** http://localhost:8080/tools

A dedicated reverse-engineering interface defined in `tools.html`.

**Capabilities:**
- Input dual catch samples (A/B)
- Automatically strip mutation + variant multipliers
- Reverse Sine curve to recover true percentile rolls
- Solve for:
  - True base min/max weights
  - Economy scaling rates
  - Source-level integer values
- Validate against loaded database baselines

**Navigation Behavior:**
- `< RETURN_TO_APPRAISER` → routes back to `/`
- Language switcher is isolated but mirrors main app i18n system

---

### 🔀 Navigation Model (Actual Behavior)

The app uses **hard route separation**, not SPA-style dynamic routing:

- `/` → Full Appraiser Engine (`index.html`)
- `/tools` → Data Miner Toolset (`tools.html`)

There is **no shared DOM state** between routes:
- Each page loads its own JS (`app.js` vs `tools.js`)
- Each maintains independent UI state and calculations

---

### 🌍 Internationalization Layer

Both routes share a consistent i18n system:

- Language selector present on both pages
- Uses JSON payload mapping (`/lang/*.json`)
- UI text updates dynamically without reload
- Underlying math + logic remain untouched

---

### ⚠️ Operational Notes

- Always access via `localhost:8080` (not file://) to ensure:
  - JSON data loads correctly
  - Routing works as intended
- Ensure rod constraints and mutation inputs are valid before trusting reverse outputs


[⬆ Back to Top](https://github.com/VixenCreations/Fish-Appraiser-Engine#-table-of-contents)

## ⚙️ Server Configuration

The engine is configured via a `.env` file located at the project root. It supports both local development and production deployment with optional SSL toggling.

---

### 🧭 Default Configuration (Local Development)

By default, the engine runs using:

env
PORT=8080
HOST=localhost
USE_SSL=false


**Access:**
- http://localhost:8080
- Routes:
  - `/` → Main Appraiser
  - `/tools` → Data Miner Terminal

---

### 🔧 Core Environment Variables

#### Network & Hosting

env
PORT=8080
HOST=localhost


- `PORT` → Defines the listening port
- `HOST` → Domain or IP binding

---

#### Engine Configuration

env
DEFAULT_LANG=en
CACHE_MAX_AGE=86400


- `DEFAULT_LANG`
  - Fallback language if user preference is not set
  - Supported: `en`, `jp`

- `CACHE_MAX_AGE`
  - Controls static asset caching (CSS, JS, images)
  - Value is in seconds
  - HTML is excluded via cache-busting

---

#### Security (SSL / HTTPS)

env
USE_SSL=false
SSL_KEY=./certs/privkey.pem
SSL_CERT=./certs/fullchain.pem


- `USE_SSL`
  - `false` → HTTP server
  - `true` → HTTPS server (requires valid cert paths)

- `SSL_KEY` / `SSL_CERT`
  - Required when `USE_SSL=true`
  - Paths are relative to the server root

---

### 🚀 Production Configuration Example

env
PORT=443
HOST=yourdomain.com
CACHE_MAX_AGE=86400

USE_SSL=true
SSL_KEY=./certs/privkey.pem
SSL_CERT=./certs/fullchain.pem


**Behavior:**
- Server boots in HTTPS mode
- Automatically binds to standard secure port (443)
- Uses provided certificate chain for TLS

---

### 🔀 Runtime Behavior

- SSL toggling is **dynamic at startup**
  - No code changes required between environments
- Routing remains identical:
  - `/` and `/tools` are always available
- Static assets respect cache headers defined by `CACHE_MAX_AGE`

---

### ⚠️ Deployment Notes

- Always run behind a proper domain when using SSL
- Ensure certificate files exist and are readable before enabling `USE_SSL=true`
- Avoid using `localhost` with SSL unless explicitly configured for it
- Port `443` may require elevated privileges depending on your host OS

---

### 🧪 Dev vs Prod Snapshot

| Mode        | PORT | HOST       | SSL  |
|------------|------|------------|------|
| Local Dev  | 8080 | localhost  | ❌   |
| Production | 443  | domain     | ✅   |


[⬆ Back to Top](https://github.com/VixenCreations/Fish-Appraiser-Engine#-table-of-contents)

---

## 📸 Engine Previews

<p align="center">
  <img src="gitpreviews/EnginePreview1.png" width="48%" alt="Engine Preview 1">
  <img src="gitpreviews/EnginePreview2.png" width="48%" alt="Engine Preview 2">
  <img src="gitpreviews/EnginePreview3.png" width="48%" alt="Engine Preview 3">
  <img src="gitpreviews/EnginePreview4.png" width="48%" alt="Engine Preview 4">
</p>

[⬆ Back to Top](https://github.com/VixenCreations/Fish-Appraiser-Engine#-table-of-contents)

---

## 🚀 Core Features & Technical Capabilities

* **Reverse-Engineering Terminal:** A completely standalone `/tools` suite for spreadsheet maintainers. Automatically normalizes economy data, strips "Huge" and mutation multipliers, and performs algebraic diff-checks to expose inaccuracies in the community data.
* **Developer-Verified Catch Appraiser:** Uses linear interpolation (Lerp) to map the exact physical weight of your catch to its precise decimal coin value. 
* **XP Efficiency & Farm Forecaster:** End-to-end predictive analytics. Cross-references your live RNG rarity drop-tables against piecewise linear interpolated catch-cycle times to output your exact, dynamic average XP/Hour and XP/Minute.
* **Decoupled Data Architecture:** Game state data is isolated in JSON payloads. When the game receives a balance patch, simply update the JSON files in the `/data/` folder without ever touching the frontend code.
* **Zero-File Favicon:** Uses programmatic, server-side SVG interception to serve a scalable, high-resolution tab icon without cluttering the repository with binary `.ico` files.

[⬆ Back to Top](https://github.com/VixenCreations/Fish-Appraiser-Engine#-table-of-contents)

---

## 📂 Architecture & Topology

The application relies on a strict separation of concerns (Structure, Logic, and Data) while isolating the frontend UI from the backend payloads for maximum security.

text
/Fish-Appraiser-Engine
 │-- .env                   # Network configuration & SSL overrides (Optional)
 │-- server.js              # Native Node.js web server & custom router
 │-- update.bat             # Windows updater script
 │-- update.sh              # Linux updater script
 │-- package.json           # Project metadata
 │
 ├── /data                  # Decoupled Game State (The Database)
 │    │-- fish_data.json       # Master entity list (Weights, Prices, XP)
 │    └── modifiers_data.json  # Fixed scalar arrays for Mutations & Sizes
 │
 ├── /web                   # Frontend UI & Logic
 │    │-- index.html           # Main Appraiser Dashboard
 │    │-- tools.html           # Data Miner Reverse-Engineering Terminal
 │    │-- style.css            # Main UI Theme
 │    │-- tools.css            # Midnight Terminal Theme
 │    │-- app.js               # Core appraisal & forecasting engine
 │    │-- tools.js             # Data Miner reverse-algebra engine
 │    │-- /lang/               # Core Language Files
 │    └── /assets/             # Static branding images
 │
 └── /gitpreviews           # Documentation images


[⬆ Back to Top](https://github.com/VixenCreations/Fish-Appraiser-Engine#-table-of-contents)

---

## 🔬 The Nerd Stuff: Reverse-Engineered Mechanics

## 1. The Core Equation (Sine Curve)

Fish weights are not rolled linearly. The game rolls a hidden decimal (0.0 to 1.0), applies your Big Catch points as a shift, and plots it on a sin ease-out curve to bias catches toward the lower end of the weight spectrum.

**The Shift:**

EffectiveRoll = clamp(RandomRoll + (RodBC / 300), 0.0, 1.0)


**The Curve:**

WeightPercent = sin(EffectiveRoll * (π / 2))


**The Result:**
Rolling a 0.5 internally yields ~70.7% weight, not 50%. True 100% "Perfect" catches require an exact 1.0 roll, making them exponentially rare.

---

## 2. The Big Catch Shift (Floors & Ceilings)

Big Catch does not multiply weight; it shifts the RNG floor.

- 1 Big Catch Point = +0.00333... to RNG

### Floor Effect (Positive Buffs)

Example:

+90 Big Catch → min roll = 0.3
sin(0.3 * π/2) = 0.4539

You cannot catch below **45.39% size**.

### Ceiling Effect (Negative Penalties)

Example:

-90 Big Catch → max roll = 0.7
sin(0.7 * π/2) = 0.8910

You cannot catch above **89.10% size**.

---

## 3. Reverse-Algebra (Solving True Stats)

### Scenario A: Solving Max Weight


TrueBaseMax = ((ObservedMax - BaseMin) / MaxPercentile) + BaseMin


Example:

((1.00 - 0.1) / 0.8910) + 0.1 = 1.11kg


---

### Scenario B: Solving Min Weight


TrueBaseMin = (ObservedMin - (BaseMax * MinPercentile)) / (1 - MinPercentile)


Example:

(0.56 - (1.11 * 0.4539)) / (1 - 0.4539) = 0.10kg


---

## 4. The Economy Engine (Solving True Prices)

Price scales linearly between min and max weight.

Example:

0.0kg = $29
0.1kg = $31

ΔWeight = 0.1kg
ΔPrice = $2

Rate = $20 per kg


Solving max price:

$31 + (0.4kg * $20) = $39


---

## 5. The Hardware Cap (Rod Weight Limits)

Every rod has a max weight cap.

⚠️ If exceeded:
- Data becomes flatlined
- Calculations become invalid

Always test with rods above target fish weight.

---

## 6. Economy Clamping & Mutation Mechanics

### Tiny
- Forces weight = 0.0kg
- Price extrapolates backward

### Huge
- 4× weight scaling
- 2× price bounds

### Anti-Exploit Clamp
- Caps calculations at base max weight
- Applies flat 1.5× multiplier afterward

---

## 7. The Luck Engine (Exponential Scaling)


LuckMult = max(0.01, 1 + (TotalLuck / 100))
EffectiveWeight = BaseWeight * (LuckMult ^ ScaleFactor)

SpawnChance = (EffectiveWeight / TotalPoolWeight) * 100


### Scale Factors

- Trash: -1.0  
- Abundant: -1.2  
- Ultimate Secret: +1.26  

---

## 8. Cycle Time & Expected Yields

Cycle consists of:

- Wait Time (0–14s, scaled)
- Reel Time (weighted avg)
- Cast Delay (1.5s)


CatchesPerHour = 3600 / (Wait + Reel + 1.5)


[⬆ Back to Top](https://github.com/VixenCreations/Fish-Appraiser-Engine#-table-of-contents)
