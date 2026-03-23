let fishDatabase = [];
let currentSort = { column: null, direction: 'asc' };

// --- 1. BOOT SEQUENCE ---
async function initEngine() {
    try {
        const [fishResponse, modResponse] = await Promise.all([
            fetch('/data/fish_data.json'),
            fetch('/data/modifiers_data.json')
        ]);

        if (!fishResponse.ok || !modResponse.ok) throw new Error('Failed to load JSON payloads');
        
        fishDatabase = await fishResponse.json();
        const modifiersData = await modResponse.json();
        
        populateDropdowns(modifiersData);
        populateFishSelector();

        document.getElementById('loader').style.display = 'none';
        document.getElementById('mainEngineContainer').style.display = 'block';
        
        runAppraiser();
        renderMatrix();
    } catch (error) {
        document.getElementById('loader').innerHTML = `
            <span style="color: var(--warning)">Failed to fetch JSON payloads.<br>
            Ensure your Node server is running and the /data/ folder contains both JSON files.</span>
        `;
        console.error("Pipeline failed:", error);
    }
}

function populateDropdowns(modData) {
    const targets = [
        { mut: 'calcMutSelect', size: 'calcSizeSelect' },
        { mut: 'matrixMutSelect', size: 'matrixSizeSelect' }
    ];

    targets.forEach(t => {
        const mEl = document.getElementById(t.mut);
        const sEl = document.getElementById(t.size);
        mEl.innerHTML = ''; sEl.innerHTML = '';

        modData.mutations.forEach(mut => {
            const opt = document.createElement('option');
            opt.value = mut.value; opt.textContent = mut.label;
            mEl.appendChild(opt);
        });
        modData.sizes.forEach(size => {
            const opt = document.createElement('option');
            opt.value = size.id; opt.textContent = size.label;
            sEl.appendChild(opt);
        });
    });
}

function populateFishSelector() {
    const calcSelect = document.getElementById('calcFishSelect');
    const bcSelect = document.getElementById('bigCatchFishSelect'); // The new selector
    
    if (calcSelect) calcSelect.innerHTML = '';
    if (bcSelect) bcSelect.innerHTML = '';

    // Sort alphabetically for easier selection
    fishDatabase.sort((a,b) => a.name.localeCompare(b.name)).forEach((fish, i) => {
        const opt1 = document.createElement('option');
        opt1.value = i; 
        opt1.textContent = fish.name;
        calcSelect.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = i; 
        opt2.textContent = fish.name;
        if (bcSelect) bcSelect.appendChild(opt2);
    });
    updateWeightBounds();
}

// --- 2. THE APPRAISAL ENGINE (CLAMPED LINEAR LERP) ---
function updateWeightBounds() {
    const fishIndex = document.getElementById('calcFishSelect').value;
    const fish = fishDatabase[fishIndex];
    const sizeState = document.getElementById('calcSizeSelect').value;
    const weightInput = document.getElementById('calcWeightInput');
    const boundsLabel = document.getElementById('weightBounds');

    if (!fish) return;

    const min = parseFloat(fish.baseMinW);
    const max = parseFloat(fish.baseMaxW);

    if (sizeState === 'tiny') {
        // BUG 1 FIX: Lock the weight to the fish's exact baseMinW
        weightInput.value = min;
        weightInput.disabled = true;
        boundsLabel.innerText = `Locked to ${min}kg (Tiny)`;
        
        // Mark the input as locked so we know to clear it later
        weightInput.dataset.wasLocked = "true"; 
    } else {
        weightInput.disabled = false;
        
        // BUG 2 FIX: Remove the median auto-fill. Let the user start from 0.
        // If they just switched off "Tiny" or the box is empty, reset cleanly to 0.
        if (weightInput.dataset.wasLocked === "true" || !weightInput.value) {
            weightInput.value = 0;
            weightInput.dataset.wasLocked = "false";
        }
        
        boundsLabel.innerText = `Base Range: ${min}kg - ${max}kg (Price Clamped at Max)`;
    }
    runAppraiser();
}

