# 🐟 Fish! Appraiser Engine

[![Node.js](https://img.shields.io/badge/Node.js-Native-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Vanilla JS](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?style=flat-square&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-brightgreen?style=flat-square)](#)

A high-performance, zero-dependency local web engine built to reverse-engineer and calculate the exact dynamic economy of the VRChat world **Fish!**. 

*I was bored and wanted something to do during my down time at work, so i built an engine that runs in nodeJS because I wanted a mathematically perfect companion app that didn't rely on bloated spreadsheets.*

## 📸 Engine Preview

<p align="center">
  <img src="EnginePreview1.png" width="48%" alt="Engine Preview 1">
  <img src="EnginePreview2.png" width="48%" alt="Engine Preview 2">
</p>

## 🚀 Features

* **Real-Time Catch Appraiser:** Uses linear interpolation (Lerp) to map the exact visual weight of your catch to its precise decimal coin value within the game's hidden floor/ceiling thresholds.
* **Dynamic 'Huge' Scaling:** Automatically detects and uncouples weight boundaries for "Huge" modifier catches, mathematically accommodating the game's inflated randomizer.
* **Global Buff Injection:** Input your active account modifiers (e.g., keep increasing by 1 until it matches the shop after base calculations are done, currently i have a 10% buff somewhere and asked the devs to check where and will update this later as to where it came from) to perfectly sync the engine's output with your in-game shop UI.
* **Decoupled Data Architecture:** Game state data is isolated in JSON payloads (`fish_data.json` & `modifiers_data.json`). When the game receives a balance patch, simply update the JSON files without ever touching the frontend code.
* **Zero-Dependency Backend:** Runs on a native Node.js HTTP server. No `package.json`, no `npm install`, no `node_modules` black hole.
* **Zero-File Favicon:** Uses a programmatic, server-side SVG interception to serve a scalable tab icon without cluttering the repository with binary `.ico` files.

## 📂 Architecture & Topology

The application relies on a strict separation of concerns (Structure, Presentation, Logic, and Data):

```text
/WikiFish-Engine
 │-- server.js              # Native Node.js web server & routing
 │-- index.html             # UI Structure & Dashboard
 │-- style.css              # Dark mode UI & Rarity color matrix
 │-- app.js                 # Calculation engine & asynchronous data ingestion
 │
 └── /data                  # Decoupled Game State
      │-- fish_data.json       # Master entity list (Base weights, Prices, XP)
      │-- modifiers_data.json  # Fixed scalar arrays for Mutations & Sizes
