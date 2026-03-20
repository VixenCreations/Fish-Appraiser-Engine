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
    const select = document.getElementById('calcFishSelect');
    // Sort alphabetically for easier selection
    fishDatabase.sort((a,b) => a.name.localeCompare(b.name)).forEach((fish, i) => {
        const opt = document.createElement('option');
        opt.value = i; 
        opt.textContent = fish.name;
        select.appendChild(opt);
    });
    updateWeightBounds();
}

// --- 2. THE APPRAISAL ENGINE (LINEAR LERP MATH) ---
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
        weightInput.value = 0;
        weightInput.disabled = true;
        boundsLabel.innerText = "Locked to 0.0kg (Tiny)";
    } else if (sizeState === 'huge') {
        // Huge range expands the visual upper limit for math calculations
        const estHugeMax = (max * 2.0).toFixed(1); 
        weightInput.disabled = false;
        if (!weightInput.value || weightInput.value < min) {
            weightInput.value = ((min + parseFloat(estHugeMax)) / 2).toFixed(2); 
        }
        boundsLabel.innerText = `Huge Range: ~${min}kg - ${estHugeMax}kg+`;
    } else {
        weightInput.disabled = false;
        if (!weightInput.value || weightInput.value < min || weightInput.value > max) {
            weightInput.value = ((min + max) / 2).toFixed(2); 
        }
        boundsLabel.innerText = `Standard Range: ${min}kg - ${max}kg`;
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
        // Dynamic Lerp Boundary: Stretches if Huge is selected
        const activeMaxW = (sizeState === 'huge') ? (maxW * 1.85) : maxW;
        
        let weightPercent = 0;
        if (activeMaxW > minW) {
            weightPercent = (weightInput - minW) / (activeMaxW - minW);
        }
        weightPercent = Math.max(0, Math.min(1, weightPercent)); 
        
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
		// Modal Interaction (Disclaimer & Credits)
    const disclaimerModal = document.getElementById('disclaimerModal');
    const creditsModal = document.getElementById('creditsModal');
    
    const discBtn = document.getElementById('disclaimerBtn');
    const credBtn = document.getElementById('creditsBtn');
    
    const discClose = document.getElementById('closeModal');
    const credClose = document.getElementById('closeCreditsModal');

    if (discBtn) discBtn.onclick = () => disclaimerModal.style.display = "block";
    if (discClose) discClose.onclick = () => disclaimerModal.style.display = "none";
    
    if (credBtn) credBtn.onclick = () => creditsModal.style.display = "block";
    if (credClose) credClose.onclick = () => creditsModal.style.display = "none";
    
    window.onclick = (event) => {
        if (event.target == disclaimerModal) disclaimerModal.style.display = "none";
        if (event.target == creditsModal) creditsModal.style.display = "none";
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

    // Huge Catch Bindings
    ['hugePoints', 'hugeBaseChance'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calculateHugeChance);
    });

    initEngine();
    calculateLuck(); 
    calculateHugeChance();
});

// --- 5. LUCK & RARITY CALCULATOR ---

// PLUG IN YOUR EXACT DECOMPILED WEIGHTS HERE
// The 'scaleFactor' simulates how the graph curves. 
// A negative scale drops the weight as luck increases. A positive scale raises it.
const rarityWeightPool = [
    { id: "trash", label: "Trash", baseWeight: 550, scaleFactor: -1.5, color: "#4a4a4a" },
    { id: "abundant", label: "Abundant", baseWeight: 1000, scaleFactor: -0.8, color: "#6b7280" },
    { id: "common", label: "Common", baseWeight: 300, scaleFactor: 0.2, color: "#3b82f6" },
    { id: "curious", label: "Curious", baseWeight: 100, scaleFactor: 0.8, color: "#10b981" },
    { id: "elusive", label: "Elusive", baseWeight: 40, scaleFactor: 1.2, color: "#8b5cf6" },
    { id: "relic", label: "Relic", baseWeight: 5, scaleFactor: 2.0, color: "#f59e0b" }, // Mirrors Mythic Math
    { id: "fabled", label: "Fabled", baseWeight: 15, scaleFactor: 1.5, color: "#ef4444" },
    { id: "mythic", label: "Mythic", baseWeight: 5, scaleFactor: 2.0, color: "#ec4899" },
    { id: "exotic", label: "Exotic", baseWeight: 1, scaleFactor: 2.5, color: "#14b8a6" },
    { id: "secret", label: "Secret", baseWeight: 0.5, scaleFactor: 3.0, color: "#fbbf24" },
    { id: "ultimate", label: "Ultimate Secret", baseWeight: 0.1, scaleFactor: 3.5, color: "#8b5cf6" }
];

function calculateLuck() {
    const rawLuck = parseFloat(document.getElementById('luckRaw').value) || 0;
    const buffs = parseFloat(document.getElementById('luckBuffs').value) || 1.0;
    const external = parseFloat(document.getElementById('luckExternal').value) || 1.0;

    // Mathematical Formula from __0_SelectRarityTier
    const luckMultiplier = 1 + ((rawLuck * buffs * external) / 100);
    const luckOut = document.getElementById('luckOutMult');
    if (luckOut) luckOut.value = luckMultiplier.toFixed(2) + "x";

    renderProbabilities(luckMultiplier);
}

function calculateHugeChance() {
    // 100 points = +1.0x extra multiplier
    const points = parseFloat(document.getElementById('hugePoints').value) || 0;
    const base = parseFloat(document.getElementById('hugeBaseChance').value) || 0;

    const hugeMultiplier = 1 + (points / 100);
    const finalChance = (base * hugeMultiplier).toFixed(2);

    const outChanceEl = document.getElementById('hugeOutChance');
    if (outChanceEl) outChanceEl.innerText = `${finalChance}%`;
    
    const multDisplay = document.getElementById('hugeMultiplierOut');
    if (multDisplay) multDisplay.innerText = `(${hugeMultiplier.toFixed(2)}x Multiplier)`;
}

function renderProbabilities(luckMult) {
    const container = document.getElementById('probabilityBars');
    if (!container) return;
    container.innerHTML = '';

    let totalPoolWeight = 0;
    const calculatedWeights = [];

    // 1. Calculate the modified weight for each rarity tier
    rarityWeightPool.forEach(tier => {
        // Dynamic Weighting Math
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