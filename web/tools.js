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
    
    sBox.innerHTML = `> <span style="color:#00e6ff; font-weight:bold;">[TARGET LOCKED]</span> DB Range: ${dbMinW}kg to ${dbMaxW}kg`;

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
        out.innerHTML = '<span style="color:#ff3366">> ERROR: A weight variance is mathematically required to triangulate scaling.</span>';
        return;
    }

    // STRIP COIN MULTIPLIERS & AUTO-SORT
    cA.nP = cA.p / (cA.mMult * cA.sMult);
    cB.nP = cB.p / (cB.mMult * cB.sMult);

    const isAGreater = cA.w > cB.w;
    const heavy = isAGreater ? cA : cB;
    const light = isAGreater ? cB : cA;

    // --- STEP 1: ECONOMY SCALING (Always mathematically true) ---
    const eHeavyW = heavy.isTiny ? dbMinW : Math.max(dbMinW, Math.min(dbMaxW, heavy.w));
    const eLightW = light.isTiny ? dbMinW : Math.max(dbMinW, Math.min(dbMaxW, light.w));
    
    let rate = 0;
    let pZero = 0;
    
    // Fallback to strict weight math if DB clamping causes identical weights (or if DB is blank)
    if (eHeavyW === eLightW || (dbMinW === 0 && dbMaxW === 0)) {
        rate = (heavy.nP - light.nP) / (heavy.w - light.w);
    } else {
        rate = (heavy.nP - light.nP) / (eHeavyW - eLightW);
    }
    
    pZero = heavy.nP - (rate * (eHeavyW === eLightW || (dbMinW === 0) ? heavy.w : eHeavyW));

    // --- STEP 2: DB VALIDATION (Checking current JSON prices) ---
    let dbValidationHtml = "";
    if (dbFloor !== 0 || dbCeil !== 0) {
        const expectedFloor = Math.round(pZero + (rate * dbMinW));
        const expectedCeil = Math.round(pZero + (rate * dbMaxW));
        const fDiff = expectedFloor - dbFloor;
        const cDiff = expectedCeil - dbCeil;
        
        dbValidationHtml = `
            <div class="output-block" style="border-bottom: 1px dashed #1e2633; padding-bottom: 15px; margin-bottom: 15px;">
                <span class="math-step">// 2. Database Economy Validation</span><br>
                <div class="diff-container">
                    <div class="diff-col left">
                        <span class="diff-label">JSON DB DATA</span><br>
                        Floor: <span style="color:#fff">${dbFloor}</span><br>Ceil: <span style="color:#fff">${dbCeil}</span>
                    </div>
                    <div class="diff-col">
                        <span class="diff-label" style="color:#ffaa00">ENGINE EXPECTED (Based on DB Weights)</span><br>
                        <span style="color:${fDiff === 0 ? '#00ffaa' : '#ff595e'}">Floor: ${expectedFloor} (${fDiff >= 0 ? '+' : ''}${fDiff})</span><br>
                        <span style="color:${cDiff === 0 ? '#00ffaa' : '#ff595e'}">Ceil: ${expectedCeil} (${cDiff >= 0 ? '+' : ''}${cDiff})</span>
                    </div>
                </div>
            </div>
        `;
    }

    // --- STEP 3: SOURCE TRIANGULATION (Finding exact Weights & Prices for JSON updates) ---
    let triangulationHtml = "";
    if (heavy.isTiny || heavy.isHuge || light.isTiny || light.isHuge) {
        triangulationHtml = `
            <div class="output-block" style="border-left: 3px solid #ff3366; padding-left: 15px;">
                <span class="math-step">// 3. Source Triangulation</span><br>
                <span style="color:#ff3366">> ERROR: Cannot reverse-engineer source integer Weights using Mutated catches (Tiny/Huge). Both must be standard.</span>
            </div>
        `;
    } else {
        const bcShift = rodBC / 300;
        const minEff = Math.max(0, Math.min(1, 0.0 + bcShift));
        const maxEff = Math.max(0, Math.min(1, 1.0 + bcShift));
        const minPct = Math.sin(minEff * (Math.PI / 2));
        const maxPct = Math.sin(maxEff * (Math.PI / 2));

        if (maxPct !== minPct) {
            const weightRange = (heavy.w - light.w) / (maxPct - minPct);
            const trueMinW = light.w - (weightRange * minPct);
            const trueMaxW = trueMinW + weightRange;

            const trueFloor = Math.round(pZero + (rate * trueMinW));
            const trueCeil = Math.round(pZero + (rate * trueMaxW));

            let hardwareStatus = rodBC > 0 ? `Floor Shifted to ${(minPct*100).toFixed(1)}%` : rodBC < 0 ? `Ceiling Penalized to ${(maxPct*100).toFixed(1)}%` : "True 0% to 100% Range";

            triangulationHtml = `
                <div class="output-block" style="border-left: 3px solid #00ffaa; padding-left: 15px;">
                    <span class="math-step">// 3. Source Triangulation (Assuming your inputs are the limits)</span><br>
                    <span class="math-step" style="color:#00e6ff">> Hardware Shift Check: ${hardwareStatus}</span><br>
                    <div style="margin-top:8px;">> TRUE MIN W: <span class="math-highlight">${trueMinW.toFixed(2)}kg</span> &nbsp; | &nbsp; BASE FLOOR: <span class="rate-highlight">${trueFloor}</span></div>
                    <div>> TRUE MAX W: <span class="math-highlight">${trueMaxW.toFixed(2)}kg</span> &nbsp; | &nbsp; BASE CEIL: <span class="rate-highlight">${trueCeil}</span></div>
                </div>
            `;
        }
    }

    // --- COMPILE FINAL OUTPUT ---
    out.innerHTML = `
        <div class="output-block" style="border-bottom: 1px dashed #1e2633; padding-bottom: 15px; margin-bottom: 15px;">
            <span class="math-step">// 1. Economy Scaling</span><br>
            > RATE: <span class="rate-highlight">${rate.toFixed(3)} coins per 1.0kg</span>
        </div>
        ${dbValidationHtml}
        ${triangulationHtml}
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