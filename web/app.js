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
            calculateLuck();
            calculateBigCatch();
        }
        
    } catch (err) {
        console.error(`[i18n] Error loading language ${langCode}:`, err);
    }
}

function applyTranslations() {
    const resolvePath = (path, obj) => {
        return path.split('.').reduce((prev, curr) => prev ? prev[curr] : null, obj);
    };

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = resolvePath(key, langData);
        if (text) el.innerHTML = text; 
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const text = resolvePath(key, langData);
        if (text) el.placeholder = text;
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        const text = resolvePath(key, langData);
        if (text) el.title = text;
    });
}

// --- VIEW ROUTER (SPA ARCHITECTURE) ---
function setupViewRouter() {
    const toggleBtn = document.getElementById('toggleSidebar');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });
    }

    document.querySelectorAll('.nav-btn[data-target]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-btn[data-target]').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');

            const targetId = e.currentTarget.getAttribute('data-target');
            document.querySelectorAll('.app-view').forEach(view => {
                view.style.display = view.id === targetId ? 'block' : 'none';
                if(view.id === targetId) {
                    view.style.animation = 'none';
                    view.offsetHeight; 
                    view.style.animation = null;
                }
            });
        });
    });
}

// --- 1. BOOT SEQUENCE ---
async function initEngine() {
    try {
        const [fishResponse, modResponse] = await Promise.all([
            fetch('/data/fish_data.json'),
            fetch('/data/modifiers_data.json')
        ]);

        if (!fishResponse.ok || !modResponse.ok) throw new Error('Failed to load JSON payloads');
        
        fishDatabase = await fishResponse.json();
        modifierData = await modResponse.json();
        
        populateDropdowns(modifierData);
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
        
        const savedMut = mEl ? mEl.value : null;
        const savedSize = sEl ? sEl.value : null;
        
        if(mEl) mEl.innerHTML = ''; 
        if(sEl) sEl.innerHTML = '';

        modData.mutations.forEach(mut => {
            const opt = document.createElement('option');
            opt.value = mut.value; 
            const translatedName = langData?.database?.modifiers?.[mut.id] || mut.label.split(' ')[0];
            opt.textContent = `${translatedName} (${mut.value.toFixed(1)}x)`;
            if(mEl) mEl.appendChild(opt);
        });
        
        modData.sizes.forEach(size => {
            const opt = document.createElement('option');
            opt.value = size.id; 
            opt.textContent = langData?.database?.modifiers?.[size.id] || size.label;
            if(sEl) sEl.appendChild(opt);
        });
        
        if (mEl && savedMut) mEl.value = savedMut;
        if (sEl && savedSize) sEl.value = savedSize;
    });
}

function populateFishSelector() {
    const calcSelect = document.getElementById('calcFishSelect');
    const bcSelect = document.getElementById('bigCatchFishSelect'); 
    
    const savedCalc = calcSelect ? calcSelect.value : null;
    const savedBc = bcSelect ? bcSelect.value : null;

    if (calcSelect) calcSelect.innerHTML = '';
    if (bcSelect) bcSelect.innerHTML = '';

    fishDatabase.sort((a,b) => {
        const nameA = langData?.database?.fish?.[a.id] || a.name;
        const nameB = langData?.database?.fish?.[b.id] || b.name;
        return nameA.localeCompare(nameB);
    }).forEach((fish, i) => {
        const translatedName = langData?.database?.fish?.[fish.id] || fish.name;
        
        const opt1 = document.createElement('option');
        opt1.value = i; opt1.textContent = translatedName;
        if (calcSelect) calcSelect.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = i; opt2.textContent = translatedName;
        if (bcSelect) bcSelect.appendChild(opt2);
    });
    
    if (savedCalc) calcSelect.value = savedCalc;
    if (savedBc) bcSelect.value = savedBc;
    
    updateWeightBounds();
}