function runAppraiser() {
    const fishIndex = document.getElementById('calcFishSelect').value;
    const fish = fishDatabase[fishIndex];
    if (!fish) return;

    const mutMult = parseFloat(document.getElementById('calcMutSelect').value);
    const sizeState = document.getElementById('calcSizeSelect').value;
    const weightInput = parseFloat(document.getElementById('calcWeightInput').value) || 0;
    const buffPercent = parseFloat(document.getElementById('calcBuffInput').value) || 0;
    
    const playerMultiplier = 1.0 + (buffPercent / 100);
    
    let baseValue = 0;
    const minW = parseFloat(fish.baseMinW);
    const maxW = parseFloat(fish.baseMaxW);
    const floor = fish.baseFloor;
    const ceil = fish.baseCeil;

    if (sizeState === 'tiny') {
        baseValue = floor;
    } else {
        let weightPercent = 0;
        if (maxW > minW) {
            weightPercent = (weightInput - minW) / (maxW - minW);
        }
        
        // THE FIX: Hard-clamp the Lerp to 1.0. 
        // Visual weight can go to infinity, but the price stops at the ceiling.
        weightPercent = Math.max(0, Math.min(1.0, weightPercent)); 
        
        baseValue = floor + ((ceil - floor) * weightPercent);
    }

    const sizeMult = (sizeState === 'huge') ? 1.5 : 1.0;
    const finalPrice = Math.round(baseValue * mutMult * sizeMult * playerMultiplier);

    const baseXP = fish.baseXP || 0;
    const perfXP = fish.perfectXP || 0;

    document.getElementById('outPrice').innerText = `$${finalPrice.toLocaleString()}`;
    document.getElementById('outXP').innerText = `+${baseXP} XP / +${perfXP} Perfect`;
}

// --- 3. MATRIX LOGIC ---
function sortData(column) {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column; currentSort.direction = 'asc';
    }

    document.querySelectorAll('th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === column) th.classList.add(`sort-${currentSort.direction}`);
    });

    fishDatabase.sort((a, b) => {
        let valA, valB;
        switch (column) {
            case 'name': valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); break;
            case 'rarity': valA = (a.rarity || "").toLowerCase(); valB = (b.rarity || "").toLowerCase(); break;
            case 'weight': valA = parseFloat(a.baseMaxW); valB = parseFloat(b.baseMaxW); break;
            case 'price': valA = a.baseCeil; valB = b.baseCeil; break;
            case 'basexp': valA = a.baseXP || 0; valB = b.baseXP || 0; break;
            case 'perfectxp': valA = a.perfectXP || 0; valB = b.perfectXP || 0; break;
            default: return 0;
        }
        if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });
    renderMatrix();
}

