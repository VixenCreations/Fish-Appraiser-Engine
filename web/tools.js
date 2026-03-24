// =========================================================
// REVERSE-ENGINEERING MATH ENGINE (TOOLS PAGE)
// =========================================================

let fishDatabase = {};
let modifierData = { mutations: [], sizes: [] };
let activeKey = null;

// --- 1. BOOT TERMINAL ---
async function bootTerminal() {
    try {
        const [fishRes, modRes] = await Promise.all([
            fetch('/data/fish_data.json'),
            fetch('/data/modifiers_data.json')
        ]);
        
        if (!fishRes.ok || !modRes.ok) throw new Error('Data payload error');
        
        const fData = await fishRes.json();
        modifierData = await modRes.json();
        
        populateSelectors(fData);
    } catch (err) {
        console.error("Boot Error:", err);
        document.getElementById('dmOutput').innerHTML = '<span style="color:#ff3366">> ERROR: Payload 404.</span>';
    }
}

function populateSelectors(fData) {
    const fSel = document.getElementById('fishSelector');
    fSel.innerHTML = '<option value="">-- Select Target --</option>';
    
    Object.keys(fData).sort((a,b) => fData[a].name.localeCompare(fData[b].name)).forEach(k => {
        fishDatabase[k] = fData[k];
        let opt = document.createElement('option');
        opt.value = k; opt.textContent = fData[k].name;
        fSel.appendChild(opt);
    });

    ['A', 'B'].forEach(t => {
        const mSel = document.getElementById(`mut${t}`);
        const sSel = document.getElementById(`size${t}`);
        
        modifierData.mutations.forEach(m => {
            let opt = document.createElement('option');
            opt.value = m.value; opt.textContent = m.label;
            mSel.appendChild(opt);
        });

        modifierData.sizes.forEach(s => {
            let opt = document.createElement('option');
            opt.value = s.multiplier; opt.textContent = s.label;
            opt.dataset.id = s.id; 
            sSel.appendChild(opt);
        });
    });
}