// --- 2. THE APPRAISAL ENGINE ---
function updateWeightBounds() {
    const fishIndex = document.getElementById('calcFishSelect').value;
    const fish = fishDatabase[fishIndex];
    const sizeState = document.getElementById('calcSizeSelect').value;
    const weightInput = document.getElementById('calcWeightInput');
    const boundsLabel = document.getElementById('weightBounds');

    if (!fish) return;

    const min = parseFloat(fish.baseMinW);
    const max = parseFloat(fish.baseMaxW);

    if (sizeState === 'size_tiny') {
        weightInput.value = min;
        weightInput.disabled = true;
        boundsLabel.innerText = `Locked to ${min}kg (Tiny)`;
        weightInput.dataset.wasLocked = "true"; 
    } else {
        weightInput.disabled = false;
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

    if (sizeState === 'size_tiny') {
        baseValue = floor;
    } else {
        let weightPercent = 0;
        if (maxW > minW) {
            weightPercent = (weightInput - minW) / (maxW - minW);
        }
        weightPercent = Math.max(0, Math.min(1.0, weightPercent)); 
        baseValue = floor + ((ceil - floor) * weightPercent);
    }

    const sizeMult = (sizeState === 'size_huge') ? 1.5 : 1.0;
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
    
    const isTiny = (sizeState === 'size_tiny');
    const isHuge = (sizeState === 'size_huge');
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
        const translatedRarity = langData?.rarities?.[rarityKey] || fish.rarity || 'Unknown';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fish-name">${translatedName}</td>
            <td><span class="rarity-tag ${rarityClass}">${translatedRarity}</span></td>
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
    
    // Init View Router
    setupViewRouter();

    // Tools Link
    const dataMinerBtn = document.getElementById('dataMinerBtn');
    if (dataMinerBtn) {
        dataMinerBtn.addEventListener('click', () => {
            window.location.href = '/tools.html';
        });
    }

    // Modal Interaction 
    const creditsModal = document.getElementById('creditsModal');
    const nerdStatsModal = document.getElementById('nerdStatsModal');
    
    const credBtn = document.getElementById('creditsBtn');
    const nerdBtn = document.getElementById('nerdStatsBtn');
    
    const credClose = document.getElementById('closeCreditsModal');
    const nerdClose = document.getElementById('closeNerdStatsModal');

    if (credBtn) credBtn.onclick = () => creditsModal.style.display = "block";
    if (nerdBtn) nerdBtn.onclick = () => nerdStatsModal.style.display = "flex"; 

    if (credClose) credClose.onclick = () => creditsModal.style.display = "none";
    if (nerdClose) nerdClose.onclick = () => nerdStatsModal.style.display = "none";
    
    window.onclick = (event) => {
        if (event.target == creditsModal) creditsModal.style.display = "none";
        if (event.target == nerdStatsModal) nerdStatsModal.style.display = "none";
    };

    // Calculation Update Bindings
    document.getElementById('calcFishSelect').addEventListener('change', updateWeightBounds);
    document.getElementById('calcSizeSelect').addEventListener('change', updateWeightBounds);
    document.getElementById('calcMutSelect').addEventListener('change', runAppraiser);
    document.getElementById('calcWeightInput').addEventListener('input', runAppraiser);
    document.getElementById('calcBuffInput').addEventListener('input', runAppraiser);
    
    document.getElementById('matrixMutSelect').addEventListener('change', renderMatrix);
    document.getElementById('matrixSizeSelect').addEventListener('change', renderMatrix);
    document.getElementById('searchInput').addEventListener('input', renderMatrix);
    
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => sortData(th.dataset.sort));
    });

    ['luckRaw', 'luckBuffs', 'luckExternal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calculateLuck);
    });

    ['bigCatchPoints', 'bigCatchRoll', 'bigCatchFishSelect'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calculateBigCatch);
    });
    
    ['xpEnchant', 'xpAttraction', 'xpPerfect'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calculateXP);
    });

    // --- THEME SWITCHER LOGIC ---
    const themeSwitch = document.getElementById('themeSwitch');
    if (themeSwitch) {
        // Set the dropdown to match saved preference
        themeSwitch.value = localStorage.getItem('fishAppTheme') || 'auto';
        
        themeSwitch.addEventListener('change', (e) => {
            const selectedTheme = e.target.value;
            localStorage.setItem('fishAppTheme', selectedTheme);
            
            // Reload the page instantly to evaluate the Bootloader <script> 
            // in the <head> and repaint the CSS :root variables flawlessly.
            window.location.reload();
        });
    }

    // Boot the language engine immediately
    const langSwitch = document.getElementById('langSwitch');
    if (langSwitch) {
        langSwitch.value = currentLang;
        langSwitch.addEventListener('change', (e) => loadLanguage(e.target.value));
    }
    loadLanguage(currentLang);
    initEngine();
});

