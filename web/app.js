let fishDatabase = [];
let modifierData = null;
let currentSort = { column: null, direction: 'asc' };

// =========================================================
// 0. LANGUAGE TRANSLATION ENGINE
// =========================================================
let langData = {};
let currentLang = localStorage.getItem('fishAppLang') || window.SERVER_DEFAULT_LANG || 'en';

async function loadLanguage(langCode) {
    try {
        const res = await fetch(`/lang/${langCode}.json`);
        if (!res.ok) throw new Error('Language payload failed');
        langData = await res.json();
        
        applyTranslations();
        
        localStorage.setItem('fishAppLang', langCode);
        const langSwitch = document.getElementById('langSwitch');
        if (langSwitch) langSwitch.value = langCode;

        // INSTANT TRANSLATION HOT-SWAP FOR UI DATA
        if (fishDatabase.length > 0 && modifierData) {
            populateDropdowns(modifierData);
            populateFishSelector();
            renderMatrix();
            
            // THE FIX: Force the JS-generated modules to redraw with the new language!
            calculateLuck();
            calculateBigCatch();
        }
        
    } catch (err) {
        console.error(`[i18n] Error loading language ${langCode}:`, err);
    }
}

function applyTranslations() {
    // Helper to resolve dot-notation paths (e.g., "header.dev_by" -> langData.header.dev_by)
    const resolvePath = (path, obj) => {
        return path.split('.').reduce((prev, curr) => prev ? prev[curr] : null, obj);
    };

    // 1. Translate Standard Text (innerHTML)
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = resolvePath(key, langData);
        if (text) el.innerHTML = text; // innerHTML preserves nested HTML like <strong> tags
    });

    // 2. Translate Placeholders (Input boxes)
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const text = resolvePath(key, langData);
        if (text) el.placeholder = text;
    });

    // 3. Translate Hover Tooltips (Title attributes)
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        const text = resolvePath(key, langData);
        if (text) el.title = text;
    });
}

// Bind Dropdown Listener & Boot Engine
document.addEventListener('DOMContentLoaded', () => {
    const langSwitch = document.getElementById('langSwitch');
    if (langSwitch) {
        langSwitch.value = currentLang;
        langSwitch.addEventListener('change', (e) => loadLanguage(e.target.value));
    }
    
    // Boot the language engine immediately
    loadLanguage(currentLang);
});

// --- 1. BOOT SEQUENCE ---
async function initEngine() {
    try {
        const [fishResponse, modResponse] = await Promise.all([
            fetch('/data/fish_data.json'),
            fetch('/data/modifiers_data.json')
        ]);

        if (!fishResponse.ok || !modResponse.ok) throw new Error('Failed to load JSON payloads');
        
        fishDatabase = await fishResponse.json();
        modifiersData = await modResponse.json();
        
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
        
        // Save current selection to prevent resetting user inputs on language swap
        const savedMut = mEl.value;
        const savedSize = sEl.value;
        
        mEl.innerHTML = ''; sEl.innerHTML = '';

        modData.mutations.forEach(mut => {
            const opt = document.createElement('option');
            opt.value = mut.value; 
            const translatedName = langData?.database?.modifiers?.[mut.id] || mut.label.split(' ')[0];
            opt.textContent = `${translatedName} (${mut.value.toFixed(1)}x)`;
            mEl.appendChild(opt);
        });
        modData.sizes.forEach(size => {
            const opt = document.createElement('option');
            opt.value = size.id; 
            opt.textContent = langData?.database?.modifiers?.[size.id] || size.label;
            sEl.appendChild(opt);
        });
        
        if (savedMut) mEl.value = savedMut;
        if (savedSize) sEl.value = savedSize;
    });
}