// --- 2. THE REVERSE-ALGEBRA ENGINE ---
function runMathEngine() {
    const out = document.getElementById('dmOutput');
    const sBox = document.getElementById('activeFishStats');
    if (!activeKey || !fishDatabase[activeKey]) return;

    const db = fishDatabase[activeKey];
    
    const dbMinW = parseFloat(db.baseMinW) || 0;
    const dbMaxW = parseFloat(db.baseMaxW) || 0;
    const dbFloor = parseFloat(db.baseFloor) || 0;
    const dbCeil = parseFloat(db.baseCeil) || 0;
    const rodBC = parseFloat(document.getElementById('rodBC').value) || 0;
    
    // SMART DETECTION: Are we Validating known data, or Discovering unknown data?
    const isDiscoveryMode = (dbMinW === 0 && dbMaxW === 0) || (dbFloor === 0 && dbCeil === 0);

    // Update Header Status
    if (isDiscoveryMode) {
        sBox.innerHTML = `> <span style="color:#a855f7; font-weight:bold;">[DISCOVERY MODE INITIATED]</span> Database variables missing. Triangulating source code...`;
    } else {
        sBox.innerHTML = `> <span style="color:#00e6ff; font-weight:bold;">[TARGET LOCKED]</span> ${dbMinW}kg (Min) to ${dbMaxW}kg (Max)`;
    }

    // EXTRACTOR
    const getCatch = (t) => {
        const sEl = document.getElementById(`size${t}`);
        const sOpt = sEl.selectedOptions[0];
        
        return {
            w: parseFloat(document.getElementById(`w${t}`).value),
            p: parseFloat(document.getElementById(`p${t}`).value),
            mMult: parseFloat(document.getElementById(`mut${t}`).value),
            sMult: parseFloat(document.getElementById(`size${t}`).value),
            isHuge: sOpt && sOpt.dataset.id === 'huge',
            isTiny: sOpt && sOpt.dataset.id === 'tiny'
        };
    };

    const cA = getCatch('A');
    const cB = getCatch('B');

    if (isNaN(cA.w) || isNaN(cA.p) || isNaN(cB.w) || isNaN(cB.p)) return;

    if (cA.w === cB.w) {
        out.innerHTML = '<span style="color:#ff3366">> ERROR: A weight variance is mathematically required to triangulate economy scaling.</span>';
        return;
    }

    // STRIP COIN MULTIPLIERS & AUTO-SORT
    cA.nP = cA.p / (cA.mMult * cA.sMult);
    cB.nP = cB.p / (cB.mMult * cB.sMult);

    // The Global Idiot-Proofing: Automatically sorts the heavy and light fish, regardless of which box the user used
    const isAGreater = cA.w > cB.w;
    const heavy = isAGreater ? cA : cB;
    const light = isAGreater ? cB : cA;

		// ==========================================
    // FORK A: DISCOVERY MODE (Triangulating Unknowns)
    // ==========================================
    if (isDiscoveryMode) {
        // 1. Economy Scaling
        const rate = (heavy.nP - light.nP) / (heavy.w - light.w);
        const pZero = heavy.nP - (rate * heavy.w);

        // 2. Weight Distribution Curves 
        const bcShift = rodBC / 300;
        
        // Calculate the physical percentiles based on the rod shift
        const minEff = Math.max(0, Math.min(1, 0.0 + bcShift));
        const maxEff = Math.max(0, Math.min(1, 1.0 + bcShift));
        const minPct = Math.sin(minEff * (Math.PI / 2));
        const maxPct = Math.sin(maxEff * (Math.PI / 2));

        if (maxPct === minPct) {
            out.innerHTML = '<span style="color:#ff3366">> ERROR: Sine curve collapsed. Cannot solve with these Rod stats.</span>';
            return;
        }

        // 3. Solve True Weights algebraically
        const weightRange = (heavy.w - light.w) / (maxPct - minPct);
        const trueMinW = light.w - (weightRange * minPct);
        const trueMaxW = trueMinW + weightRange;

        // 4. Solve True Base Prices
        const trueFloor = Math.round(pZero + (rate * trueMinW));
        const trueCeil = Math.round(pZero + (rate * trueMaxW));

        // Dynamic hardware text to prove the engine is processing negative stats properly
        let hardwareStatus = "";
        if (rodBC > 0) hardwareStatus = `Floor Shifted to ${(minPct*100).toFixed(1)}%`;
        else if (rodBC < 0) hardwareStatus = `Ceiling Penalized to ${(maxPct*100).toFixed(1)}%`;
        else hardwareStatus = "True 0% to 100% Range";

        out.innerHTML = `
            <div class="output-block" style="border-left: 3px solid #a855f7; padding-left: 15px;">
                <span class="math-step">// 1. Reverse-Engineered Weight Limits</span><br>
                <span class="math-step" style="color:#00e6ff">> Hardware Status: ${hardwareStatus}</span><br>
                > TRUE MIN WEIGHT: <span class="math-highlight">${trueMinW.toFixed(2)}kg</span> (Derived from ${light.w}kg)<br>
                > TRUE MAX WEIGHT: <span class="math-highlight">${trueMaxW.toFixed(2)}kg</span> (Derived from ${heavy.w}kg)
            </div>
            <div class="output-block" style="border-left: 3px solid #ffaa00; padding-left: 15px; margin-top: 15px;">
                <span class="math-step">// 2. Economy Engine Discovered</span><br>
                > BASE FLOOR PRICE: <span class="rate-highlight">${trueFloor} coins</span><br>
                > BASE CEIL PRICE: <span class="rate-highlight">${trueCeil} coins</span><br>
                <span class="math-step">Scaling Rate: ${rate.toFixed(2)} coins per 1.0kg (Zero-Weight: ${Math.round(pZero)} coins)</span>
            </div>
            <div style="margin-top: 15px; color: #00ffaa;">> Ready for JSON Injection. Update database with these values.</div>
        `;
        return;
    }

    // ==========================================
    // FORK B: VALIDATOR MODE (Diff-checking knowns)
    // ==========================================
    
    // ECONOMY WEIGHT CLAMPING (Only applies if we know the DB limits)
    const eHeavyW = heavy.isTiny ? dbMinW : Math.max(dbMinW, Math.min(dbMaxW, heavy.w));
    const eLightW = light.isTiny ? dbMinW : Math.max(dbMinW, Math.min(dbMaxW, light.w));

    if (eHeavyW === eLightW) {
        out.innerHTML = '<span style="color:#ff3366">> ERROR: Effective economy weights are identical (both clamped to ceiling, or both Tiny).</span>';
        return;
    }

    const rate = (heavy.nP - light.nP) / (eHeavyW - eLightW);
    const pZero = heavy.nP - (rate * eHeavyW);
    
    const trueFloor = Math.round(pZero + (rate * dbMinW));
    const trueCeil = Math.round(pZero + (rate * dbMaxW));

    const fDiff = trueFloor - dbFloor;
    const cDiff = trueCeil - dbCeil;
    const statusColor = (fDiff === 0 && cDiff === 0) ? "#00ffaa" : "#ff595e";

    out.innerHTML = `
        <div class="output-block">
            <span class="math-step">// 1. Economy Scaling</span><br>
            > RATE: <span class="rate-highlight">${rate.toFixed(3)} coins per 1.0kg</span>
        </div>
        <div class="output-block" style="border:none; margin-top: 15px;">
            <span class="math-step">// 2. Comparative Validation</span><br>
            <div class="diff-container">
                <div class="diff-col left">
                    <span class="diff-label">JSON DATA</span><br>
                    Floor: <span style="color:#fff">${dbFloor}</span><br>Ceil: <span style="color:#fff">${dbCeil}</span>
                </div>
                <div class="diff-col">
                    <span class="diff-label" style="color:#ffaa00">ENGINE TRUTH</span><br>
                    <span style="color:${statusColor}">Floor: ${trueFloor} (${fDiff >= 0 ? '+' : ''}${fDiff})</span><br>
                    <span style="color:${statusColor}">Ceil: ${trueCeil} (${cDiff >= 0 ? '+' : ''}${cDiff})</span>
                </div>
            </div>
        </div>
    `;
}

// BINDINGS
document.getElementById('fishSelector').addEventListener('change', (e) => {
    activeKey = e.target.value;
    const sBox = document.getElementById('activeFishStats');
    if (activeKey) {
        sBox.style.display = 'block';
    } else { 
        sBox.style.display = 'none'; 
    }
    runMathEngine();
});

['wA','pA','mutA','sizeA','wB','pB','mutB','sizeB','rodBC'].forEach(id => {
    const el = document.getElementById(id);
    if(el) {
        el.addEventListener('input', runMathEngine);
        el.addEventListener('change', runMathEngine);
    }
});

window.onload = bootTerminal;