// --- 5. LUCK & RARITY CALCULATOR ---
const rarityWeightPool = [
    { id: "trash", label: "Trash", baseWeight: 900, scaleFactor: -1.0, negScaleFactor: -0.55, color: "#4a4a4a" },
    { id: "abundant", label: "Abundant", baseWeight: 2700, scaleFactor: -1.2, negScaleFactor: -0.26, color: "#6b7280" },
    { id: "common", label: "Common", baseWeight: 2500, scaleFactor: -0.2, negScaleFactor: 0.33, color: "#3b82f6" },
    { id: "curious", label: "Curious", baseWeight: 1800, scaleFactor: 0.1, negScaleFactor: 0.81, color: "#10b981" },
    { id: "elusive", label: "Elusive", baseWeight: 1100, scaleFactor: 0.2, negScaleFactor: 0.96, color: "#8b5cf6" },
    { id: "relic", label: "Relic", baseWeight: 300, scaleFactor: 0.0, negScaleFactor: 0.0, color: "#f59e0b" }, // scaleFactors ignored now
    { id: "fabled", label: "Fabled", baseWeight: 440, scaleFactor: 0.6, negScaleFactor: 1.6, color: "#ef4444" },
    { id: "mythic", label: "Mythic", baseWeight: 250, scaleFactor: 0.8, negScaleFactor: 1.7, color: "#ec4899" },
    { id: "exotic", label: "Exotic", baseWeight: 8.5, scaleFactor: 1.0, negScaleFactor: 1.8, color: "#14b8a6" },
    { id: "secret", label: "Secret", baseWeight: 1.0, scaleFactor: 1.15, negScaleFactor: 1.9, color: "#fbbf24" },
    { id: "ultimate", label: "Ultimate Secret", baseWeight: 0.5, scaleFactor: 1.26, negScaleFactor: 2.0, color: "#8b5cf6" }
];

// --- NEW PIPELINE HELPER ---
// Single source of truth for generating the current pool state
function getDynamicPoolState(luckMult) {
    let otherTotalWeight = 0;
    const calculatedWeights = [];
    let relicTier = null;
    let relicIndex = -1;

    // Pass 1: Calculate standard scaling for everything EXCEPT the locked Relic tier
    rarityWeightPool.forEach((tier, index) => {
        if (tier.id === "relic") {
            relicTier = tier;
            relicIndex = index;
            return;
        }

        const activeScale = luckMult >= 1.0 ? tier.scaleFactor : tier.negScaleFactor;
        let dynamicWeight = tier.baseWeight * Math.pow(luckMult, activeScale);
        dynamicWeight = Math.max(0, dynamicWeight); 
        
        calculatedWeights.push({ ...tier, currentWeight: dynamicWeight });
        otherTotalWeight += dynamicWeight;
    });

    // Pass 2: Mathematically force Relic to equal exactly 3% of the final pool
    const relicWeight = (0.03 / 0.97) * otherTotalWeight;

    // Re-insert the Relic tier back into its original position to maintain UI order
    if (relicTier && relicIndex !== -1) {
        calculatedWeights.splice(relicIndex, 0, { ...relicTier, currentWeight: relicWeight });
    }

    return {
        calculatedWeights,
        totalPoolWeight: otherTotalWeight + relicWeight
    };
}


