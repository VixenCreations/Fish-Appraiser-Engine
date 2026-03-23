# 🐟 Fish! Appraiser Engine

[![Node.js](https://img.shields.io/badge/Node.js-Native-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Vanilla JS](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?style=flat-square&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-brightgreen?style=flat-square)](#)

A high-performance, zero-dependency local web engine built to reverse-engineer and calculate the exact dynamic economy of the VRChat world **Fish!**. 

> *I was bored and wanted something to do during my down time at work, so I built an engine that runs in NodeJS because I wanted a mathematically perfect companion app that didn't rely on bloated spreadsheets.* — **Vixenlicious**

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
```cmd
git clone https://github.com/VixenCreations/Fish-Appraiser-Engine.git
cd Fish-Appraiser-Engine
```
3. Start the local server:
```cmd
node server.js
```
*(Note: If updating from an older version, simply run `update.bat`)*

### 🐧 Linux Setup (Ubuntu/Debian)
1. Open your terminal. If you don't have Git and Node.js installed, grab them first:
```bash
sudo apt update
sudo apt install git nodejs -y
```
2. Clone the repository and enter the directory:
```bash
git clone https://github.com/VixenCreations/Fish-Appraiser-Engine.git
cd Fish-Appraiser-Engine
```
3. Start the local server:
```bash
node server.js
```
*(Note: If updating from an older version, simply run `./update.sh`)*

---

## 🌐 Usage & Navigation

Once your terminal confirms the server is online, open your web browser and navigate to:

* **The Main Appraiser:** `http://localhost:8080`
  * Calculate catch values, forecast XP efficiency, and analyze rarity drop rates based on your active in-game buffs.
* **The Data Miner Terminal:** `http://localhost:8080/tools`
  * A dedicated reverse-engineering sandbox. Input raw screen data from mutated catches to automatically strip multipliers, reverse the Sine curve, and validate true source-code integers against the community JSON database.

---

## ⚙️ Server Configuration

By default, the engine runs locally on port `8080`. You can override this by creating a `.env` file in the root directory. The engine natively supports secure live-web deployments via dynamic SSL toggling.

**Example `.env` (Production Deployment):**
```env
PORT=443
HOST=yourdomain.com
CACHE_MAX_AGE=86400

# Set to 'true' to enable HTTPS for live web deployment
USE_SSL=true
SSL_KEY=./certs/privkey.pem
SSL_CERT=./certs/fullchain.pem
```

---

## 📸 Engine Previews

<p align="center">
  <img src="gitpreviews/EnginePreview1.png" width="48%" alt="Engine Preview 1">
  <img src="gitpreviews/EnginePreview2.png" width="48%" alt="Engine Preview 2">
  <img src="gitpreviews/EnginePreview3.png" width="48%" alt="Engine Preview 3">
  <img src="gitpreviews/EnginePreview4.png" width="48%" alt="Engine Preview 4">
</p>

---

## 🚀 Core Features & Technical Capabilities

* **Reverse-Engineering Terminal:** A completely standalone `/tools` suite for spreadsheet maintainers. Automatically normalizes economy data, strips "Huge" and mutation multipliers, and performs algebraic diff-checks to expose inaccuracies in the community data.
* **Developer-Verified Catch Appraiser:** Uses linear interpolation (Lerp) to map the exact physical weight of your catch to its precise decimal coin value. 
* **XP Efficiency & Farm Forecaster:** End-to-end predictive analytics. Cross-references your live RNG rarity drop-tables against piecewise linear interpolated catch-cycle times to output your exact, dynamic average XP/Hour and XP/Minute.
* **Decoupled Data Architecture:** Game state data is isolated in JSON payloads. When the game receives a balance patch, simply update the JSON files in the `/data/` folder without ever touching the frontend code.
* **Zero-File Favicon:** Uses programmatic, server-side SVG interception to serve a scalable, high-resolution tab icon without cluttering the repository with binary `.ico` files.

---

## 📂 Architecture & Topology

The application relies on a strict separation of concerns (Structure, Logic, and Data) while isolating the frontend UI from the backend payloads for maximum security.

```text
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
 │    └── /assets/             # Static branding images
 │
 └── /gitpreviews           # Documentation images
```

---

## 🔬 The Nerd Stuff: Reverse-Engineered Mechanics

During the development of this engine, several core mechanics of the game's hidden source code were successfully reverse-engineered. The engine strictly adheres to these mathematical truths.

### 1. The RNG Weight Distribution Curve
Fish weights are not rolled linearly. The game uses a `Math.sin()` ease-out curve to bias catches toward the lower end of the weight spectrum.
* **The Math:** `WeightPercent = Math.sin(RandomRoll * (Math.PI / 2))`
* **The Result:** Rolling a `0.5` internally does not yield a 50% weight fish; it yields a `~70.7%` weight fish. True 100% "Perfect" catches require an exact `1.0` float roll, making them exponentially rarer than linear math would suggest.

### 2. Big Catch Mechanics (The RNG Shift)
The "Big Catch" rod stat does not multiply weight; it acts as a hard floor shift to the base RNG roll.
* **The Constant:** `1 Big Catch Point = +0.00333...` to the internal RNG Roll.
* **The Formula:** `EffectiveRoll = RandomRoll + (RodBC / 300)`
* **The Result:** A rod with `50 Big Catch` physically prevents the game from rolling an RNG value lower than `0.166`. When fed through the Sine curve, this guarantees a minimum weight percentile of `25.8%` for every non-Tiny catch.

### 3. Economy Clamping & Infinite Scaling
"Huge" variants uncouple physical scale from backend economy limits. 
* A Huge fish applies a `4x` multiplier to its physical base weight. However, the internal economy engine **hard-clamps** the pricing matrix at the species' `baseMaxW`. 
* **The Exploit Prevention:** If a fish's maximum base weight is `0.5kg`, and you catch a Huge variant weighing `1.3kg`, the engine calculates the coin value using exactly `0.5kg` before applying the flat `1.5x` Huge coin multiplier. 
* This allows players to catch physically massive "flex" fish without mathematically breaking the backend economy integer limits.