function populateFishSelector() {
    const calcSelect = document.getElementById('calcFishSelect');
    const bcSelect = document.getElementById('bigCatchFishSelect'); 
    
    const savedCalc = calcSelect ? calcSelect.value : null;
    const savedBc = bcSelect ? bcSelect.value : null;

    if (calcSelect) calcSelect.innerHTML = '';
    if (bcSelect) bcSelect.innerHTML = '';

    // Sort alphabetically by the TRANSLATED name
    fishDatabase.sort((a,b) => {
        const nameA = langData?.database?.fish?.[a.id] || a.name;
        const nameB = langData?.database?.fish?.[b.id] || b.name;
        return nameA.localeCompare(nameB);
    }).forEach((fish, i) => {
        const translatedName = langData?.database?.fish?.[fish.id] || fish.name;
        
        const opt1 = document.createElement('option');
        opt1.value = i; 
        opt1.textContent = translatedName;
        if (calcSelect) calcSelect.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = i; 
        opt2.textContent = translatedName;
        if (bcSelect) bcSelect.appendChild(opt2);
    });
    
    if (savedCalc) calcSelect.value = savedCalc;
    if (savedBc) bcSelect.value = savedBc;
    
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

				const translatedName = langData?.database?.fish?.[fish.id] || fish.name;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fish-name">${translatedName}</td>
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
    // Navigation Bindings
    const dataMinerBtn = document.getElementById('dataMinerBtn');
    if (dataMinerBtn) {
        dataMinerBtn.addEventListener('click', () => {
            window.location.href = '/tools';
        });
    }

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

// --- OMNI-CALIBRATED RARITY WEIGHTS (v1.9.5 Truth) ---
// Positive Exponents (scaleFactor) triangulated to Dev Constraints at 1,000 Luck.
// Negative Exponents (negScaleFactor) triangulated to empirical 500-catch data at -150 Luck.
const rarityWeightPool = [
    { id: "trash", label: "Trash", baseWeight: 900, scaleFactor: -1.0, negScaleFactor: -0.55, color: "#4a4a4a" },
    { id: "abundant", label: "Abundant", baseWeight: 2700, scaleFactor: -1.2, negScaleFactor: -0.26, color: "#6b7280" },
    { id: "common", label: "Common", baseWeight: 2500, scaleFactor: -0.2, negScaleFactor: 0.33, color: "#3b82f6" },
    { id: "curious", label: "Curious", baseWeight: 1800, scaleFactor: 0.1, negScaleFactor: 0.81, color: "#10b981" },
    { id: "elusive", label: "Elusive", baseWeight: 1100, scaleFactor: 0.2, negScaleFactor: 0.96, color: "#8b5cf6" },
    { id: "relic", label: "Relic", baseWeight: 300, scaleFactor: 0.4, negScaleFactor: 0.0, color: "#f59e0b" },
    { id: "fabled", label: "Fabled", baseWeight: 440, scaleFactor: 0.6, negScaleFactor: 1.6, color: "#ef4444" },
    { id: "mythic", label: "Mythic", baseWeight: 250, scaleFactor: 0.8, negScaleFactor: 1.7, color: "#ec4899" },
    { id: "exotic", label: "Exotic", baseWeight: 8.5, scaleFactor: 1.0, negScaleFactor: 1.8, color: "#14b8a6" },
    { id: "secret", label: "Secret", baseWeight: 1.0, scaleFactor: 1.15, negScaleFactor: 1.9, color: "#fbbf24" },
    { id: "ultimate", label: "Ultimate Secret", baseWeight: 0.5, scaleFactor: 1.26, negScaleFactor: 2.0, color: "#8b5cf6" }
];

function calculateLuck() {
    const rawLuck = parseFloat(document.getElementById('luckRaw').value) || 0;
    const buffs = parseFloat(document.getElementById('luckBuffs').value) || 1.0;
    const external = parseFloat(document.getElementById('luckExternal').value) || 1.0;

    let luckMultiplier = 1 + ((rawLuck * buffs * external) / 100);
    
    // THE FIX: Floor raised to 0.1 to perfectly map the -150 Luck benchmark to the negScaleFactors
    luckMultiplier = Math.max(0.1, luckMultiplier);

    const luckOut = document.getElementById('luckOutMult');
    if (luckOut) luckOut.value = luckMultiplier.toFixed(2) + "x";

    renderProbabilities(luckMultiplier);
    calculateXP(); 
}

function calculateBigCatch() {
    const points = Math.min(100, parseFloat(document.getElementById('bigCatchPoints').value) || 0);
    const roll = Math.min(1.0, Math.max(0, parseFloat(document.getElementById('bigCatchRoll').value) || 0));
    
    const fishIndex = document.getElementById('bigCatchFishSelect').value;
    const fish = fishDatabase[fishIndex];

    const shift = points / 300;
    
    const effectiveRoll = Math.min(1.0, Math.max(0.0, roll + shift));
    const weightPercentile = Math.sin(effectiveRoll * (Math.PI / 2));
    const finalPercent = (weightPercentile * 100).toFixed(2);

    const minEff = Math.max(0, Math.min(1, 0.0 + shift));
    const maxEff = Math.max(0, Math.min(1, 1.0 + shift));
    const minPct = Math.sin(minEff * (Math.PI / 2));
    const maxPct = Math.sin(maxEff * (Math.PI / 2));

    const outPercentEl = document.getElementById('bigCatchOutPercent');
    if (outPercentEl) outPercentEl.innerText = finalPercent + "%";
    
    const descDisplay = document.getElementById('bigCatchOutDesc');
    if (descDisplay) {
        const sign = shift >= 0 ? "+" : "";
        descDisplay.innerText = "(Sine Curve Shifted by " + sign + shift.toFixed(3) + ")";
    }

    if (fish) {
        const minW = parseFloat(fish.baseMinW);
        const maxW = parseFloat(fish.baseMaxW);

        const calculatedWeight = minW + ((maxW - minW) * weightPercentile);
        document.getElementById('bigCatchOutWeight').innerText = calculatedWeight.toFixed(2) + "kg";

        const trueMinW = minW + ((maxW - minW) * minPct);
        const trueMaxW = minW + ((maxW - minW) * maxPct);

        document.getElementById('bcMinWeight').innerText = trueMinW.toFixed(2) + "kg";
        document.getElementById('bcMaxWeight').innerText = trueMaxW.toFixed(2) + "kg";
        document.getElementById('bcMinPercentile').innerText = "( " + (minPct * 100).toFixed(2) + "% )";
        document.getElementById('bcMaxPercentile').innerText = "( " + (maxPct * 100).toFixed(2) + "% )";

				// 5. Dynamic Status and Explanation Text (i18n Compatible)
        // Using optional chaining (?.) to prevent crashes if the language payload is still loading
        let statusText = langData?.bc?.status_0 || "True 0% to 100% Range";
        let explanationText = langData?.bc?.explain_0 || "With 0 points, your catches will naturally span the entire database range. You have no artificial floor or ceiling limits applied.";

        if (points > 0) {
            statusText = (langData?.bc?.status_pos || "Floor Shifted to ") + (minPct*100).toFixed(1) + "%";
            
            explanationText = (langData?.bc?.explain_pos_1 || "With <strong style='color: var(--success);'>") + points + 
                              (langData?.bc?.explain_pos_2 || " points</strong>, your absolute worst-case RNG roll (0.0) is mathematically forced up to the <strong style='color: var(--success);'>") + (minPct*100).toFixed(2) + 
                              (langData?.bc?.explain_pos_3 || "%</strong> percentile. This guarantees you will NEVER catch a fish smaller than <strong style='color: var(--accent);'>") + trueMinW.toFixed(2) + 
                              (langData?.bc?.explain_pos_4 || "kg</strong>.");
        } else if (points < 0) {
            statusText = (langData?.bc?.status_neg || "Ceiling Penalized to ") + (maxPct*100).toFixed(1) + "%";
            
            explanationText = (langData?.bc?.explain_neg_1 || "With <strong style='color: var(--warning);'>") + points + 
                              (langData?.bc?.explain_neg_2 || " points</strong>, your absolute best-case RNG roll (1.0) is mathematically capped at the <strong style='color: var(--warning);'>") + (maxPct*100).toFixed(2) + 
                              (langData?.bc?.explain_neg_3 || "%</strong> percentile. This means it is physically impossible to catch a fish larger than <strong style='color: var(--accent);'>") + trueMaxW.toFixed(2) + 
                              (langData?.bc?.explain_neg_4 || "kg</strong>.");
        }

        document.getElementById('bcHardwareStatus').innerText = statusText;
        document.getElementById('explainBcPoints').innerHTML = explanationText;
    }
}

function renderProbabilities(luckMult) {
    const container = document.getElementById('probabilityBars');
    const simTbody = document.getElementById('simTableBody');
    
    if (container) container.innerHTML = '';
    if (simTbody) simTbody.innerHTML = '';

    let totalPoolWeight = 0;
    const calculatedWeights = [];

    rarityWeightPool.forEach(tier => {
        // DUAL-EXPONENT ENGINE: Flips to negative calibration if Luck < 1.0
        const activeScale = luckMult >= 1.0 ? tier.scaleFactor : tier.negScaleFactor;
        let dynamicWeight = tier.baseWeight * Math.pow(luckMult, activeScale);
        
        dynamicWeight = Math.max(0, dynamicWeight); 

        calculatedWeights.push({ ...tier, currentWeight: dynamicWeight });
        totalPoolWeight += dynamicWeight;
    });

    const formatSim = (val) => {
        if (val === 0) return "0";
        if (val < 1) return val.toFixed(2);
        return Math.round(val).toLocaleString();
    };

    const simFragment = document.createDocumentFragment();

		calculatedWeights.forEach(tier => {
        const rawDecimal = totalPoolWeight > 0 ? (tier.currentWeight / totalPoolWeight) : 0;
        const percent = rawDecimal * 100;
        
        // DYNAMIC TRANSLATION: Looks for the translated name, falls back to English if missing
        const translatedName = langData?.rarities?.[tier.id] || tier.label;
        
        if (container) {
            const row = document.createElement('div');
            row.className = 'prob-row';
            row.innerHTML = "<div class='prob-label rarity-" + tier.id + "' style='background:none; color: " + tier.color + ";'>" + translatedName + "</div>" +
                            "<div class='prob-bar-track'>" +
                            "<div class='prob-bar-fill' style='width: " + percent + "%; background-color: " + tier.color + ";'></div>" +
                            "</div>" +
                            "<div class='prob-percent'>" + percent.toFixed(2) + "%</div>";
            container.appendChild(row);
        }

        if (simTbody) {
            const tr = document.createElement('tr');
            tr.innerHTML = "<td style='padding: 10px 14px;'><span class='rarity-tag rarity-" + tier.id + "' style='font-size: 0.8em; padding: 4px 8px;'>" + translatedName + "</span></td>" +
                           "<td style='text-align: right; padding: 10px 14px; color: var(--text-main); font-family: Courier New, monospace; font-size: 1.05em;'>" + formatSim(rawDecimal * 100) + "</td>" +
                           "<td style='text-align: right; padding: 10px 14px; color: var(--text-main); font-family: Courier New, monospace; font-size: 1.05em;'>" + formatSim(rawDecimal * 250) + "</td>" +
                           "<td style='text-align: right; padding: 10px 14px; color: var(--text-main); font-family: Courier New, monospace; font-size: 1.05em;'>" + formatSim(rawDecimal * 500) + "</td>" +
                           "<td style='text-align: right; padding: 10px 14px; color: var(--accent); font-family: Courier New, monospace; font-size: 1.1em; font-weight: bold;'>" + formatSim(rawDecimal * 1000) + "</td>";
            simFragment.appendChild(tr);
        }
    });

    if (simTbody) simTbody.appendChild(simFragment);
}

// --- 6. XP EFFICIENCY FORECASTER ---

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
    const enchantBonus = parseFloat(document.getElementById('xpEnchant').value) || 0;
    const attractionRate = Math.max(0, Math.min(100, parseFloat(document.getElementById('xpAttraction').value) || 0));
    const perfRate = Math.max(0, Math.min(100, parseFloat(document.getElementById('xpPerfect').value) || 0)) / 100;
    
    const rawLuck = parseFloat(document.getElementById('luckRaw').value) || 0;
    const luckBuffs = parseFloat(document.getElementById('luckBuffs').value) || 1.0;
    const luckExt = parseFloat(document.getElementById('luckExternal').value) || 1.0;
    
    let luckMult = 1 + ((rawLuck * luckBuffs * luckExt) / 100);
    luckMult = Math.max(0.1, luckMult);

    let attractionTime = 14.0;
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

    let totalWeight = 0;
    let expectedXP = 0;
    let expectedReelTime = 0;

    rarityWeightPool.forEach(tier => {
        const activeScale = luckMult >= 1.0 ? tier.scaleFactor : tier.negScaleFactor;
        let dynamicWeight = tier.baseWeight * Math.pow(luckMult, activeScale);
        
        dynamicWeight = Math.max(0, dynamicWeight); 

        totalWeight += dynamicWeight;

        const baseXP = rarityXpMap[tier.id].base;
        const perfXP = rarityXpMap[tier.id].perf;
        const tierAvgXP = (baseXP * (1 - perfRate)) + (perfXP * perfRate);

        const tierReelTime = rarityXpMap[tier.id].reel;

        expectedXP += dynamicWeight * tierAvgXP;
        expectedReelTime += dynamicWeight * tierReelTime;
    });

    const avgXpPerCatch = expectedXP / totalWeight;
    const avgReelTime = expectedReelTime / totalWeight;

    const castDelay = 1.5; 
    const cycleTime = attractionTime + avgReelTime + castDelay;
    
    const catchesPerHour = 3600 / cycleTime;
    const catchesPerMin = 60 / cycleTime;

    const xpMultiplier = 1.0 + (enchantBonus / 100);
    const finalXpPerMin = catchesPerMin * avgXpPerCatch * xpMultiplier;
    const finalXpHour = catchesPerHour * avgXpPerCatch * xpMultiplier;

    const waitPct = (attractionTime / cycleTime) * 100;
    const reelPct = (avgReelTime / cycleTime) * 100;
    const castPct = (castDelay / cycleTime) * 100;
    
    document.getElementById('barWait').style.width = waitPct + "%";
    document.getElementById('barReel').style.width = reelPct + "%";
    document.getElementById('barCast').style.width = castPct + "%";

    document.getElementById('outCycleTime').innerText = cycleTime.toFixed(1);
    document.getElementById('outAttrTime').innerText = attractionTime.toFixed(1) + "s";
    document.getElementById('outReelTime').innerText = avgReelTime.toFixed(1) + "s";
    document.getElementById('outCastTime').innerText = castDelay.toFixed(1) + "s";
    document.getElementById('outAvgXp').innerText = avgXpPerCatch.toFixed(2);
    document.getElementById('outCatchesHour').innerText = Math.floor(catchesPerHour).toLocaleString();
    
    document.getElementById('outXpMin').innerText = finalXpPerMin.toLocaleString(undefined, { maximumFractionDigits: 0 });
    document.getElementById('outXpHour').innerText = finalXpHour.toLocaleString(undefined, { maximumFractionDigits: 0 });
}