function calculateLuck() {
    const rawLuck = parseFloat(document.getElementById('luckRaw').value) || 0;
    const buffs = parseFloat(document.getElementById('luckBuffs').value) || 1.0;
    const external = parseFloat(document.getElementById('luckExternal').value) || 1.0;

    let luckMultiplier = 1 + ((rawLuck * buffs * external) / 100);
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

    // Delegate to the new pipeline
    const { calculatedWeights, totalPoolWeight } = getDynamicPoolState(luckMult);

    const formatSim = (val) => {
        if (val === 0) return "0";
        if (val < 1) return val.toFixed(2);
        return Math.round(val).toLocaleString();
    };

    const simFragment = document.createDocumentFragment();

    calculatedWeights.forEach(tier => {
        const rawDecimal = totalPoolWeight > 0 ? (tier.currentWeight / totalPoolWeight) : 0;
        const percent = rawDecimal * 100;
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

    let expectedXP = 0;
    let expectedReelTime = 0;

    // Delegate to the unified pipeline to ensure Relics are mathematically locked to 3%
    const { calculatedWeights, totalPoolWeight } = getDynamicPoolState(luckMult);

    calculatedWeights.forEach(tier => {
        const baseXP = rarityXpMap[tier.id].base;
        const perfXP = rarityXpMap[tier.id].perf;
        const tierAvgXP = (baseXP * (1 - perfRate)) + (perfXP * perfRate);
        const tierReelTime = rarityXpMap[tier.id].reel;

        expectedXP += tier.currentWeight * tierAvgXP;
        expectedReelTime += tier.currentWeight * tierReelTime;
    });

    // Safeguard against division by zero if totalPoolWeight somehow zeroes out
    const avgXpPerCatch = totalPoolWeight > 0 ? (expectedXP / totalPoolWeight) : 0;
    const avgReelTime = totalPoolWeight > 0 ? (expectedReelTime / totalPoolWeight) : 0;

    const castDelay = 1.5; 
    const cycleTime = attractionTime + avgReelTime + castDelay;
    
    const catchesPerHour = cycleTime > 0 ? (3600 / cycleTime) : 0;
    const catchesPerMin = cycleTime > 0 ? (60 / cycleTime) : 0;

    const xpMultiplier = 1.0 + (enchantBonus / 100);
    const finalXpPerMin = catchesPerMin * avgXpPerCatch * xpMultiplier;
    const finalXpHour = catchesPerHour * avgXpPerCatch * xpMultiplier;

    const waitPct = cycleTime > 0 ? ((attractionTime / cycleTime) * 100) : 0;
    const reelPct = cycleTime > 0 ? ((avgReelTime / cycleTime) * 100) : 0;
    const castPct = cycleTime > 0 ? ((castDelay / cycleTime) * 100) : 0;
    
    // UI Update Phase
    const barWait = document.getElementById('barWait');
    const barReel = document.getElementById('barReel');
    const barCast = document.getElementById('barCast');
    
    if (barWait) barWait.style.width = waitPct + "%";
    if (barReel) barReel.style.width = reelPct + "%";
    if (barCast) barCast.style.width = castPct + "%";

    // Helper to safely set innerText without repeating null checks
    const setInnerText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    };

    setInnerText('outCycleTime', cycleTime.toFixed(1));
    setInnerText('outAttrTime', attractionTime.toFixed(1) + "s");
    setInnerText('outReelTime', avgReelTime.toFixed(1) + "s");
    setInnerText('outCastTime', castDelay.toFixed(1) + "s");
    setInnerText('outAvgXp', avgXpPerCatch.toFixed(2));
    setInnerText('outCatchesHour', Math.floor(catchesPerHour).toLocaleString());
    setInnerText('outXpMin', finalXpPerMin.toLocaleString(undefined, { maximumFractionDigits: 0 }));
    setInnerText('outXpHour', finalXpHour.toLocaleString(undefined, { maximumFractionDigits: 0 }));
}

// =========================================================
// 7. SCRAP LOOT SIMULATOR ENGINE (Calibrated to 762 Rolls)
// =========================================================
const scrapData = [
    { id: 'scrap', weight: 128, color: '#888888' },
    { id: 'coin_500', weight: 128, color: '#fbbf24' },
    { id: 'coin_1000', weight: 117, color: '#fbbf24' },
    { id: 'coin_10k', weight: 5, color: '#f59e0b' },
    { id: 'potion_luck', weight: 67, color: '#a855f7' },
    { id: 'potion_speed', weight: 63, color: '#00e6ff' },
    { id: 'relic_frag', weight: 134, color: '#f59e0b' }, 
    { id: 'relic_mossy', weight: 16, color: '#10b981' },
    { id: 'relic_powerful', weight: 1, color: '#ef4444' }, 
    { id: 'xp_500', weight: 103, color: '#a855f7' }
];

// Calculate this once at runtime so your data array is the single source of truth
const TOTAL_SCRAP_WEIGHT = scrapData.reduce((sum, item) => sum + item.weight, 0);

function renderScrapTable(simulatedResults = null) {
    const tbody = document.getElementById('scrapTableBody');
    if (!tbody) return;
    
    const rolls = parseInt(document.getElementById('scrapRollsInput').value) || 0;
    tbody.innerHTML = '';
    
    scrapData.forEach(item => {
        const rate = (item.weight / TOTAL_SCRAP_WEIGHT) * 100;
        const expected = (item.weight / TOTAL_SCRAP_WEIGHT) * rolls;
        
        let simText = "---";
        if (simulatedResults) {
            simText = simulatedResults[item.id] || 0;
        }
        
        const translatedName = langData?.scrap_items?.[item.id] || item.id;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="scrap-item-name" style="color: ${item.color};">${translatedName}</td>
            <td class="scrap-rate">${rate.toFixed(2)}%</td>
            <td class="scrap-expected">${expected.toFixed(1)}</td>
            <td class="scrap-simulated">${simText}</td>
        `;
        tbody.appendChild(tr);
    });
}

function simulateScrapRNG() {
    const rolls = parseInt(document.getElementById('scrapRollsInput').value) || 0;
    const results = {};
    scrapData.forEach(i => results[i.id] = 0);
    
    for(let i = 0; i < rolls; i++) {
        let roll = Math.random() * TOTAL_SCRAP_WEIGHT;
        let current = 0;
        for(let item of scrapData) {
            current += item.weight;
            if(roll <= current) {
                results[item.id]++;
                break;
            }
        }
    }
    renderScrapTable(results);
}

// Bind the Scrap buttons
document.addEventListener('DOMContentLoaded', () => {
    const btnExpected = document.getElementById('btnScrapExpected');
    const btnSimulate = document.getElementById('btnScrapSimulate');
    const scrapInput = document.getElementById('scrapRollsInput');

    if(btnExpected) btnExpected.addEventListener('click', () => renderScrapTable(null));
    if(btnSimulate) btnSimulate.addEventListener('click', simulateScrapRNG);
    if(scrapInput) scrapInput.addEventListener('input', () => renderScrapTable(null));
});