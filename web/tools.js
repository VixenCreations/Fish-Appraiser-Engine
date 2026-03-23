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
            opt.dataset.id = s.id; // Critical for identifying 'huge'/'tiny'
            sSel.appendChild(opt);
        });
    });
}

// --- 2. THE REVERSE-ALGEBRA ENGINE ---
function runMathEngine() {
    const out = document.getElementById('dmOutput');
    if (!activeKey || !fishDatabase[activeKey]) return;

    const db = fishDatabase[activeKey];
    
    // THE FIX: Explicitly parse the JSON strings into Numbers!
    const dbMinW = parseFloat(db.baseMinW);
    const dbMaxW = parseFloat(db.baseMaxW);
    const rodBC = parseFloat(document.getElementById('rodBC').value) || 0;
    
    // EXTRACTOR
    const getCatch = (t) => {
        const sEl = document.getElementById(`size${t}`);
        const sOpt = sEl.selectedOptions[0];
        const tinyCb = document.getElementById(`tiny${t}`); 
        
        return {
            w: parseFloat(document.getElementById(`w${t}`).value),
            p: parseFloat(document.getElementById(`p${t}`).value),
            mMult: parseFloat(document.getElementById(`mut${t}`).value),
            sMult: parseFloat(document.getElementById(`size${t}`).value),
            isHuge: sOpt && sOpt.dataset.id === 'huge',
            isTiny: (tinyCb && tinyCb.checked) || (sOpt && sOpt.dataset.id === 'tiny')
        };
    };

    const cA = getCatch('A');
    const cB = getCatch('B');

    if (isNaN(cA.w) || isNaN(cA.p) || isNaN(cB.w) || isNaN(cB.p)) return;

    // 1. STRIP COIN MULTIPLIERS
    const nPA = cA.p / (cA.mMult * cA.sMult);
    const nPB = cB.p / (cB.mMult * cB.sMult);

    // 2. ECONOMY WEIGHT CLAMPING
    // The economy clamps at baseMaxW. Anything heavier is flatlined at the ceiling!
    const eWA = cA.isTiny ? dbMinW : Math.max(dbMinW, Math.min(dbMaxW, cA.w));
    const eWB = cB.isTiny ? dbMinW : Math.max(dbMinW, Math.min(dbMaxW, cB.w));

    if (eWA === eWB) {
        out.innerHTML = '<span style="color:#ff3366">> ERROR: Effective economy weights are identical (e.g., both are clamped to the ceiling, or both are Tiny). A variance is mathematically required.</span>';
        return;
    }

    // 3. THE ALGEBRA
    const rate = (nPB - nPA) / (eWB - eWA);
    const pZero = nPA - (rate * eWA);
    
    const trueFloor = Math.round(pZero + (rate * dbMinW));
    const trueCeil = Math.round(pZero + (rate * dbMaxW));

    // 4. FIND HIDDEN RNG ROLL (Using uncoupled physics weight)
    const bcShift = rodBC / 300;
    const getRoll = (c) => {
        if (c.isTiny) return "N/A (Tiny)";
        let physW = c.isHuge ? (c.w / 4) : c.w;
        if (dbMaxW === dbMinW) return "0.000";
        let pct = (physW - dbMinW) / (dbMaxW - dbMinW);
        pct = Math.max(0, Math.min(1, pct));
        let roll = (Math.asin(pct) / (Math.PI / 2)) - bcShift;
        return roll.toFixed(3);
    };

    // 5. DIFF COMPARISON
    const fDiff = trueFloor - db.baseFloor;
    const cDiff = trueCeil - db.baseCeil;
    const statusColor = (fDiff === 0 && cDiff === 0) ? "#00ffaa" : "#ff595e";

    out.innerHTML = `
        <div class="output-block">
            <span class="math-step">// 1. Economy Normalization (Multipliers Stripped, Weights Clamped)</span><br>
            A: <span class="math-highlight">${cA.w.toFixed(2)}kg</span> &rarr; Effective <span class="math-highlight">${eWA.toFixed(2)}kg</span> / <span class="math-highlight">${nPA.toFixed(1)} coins</span> (RNG: ${getRoll(cA)})<br>
            B: <span class="math-highlight">${cB.w.toFixed(2)}kg</span> &rarr; Effective <span class="math-highlight">${eWB.toFixed(2)}kg</span> / <span class="math-highlight">${nPB.toFixed(1)} coins</span> (RNG: ${getRoll(cB)})
        </div>
        <div class="output-block">
            <span class="math-step">// 2. Economy Scaling</span><br>
            > RATE: <span class="rate-highlight">${rate.toFixed(3)} coins per 1.0kg</span><br>
            > ZERO PRICE (0.0kg): <span class="rate-highlight">${Math.round(pZero)} coins</span>
        </div>
        <div class="output-block" style="border:none">
            <span class="math-step">// 3. Comparative Validation</span><br>
            <div class="diff-container">
                <div class="diff-col left">
                    <span class="diff-label">JSON DATA</span><br>
                    Floor: <span style="color:#fff">${db.baseFloor}</span><br>Ceil: <span style="color:#fff">${db.baseCeil}</span>
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
        document.getElementById('lblMinW').textContent = fishDatabase[activeKey].baseMinW;
        document.getElementById('lblMaxW').textContent = fishDatabase[activeKey].baseMaxW;
        sBox.style.display = 'block';
    } else { sBox.style.display = 'none'; }
    runMathEngine();
});

['wA','pA','mutA','sizeA','wB','pB','mutB','sizeB','rodBC'].forEach(id => {
    const el = document.getElementById(id);
    if(el) {
        el.addEventListener('input', runMathEngine);
        el.addEventListener('change', runMathEngine);
    }
});

// Fallback bindings for the old checkboxes if they still exist in your HTML
['tinyA', 'tinyB'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('change', runMathEngine);
});

window.onload = bootTerminal;