function renderMatrix() {
    if (fishDatabase.length === 0) return;

    const tbody = document.getElementById('tableBody');
    const mutFloat = parseFloat(document.getElementById('matrixMutSelect').value);
    const sizeState = document.getElementById('matrixSizeSelect').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    const isTiny = (sizeState === 'tiny');
    const isHuge = (sizeState === 'huge');
    const sizeFloat = isHuge ? 1.5 : 1.0;

    const fragment = document.createDocumentFragment();

    fishDatabase.forEach(fish => {
        const rarityKey = (fish.rarity || "unknown").toLowerCase();
        if (searchTerm && !fish.name.toLowerCase().includes(searchTerm) && !rarityKey.includes(searchTerm)) return;

        let floorFinal, ceilFinal, minWFinal, maxWFinal;

        if (isTiny) {
            floorFinal = Math.round(fish.baseFloor * mutFloat);
            ceilFinal = floorFinal; 
            minWFinal = "0.0"; maxWFinal = "0.0";
        } else {
            floorFinal = Math.round(fish.baseFloor * mutFloat * sizeFloat);
            ceilFinal = Math.round(fish.baseCeil * mutFloat * sizeFloat);
            
            const hugeTag = isHuge ? '<span class="huge-tag">Huge</span>' : '';
            minWFinal = fish.baseMinW + hugeTag;
            maxWFinal = fish.baseMaxW + hugeTag;
        }

        const baseXP = fish.baseXP || 0;
        const perfectXP = fish.perfectXP || 0;

        let rarityClass = "rarity-trash";
        if (rarityKey.includes("abundant")) rarityClass = "rarity-abundant";
        else if (rarityKey.includes("common")) rarityClass = "rarity-common";
        else if (rarityKey.includes("curious")) rarityClass = "rarity-curious";
        else if (rarityKey.includes("elusive")) rarityClass = "rarity-elusive";
        else if (rarityKey.includes("relic")) rarityClass = "rarity-relic";
        else if (rarityKey.includes("fabled")) rarityClass = "rarity-fabled";
        else if (rarityKey.includes("mythic")) rarityClass = "rarity-mythic";
        else if (rarityKey.includes("exotic")) rarityClass = "rarity-exotic";
        else if (rarityKey.includes("ultimate")) rarityClass = "rarity-ultimate";
        else if (rarityKey.includes("secret")) rarityClass = "rarity-secret";

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fish-name">${fish.name}</td>
            <td><span class="rarity-tag ${rarityClass}">${fish.rarity || 'Unknown'}</span></td>
            <td class="weight">${minWFinal}kg - ${maxWFinal}kg</td>
            <td class="money">$${floorFinal.toLocaleString()} - $${ceilFinal.toLocaleString()}</td>
            <td class="xp-val">+${baseXP}</td>
            <td class="xp-val">+${perfectXP}</td>
        `;
        fragment.appendChild(tr);
    });

    tbody.innerHTML = ''; 
    tbody.appendChild(fragment);
}

// --- 4. EVENT BINDINGS ---
document.addEventListener('DOMContentLoaded', () => {
    // Modal Interaction (Disclaimer, Credits, & Stats for Nerds)
    const disclaimerModal = document.getElementById('disclaimerModal');
    const creditsModal = document.getElementById('creditsModal');
    const nerdStatsModal = document.getElementById('nerdStatsModal');
    
    const discBtn = document.getElementById('disclaimerBtn');
    const credBtn = document.getElementById('creditsBtn');
    const nerdBtn = document.getElementById('nerdStatsBtn');
    
    const discClose = document.getElementById('closeModal');
    const credClose = document.getElementById('closeCreditsModal');
    const nerdClose = document.getElementById('closeNerdStatsModal');

    // Open Modals
    if (discBtn) discBtn.onclick = () => disclaimerModal.style.display = "block";
    if (credBtn) credBtn.onclick = () => creditsModal.style.display = "block";
    // Note: Using 'flex' for the Nerd modal keeps the terminal text perfectly centered!
    if (nerdBtn) nerdBtn.onclick = () => nerdStatsModal.style.display = "flex"; 

    // Close Modals (Buttons)
    if (discClose) discClose.onclick = () => disclaimerModal.style.display = "none";
    if (credClose) credClose.onclick = () => creditsModal.style.display = "none";
    if (nerdClose) nerdClose.onclick = () => nerdStatsModal.style.display = "none";
    
    // Close Modals (Clicking outside)
    window.onclick = (event) => {
        if (event.target == disclaimerModal) disclaimerModal.style.display = "none";
        if (event.target == creditsModal) creditsModal.style.display = "none";
        if (event.target == nerdStatsModal) nerdStatsModal.style.display = "none";
    };

    // Calculation Update Bindings
    document.getElementById('calcFishSelect').addEventListener('change', updateWeightBounds);
    document.getElementById('calcSizeSelect').addEventListener('change', updateWeightBounds);
    document.getElementById('calcMutSelect').addEventListener('change', runAppraiser);
    document.getElementById('calcWeightInput').addEventListener('input', runAppraiser);
    document.getElementById('calcBuffInput').addEventListener('input', runAppraiser);
    
    // Matrix Filter Bindings
    document.getElementById('matrixMutSelect').addEventListener('change', renderMatrix);
    document.getElementById('matrixSizeSelect').addEventListener('change', renderMatrix);
    document.getElementById('searchInput').addEventListener('input', renderMatrix);
    
    // Header Sort Bindings
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => sortData(th.dataset.sort));
    });

    // Luck Calculator Bindings
    ['luckRaw', 'luckBuffs', 'luckExternal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calculateLuck);
    });

    // Big Catch Bindings
    ['bigCatchPoints', 'bigCatchRoll', 'bigCatchFishSelect'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calculateBigCatch);
    });
    
    // XP Forecaster Bindings
    ['xpEnchant', 'xpAttraction', 'xpPerfect'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calculateXP);
    });

    initEngine();
    calculateLuck();
    calculateBigCatch();
});

// --- 5. LUCK & RARITY CALCULATOR ---

// --- OMNI-CALIBRATED RARITY WEIGHTS ---
// Mathematically solved exponents, now perfectly anchored to the 
// official 100.00% base rarity dataset (Total Base Weight = 10,000)
const rarityWeightPool = [
    { id: "trash", label: "Trash", baseWeight: 900, scaleFactor: 0.25, color: "#4a4a4a" },         // 9.00%
    { id: "abundant", label: "Abundant", baseWeight: 2700, scaleFactor: -0.25, color: "#6b7280" }, // 27.00%
    { id: "common", label: "Common", baseWeight: 2500, scaleFactor: 0.75, color: "#3b82f6" },      // 25.00%
    { id: "curious", label: "Curious", baseWeight: 1800, scaleFactor: 1.0, color: "#10b981" },     // 18.00%
    { id: "elusive", label: "Elusive", baseWeight: 1100, scaleFactor: 1.4, color: "#8b5cf6" },     // 11.00%
    { id: "relic", label: "Relic", baseWeight: 300, scaleFactor: 0.8, color: "#f59e0b" },          // 3.00%
    { id: "fabled", label: "Fabled", baseWeight: 440, scaleFactor: 1.15, color: "#ef4444" },       // 4.40%
    { id: "mythic", label: "Mythic", baseWeight: 250, scaleFactor: 1.05, color: "#ec4899" },       // 2.50%
    { id: "exotic", label: "Exotic", baseWeight: 8.5, scaleFactor: 1.25, color: "#14b8a6" },       // 0.085%
    { id: "secret", label: "Secret", baseWeight: 1.0, scaleFactor: 3.0, color: "#fbbf24" },        // 0.01%
    { id: "ultimate", label: "Ultimate Secret", baseWeight: 0.5, scaleFactor: 3.2, color: "#8b5cf6" } // 0.005%
];

function calculateLuck() {
    const rawLuck = parseFloat(document.getElementById('luckRaw').value) || 0;
    const buffs = parseFloat(document.getElementById('luckBuffs').value) || 1.0;
    const external = parseFloat(document.getElementById('luckExternal').value) || 1.0;

    // THE FIX: Restored the mathematically accurate order of operations!
    let luckMultiplier = 1 + ((rawLuck * buffs * external) / 100);
    
    // Engine Floor to prevent NaN crashes on stupidly negative luck.
    // This allows negative luck to naturally boost Abundant without breaking Math.pow()
    luckMultiplier = Math.max(0.01, luckMultiplier);

    const luckOut = document.getElementById('luckOutMult');
    if (luckOut) luckOut.value = luckMultiplier.toFixed(2) + "x";

    renderProbabilities(luckMultiplier);
    calculateXP(); 
}

function calculateBigCatch() {
    // 1. Gather Inputs
    // THE FIX: Removed the Math.max(0) floor to allow negative Big Catch points!
    const points = Math.min(100, parseFloat(document.getElementById('bigCatchPoints').value) || 0);
    const roll = Math.min(1.0, Math.max(0, parseFloat(document.getElementById('bigCatchRoll').value) || 0));
    
    const fishIndex = document.getElementById('bigCatchFishSelect').value;
    const fish = fishDatabase[fishIndex];

    // 2. The Dev-Confirmed Math Core
    const shift = points / 300;
    
    // User's Test Roll
    // We also need to clamp the effective roll from dropping below 0, or the Sine wave will dip negative!
    const effectiveRoll = Math.min(1.0, Math.max(0.0, roll + shift));
    const weightPercentile = Math.sin(effectiveRoll * (Math.PI / 2));
    const finalPercent = (weightPercentile * 100).toFixed(2);

    // Absolute Minimum Roll (0.0) mapping
    const minEffectiveRoll = Math.min(1.0, Math.max(0.0, 0.0 + shift));
    const minWeightPercentile = Math.sin(minEffectiveRoll * (Math.PI / 2));
    const minFinalPercent = (minWeightPercentile * 100).toFixed(2);

    // 3. Update the Percentile UI
    const outPercentEl = document.getElementById('bigCatchOutPercent');
    if (outPercentEl) outPercentEl.innerText = `${finalPercent}%`;
    
    // THE FIX: Dynamically show +/- so negative shifts look clean in the UI
    const descDisplay = document.getElementById('bigCatchOutDesc');
    if (descDisplay) {
        const sign = shift >= 0 ? "+" : "";
        descDisplay.innerText = `(Sine Curve Shifted by ${sign}${shift.toFixed(3)})`;
    }

    // 4. Translate Percentiles to Real Kilograms if a fish is loaded
    if (fish) {
        const minW = parseFloat(fish.baseMinW);
        const maxW = parseFloat(fish.baseMaxW);

        // Calculate Specific Roll Weight
        const calculatedWeight = minW + ((maxW - minW) * weightPercentile);
        document.getElementById('bigCatchOutWeight').innerText = `${calculatedWeight.toFixed(2)}kg`;

        // Calculate Explanation Box Range
        const absoluteMinWeight = minW + ((maxW - minW) * minWeightPercentile);
        
        document.getElementById('explainBcPoints').innerText = points;
        document.getElementById('bcMinPercentile').innerText = `${minFinalPercent}%`;
        document.getElementById('bcMinWeight').innerText = `${absoluteMinWeight.toFixed(2)}kg`;
        document.getElementById('bcMaxWeight').innerText = `${maxW.toFixed(2)}kg`;
    }
}

function renderProbabilities(luckMult) {
    const container = document.getElementById('probabilityBars');
    if (!container) return;
    container.innerHTML = '';

    let totalPoolWeight = 0;
    const calculatedWeights = [];

    // 1. Calculate the modified weight for each rarity tier
    rarityWeightPool.forEach(tier => {
        // THE FIX: Stripped out the weird Trash hack and restored pure dataset math
        let dynamicWeight = tier.baseWeight * Math.pow(luckMult, tier.scaleFactor);
        
        // Failsafe clamp to prevent negative weights breaking the pool
        dynamicWeight = Math.max(0, dynamicWeight); 

        calculatedWeights.push({ ...tier, currentWeight: dynamicWeight });
        totalPoolWeight += dynamicWeight;
    });

    // 2. Normalize to percentages and render DOM
    calculatedWeights.forEach(tier => {
        const percent = totalPoolWeight > 0 ? (tier.currentWeight / totalPoolWeight) * 100 : 0;
        
        const row = document.createElement('div');
        row.className = 'prob-row';
        row.innerHTML = `
            <div class="prob-label rarity-${tier.id}" style="background:none; color: ${tier.color};">${tier.label}</div>
            <div class="prob-bar-track">
                <div class="prob-bar-fill" style="width: ${percent}%; background-color: ${tier.color};"></div>
            </div>
            <div class="prob-percent">${percent.toFixed(2)}%</div>
        `;
        container.appendChild(row);
    });
}

// --- 6. XP EFFICIENCY FORECASTER ---

// Updated to include Developer-Confirmed Mini-Game Times
const rarityXpMap = {
    "trash": { base: 10, perf: 10, reel: 5.5 },
    "abundant": { base: 15, perf: 23, reel: 6.0 },
    "common": { base: 15, perf: 23, reel: 6.5 },
    "curious": { base: 20, perf: 30, reel: 7.0 },
    "elusive": { base: 20, perf: 30, reel: 8.0 },
    "relic": { base: 25, perf: 38, reel: 5.5 },
    "fabled": { base: 35, perf: 53, reel: 9.0 },
    "mythic": { base: 45, perf: 68, reel: 10.5 },
    "exotic": { base: 50, perf: 75, reel: 12.0 },
    "secret": { base: 60, perf: 90, reel: 9.0 },
    "ultimate": { base: 70, perf: 105, reel: 8.0 }
};

function calculateXP() {
    // 1. Gather Inputs
    const enchantBonus = parseFloat(document.getElementById('xpEnchant').value) || 0;
    const attractionRate = Math.max(0, Math.min(100, parseFloat(document.getElementById('xpAttraction').value) || 0));
    const perfRate = Math.max(0, Math.min(100, parseFloat(document.getElementById('xpPerfect').value) || 0)) / 100;
    
    // Grab the hidden luck multiplier
    const rawLuck = parseFloat(document.getElementById('luckRaw').value) || 0;
    const luckBuffs = parseFloat(document.getElementById('luckBuffs').value) || 1.0;
    const luckExt = parseFloat(document.getElementById('luckExternal').value) || 1.0;
    
    // THE FIX: Restored mathematically accurate order of operations!
    let luckMult = 1 + ((rawLuck * luckBuffs * luckExt) / 100);
    
    // THE ENGINE FIX: Apply the 0.01x hard floor to prevent NaN crashes
    luckMult = Math.max(0.01, luckMult);

    // 2. Piecewise Linear Interpolation (Lerp) for Attraction Time
    let attractionTime = 14.0; // Mathematically proven base for 0%
    const attrCurve = [
        { r: 0, t: 14.0 }, { r: 10, t: 12.6 }, { r: 20, t: 11.2 },
        { r: 30, t: 9.8 }, { r: 40, t: 8.4 }, { r: 65, t: 4.9 },
        { r: 70, t: 4.2 }, { r: 80, t: 2.8 }, { r: 90, t: 1.4 }, { r: 100, t: 0.0 }
    ];

    for (let i = 0; i < attrCurve.length - 1; i++) {
        if (attractionRate >= attrCurve[i].r && attractionRate <= attrCurve[i+1].r) {
            const progress = (attractionRate - attrCurve[i].r) / (attrCurve[i+1].r - attrCurve[i].r);
            attractionTime = attrCurve[i].t + (attrCurve[i+1].t - attrCurve[i].t) * progress;
            break;
        }
    }

    // 3. 4D Chess: Calculate Dynamic Average XP & Dynamic Reel Time
    let totalWeight = 0;
    let expectedXP = 0;
    let expectedReelTime = 0;

    rarityWeightPool.forEach(tier => {
        // THE FIX: Stripped out the bad Trash hack and restored pure dataset math
        let dynamicWeight = tier.baseWeight * Math.pow(luckMult, tier.scaleFactor);
        
        // Failsafe clamp to prevent negative weights breaking the pool
        dynamicWeight = Math.max(0, dynamicWeight); 

        totalWeight += dynamicWeight;

        // Calculate XP mapping
        const baseXP = rarityXpMap[tier.id].base;
        const perfXP = rarityXpMap[tier.id].perf;
        const tierAvgXP = (baseXP * (1 - perfRate)) + (perfXP * perfRate);

        // Fetch the specific reel time for this tier
        const tierReelTime = rarityXpMap[tier.id].reel;

        // Add the weighted values to the pool
        expectedXP += dynamicWeight * tierAvgXP;
        expectedReelTime += dynamicWeight * tierReelTime;
    });

    // Finalize the weighted averages
    const avgXpPerCatch = expectedXP / totalWeight;
    const avgReelTime = expectedReelTime / totalWeight;

    // Cycle Time now perfectly maps: Wait + Reel + Human/Animation Delay
    const castDelay = 1.5; 
    const cycleTime = attractionTime + avgReelTime + castDelay;
    
    const catchesPerHour = 3600 / cycleTime;
    const catchesPerMin = 60 / cycleTime;

    // 4. Final Math & UI Update
    const xpMultiplier = 1.0 + (enchantBonus / 100);
    const finalXpPerMin = catchesPerMin * avgXpPerCatch * xpMultiplier;
    const finalXpHour = catchesPerHour * avgXpPerCatch * xpMultiplier;

    // --- Update the 3-Stage Visual Timeline Bar ---
    const waitPct = (attractionTime / cycleTime) * 100;
    const reelPct = (avgReelTime / cycleTime) * 100;
    const castPct = (castDelay / cycleTime) * 100;
    
    document.getElementById('barWait').style.width = `${waitPct}%`;
    document.getElementById('barReel').style.width = `${reelPct}%`;
    document.getElementById('barCast').style.width = `${castPct}%`; // New delay bar

    // --- Push Data to the DOM ---
    document.getElementById('outCycleTime').innerText = cycleTime.toFixed(1);
    document.getElementById('outAttrTime').innerText = attractionTime.toFixed(1) + "s";
    document.getElementById('outReelTime').innerText = avgReelTime.toFixed(1) + "s";
    document.getElementById('outCastTime').innerText = castDelay.toFixed(1) + "s"; // Static lock
    document.getElementById('outAvgXp').innerText = avgXpPerCatch.toFixed(2);
    document.getElementById('outCatchesHour').innerText = Math.floor(catchesPerHour).toLocaleString();
    
    document.getElementById('outXpMin').innerText = finalXpPerMin.toLocaleString(undefined, { maximumFractionDigits: 0 });
    document.getElementById('outXpHour').innerText = finalXpHour.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
