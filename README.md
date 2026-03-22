# 🐟 Fish! Appraiser Engine

[![Node.js](https://img.shields.io/badge/Node.js-Native-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Vanilla JS](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?style=flat-square&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-brightgreen?style=flat-square)](#)

A high-performance, zero-dependency local web engine built to reverse-engineer and calculate the exact dynamic economy of the VRChat world **Fish!**. 

*I was bored and wanted something to do during my down time at work, so I built an engine that runs in NodeJS because I wanted a mathematically perfect companion app that didn't rely on bloated spreadsheets.*

## 📸 Engine Preview

<p align="center">
  <img src="gitpreviews/EnginePreview1.png" width="48%" alt="Engine Preview 1">
  <img src="gitpreviews/EnginePreview2.png" width="48%" alt="Engine Preview 2">
  <img src="gitpreviews/EnginePreview3.png" width="48%" alt="Engine Preview 2">
  <img src="gitpreviews/EnginePreview4.png" width="48%" alt="Engine Preview 2">
</p>

## 🚀 Features

* **Developer-Verified Catch Appraiser:** Uses linear interpolation (Lerp) to map the exact physical weight of your catch to its precise decimal coin value. The math is hardcoded to perfectly mirror the game's hidden economy failsafes, actively clamping the base price at `1.0` (the price ceiling) before applying post-calculation multipliers.
* **XP Efficiency & Farm Forecaster:** End-to-end predictive analytics. Cross-references your live RNG rarity drop-tables against piecewise linear interpolated catch-cycle times to output your exact, dynamic average XP/Hour and XP/Minute.
* **Big Catch (Weight Distro) Analyzer:** Unlocks the game's hidden ease-out sine curve generation `sin(Roll * π/2)`. Accurately calculates the exact +0.333 RNG floor shift provided by maxed Big Catch points, instantly translating abstract math percentiles into guaranteed physical kilogram ranges for any target fish.
* **Infinite 'Huge' Visual Scaling:** Automatically detects and uncouples visual weight boundaries for "Huge" catches—allowing weights to roll infinitely into the hundreds of thousands of kilograms for the flex—while gracefully enforcing the backend economy caps to prevent mathematical overflow.
* **Global Buff Injection:** Input your active account modifiers to perfectly sync the engine's output with your in-game shop UI. *(Note: Keep increasing this by 1% until it matches the shop after base calculations are done. I currently have an unexplained 10% buff active, awaiting dev clarification!)*
* **Decoupled Data Architecture:** Game state data is isolated in JSON payloads (`fish_data.json` & `modifiers_data.json`). When the game receives a balance patch, simply update the JSON files without ever touching the frontend code.
* **Zero-Dependency Backend:** Runs on a native Node.js HTTP server. No `package.json`, no `npm install`, no `node_modules` black hole. Simply execute `node server.js` and you are live.
* **Zero-File Favicon:** Uses programmatic, server-side SVG interception to serve a scalable, high-resolution tab icon without cluttering the repository with binary `.ico` files.
* **"Glassmorphism" UI:** A sleek, dark-mode dashboard featuring etched-glass typography, volumetric CSS text-shadows, and dynamic flexbox probability charts.

## 📂 Architecture & Topology

The application relies on a strict separation of concerns (Structure, Presentation, Logic, and Data) while maintaining a flat, easily navigable root directory:

```text
/Fish-Appraiser-Engine
 │-- .env                   # Local network configuration (Port/Host overrides)
 │-- server.js              # Native Node.js web server & routing
 │-- index.html             # UI Structure & Dashboard
 │-- style.css              # Dark mode UI & Rarity color matrix
 │-- app.js                 # Calculation engine & asynchronous data ingestion
 │-- package.json           # Project metadata
 │
 ├── /assets                # Static branding assets
 ├── /data                  # Decoupled Game State
 │    │-- fish_data.json       # Master entity list (Base weights, Prices, XP)
 │    └── modifiers_data.json  # Fixed scalar arrays for Mutations & Sizes
 │
 └── EnginePreview1 & 2     # Documentation images
```

# 🛠️ Installation & Usage

This engine runs entirely on native Node.js modules (`http`, `fs`, `path`). There are **no dependencies** to install (`npm install` is not required). 

Ensure you have [Git](https://git-scm.com/) and [Node.js](https://nodejs.org/) installed on your system before proceeding.

### 🪟 Windows Setup

1. Open **Command Prompt** or **PowerShell**.
2. Clone the repository and enter the directory:
   ```cmd
   git clone https://github.com/VixenCreations/Fish-Appraiser-Engine.git
   ```
   ```cmd
   cd Fish-Appraiser-Engine
   ```
3. Start the local server:
   ```cmd
   node server.js
   ```
   
4. If you are updating from an older version simply delete the old version or run the update.bat
   
### 🐧 Linux Setup (Ubuntu/Debian)

1. Open your terminal. If you don't have Git and Node.js installed, grab them first:
   ```bash
   sudo apt update
   sudo apt install git nodejs -y
   ```
2. Clone the repository and enter the directory:
   ```bash
   git clone https://github.com/VixenCreations/Fish-Appraiser-Engine.git
   ```
   ```bash
   cd Fish-Appraiser-Engine
   ```
3. Start the local server:
   ```bash
   node server.js
   ```

4. If you are updating from an older version simply delete the old version or run the update.sh

### 🌐 Accessing the App

Once your terminal confirms the server is online, open your web browser and navigate to:
**`http://localhost:8080`**
