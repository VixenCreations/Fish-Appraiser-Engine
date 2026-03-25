// =========================================================
// 0. LANGUAGE TRANSLATION ENGINE (TOOLS SPECIFIC)
// =========================================================
let langData = { js: {} }; // Default empty object to prevent boot crashes
let currentLang = localStorage.getItem('fishAppLang') || window.SERVER_DEFAULT_LANG || 'en';

async function loadLanguage(langCode) {
    try {
        const res = await fetch(`/lang/tools_${langCode}.json`);
        if (!res.ok) throw new Error('Language payload failed');
        langData = await res.json();
        
        applyTranslations();
        
        // Save preference to browser storage
        localStorage.setItem('fishAppLang', langCode);
        const langSwitch = document.getElementById('langSwitch');
        if (langSwitch) langSwitch.value = langCode;

        // Force a re-render of dynamic text if the database is already loaded!
        if (Object.keys(fishDatabase).length > 0) {
            populateSelectors(fishDatabase, true); 
            runMathEngine();
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

// =========================================================
// 1. REVERSE-ENGINEERING MATH ENGINE (TOOLS PAGE)
// =========================================================
let fishDatabase = {};
let modifierData = { mutations: [], sizes: [] };
let activeKey = null;

async function bootTerminal() {
    try {
        // Await the language fetch FIRST so the JS dictionary is ready
        await loadLanguage(currentLang);

        const [fishRes, modRes] = await Promise.all([
            fetch('/data/fish_data.json'),
            fetch('/data/modifiers_data.json')
        ]);
        
        if (!fishRes.ok || !modRes.ok) throw new Error('Data payload error');
        
        const fData = await fishRes.json();
        modifierData = await modRes.json();
        
        // Cache the raw data globally
        Object.keys(fData).sort((a,b) => fData[a].name.localeCompare(fData[b].name)).forEach(k => {
            fishDatabase[k] = fData[k];
        });

        populateSelectors(fishDatabase, false);
    } catch (err) {
        console.error("Boot Error:", err);
        const errText = langData.js.error_404 || "> ERROR: Payload 404.";
        document.getElementById('dmOutput').innerHTML = `<span style="color:#ff3366">${errText}</span>`;
    }
}

function populateSelectors(fData, isLangUpdate) {
    const fSel = document.getElementById('fishSelector');
    
    // Save selections so translating doesn't erase the user's current data
    const savedFish = fSel.value;
    
    fSel.innerHTML = `<option value="">${langData.js.select_target || "-- Select Target --"}</option>`;
    
    Object.keys(fData).sort((a,b) => {
        const nameA = langData?.database?.fish?.[fData[a].id] || fData[a].name;
        const nameB = langData?.database?.fish?.[fData[b].id] || fData[b].name;
        return nameA.localeCompare(nameB);
    }).forEach(k => {
        let opt = document.createElement('option');
        opt.value = k; 
        opt.textContent = langData?.database?.fish?.[fData[k].id] || fData[k].name;
        fSel.appendChild(opt);
    });

    if (savedFish) fSel.value = savedFish;

    ['A', 'B'].forEach(t => {
        const mSel = document.getElementById(`mut${t}`);
        const sSel = document.getElementById(`size${t}`);
        
        const savedMut = mSel.value;
        const savedSize = sSel.value;

        mSel.innerHTML = '';
        sSel.innerHTML = '';
        
        modifierData.mutations.forEach(m => {
            let opt = document.createElement('option');
            opt.value = m.value; 
            
            // Decouples the String Name from the Number Multiplier
            const translatedName = langData?.database?.modifiers?.[m.id] || m.label.split(' ')[0];
            opt.textContent = `${translatedName} (${m.value.toFixed(1)}x)`;
            
            mSel.appendChild(opt);
        });

        modifierData.sizes.forEach(s => {
            let opt = document.createElement('option');
            opt.value = s.multiplier; 
            opt.textContent = langData?.database?.modifiers?.[s.id] || s.label;
            opt.dataset.id = s.id; 
            sSel.appendChild(opt);
        });

        if (savedMut) mSel.value = savedMut;
        if (savedSize) sSel.value = savedSize;
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
    
    sBox.innerHTML = `> <span style="color:#00e6ff; font-weight:bold;">${langData.js.target_locked}</span> ${langData.js.db_range} ${dbMinW}kg to ${dbMaxW}kg`;

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
        out.innerHTML = `<span style="color:#ff3366">${langData.js.error_variance}</span>`;
        return;
    }

    cA.nP = cA.p / (cA.mMult * cA.sMult);
    cB.nP = cB.p / (cB.mMult * cB.sMult);

    const isAGreater = cA.w > cB.w;
    const heavy = isAGreater ? cA : cB;
    const light = isAGreater ? cB : cA;

    const eHeavyW = heavy.isTiny ? dbMinW : Math.max(dbMinW, Math.min(dbMaxW, heavy.w));
    const eLightW = light.isTiny ? dbMinW : Math.max(dbMinW, Math.min(dbMaxW, light.w));
    
    let rate = 0;
    let pZero = 0;
    
    if (eHeavyW === eLightW || (dbMinW === 0 && dbMaxW === 0)) {
        rate = (heavy.nP - light.nP) / (heavy.w - light.w);
    } else {
        rate = (heavy.nP - light.nP) / (eHeavyW - eLightW);
    }
    
    pZero = heavy.nP - (rate * (eHeavyW === eLightW || (dbMinW === 0) ? heavy.w : eHeavyW));

    let dbValidationHtml = "";
    if (dbFloor !== 0 || dbCeil !== 0) {
        const expectedFloor = Math.round(pZero + (rate * dbMinW));
        const expectedCeil = Math.round(pZero + (rate * dbMaxW));
        const fDiff = expectedFloor - dbFloor;
        const cDiff = expectedCeil - dbCeil;
        
        dbValidationHtml = `
            <div class="output-block" style="border-bottom: 1px dashed #1e2633; padding-bottom: 15px; margin-bottom: 15px;">
                <span class="math-step">${langData.js.step2_db}</span><br>
                <div class="diff-container">
                    <div class="diff-col left">
                        <span class="diff-label">${langData.js.json_db_data}</span><br>
                        ${langData.js.floor} <span style="color:#fff">${dbFloor}</span><br>${langData.js.ceil} <span style="color:#fff">${dbCeil}</span>
                    </div>
                    <div class="diff-col">
                        <span class="diff-label" style="color:#ffaa00">${langData.js.engine_expected}</span><br>
                        <span style="color:${fDiff === 0 ? '#00ffaa' : '#ff595e'}">${langData.js.floor} ${expectedFloor} (${fDiff >= 0 ? '+' : ''}${fDiff})</span><br>
                        <span style="color:${cDiff === 0 ? '#00ffaa' : '#ff595e'}">${langData.js.ceil} ${expectedCeil} (${cDiff >= 0 ? '+' : ''}${cDiff})</span>
                    </div>
                </div>
            </div>
        `;
    }

    let triangulationHtml = "";
    if (heavy.isTiny || heavy.isHuge || light.isTiny || light.isHuge) {
        triangulationHtml = `
            <div class="output-block" style="border-left: 3px solid #ff3366; padding-left: 15px;">
                <span class="math-step">${langData.js.step3_error}</span><br>
                <span style="color:#ff3366">${langData.js.error_mutation}</span>
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

            let hardwareStatus = rodBC > 0 ? `${langData.js.status_floor_shifted} ${(minPct*100).toFixed(1)}%` : rodBC < 0 ? `${langData.js.status_ceil_penalized} ${(maxPct*100).toFixed(1)}%` : langData.js.status_true_range;

            triangulationHtml = `
                <div class="output-block" style="border-left: 3px solid #00ffaa; padding-left: 15px;">
                    <span class="math-step">${langData.js.step3_success}</span><br>
                    <span class="math-step" style="color:#00e6ff">${langData.js.hw_shift_check} ${hardwareStatus}</span><br>
                    <div style="margin-top:8px;">${langData.js.true_min_w} <span class="math-highlight">${trueMinW.toFixed(2)}kg</span> &nbsp; | &nbsp; ${langData.js.base_floor} <span class="rate-highlight">${trueFloor}</span></div>
                    <div>${langData.js.true_max_w} <span class="math-highlight">${trueMaxW.toFixed(2)}kg</span> &nbsp; | &nbsp; ${langData.js.base_ceil} <span class="rate-highlight">${trueCeil}</span></div>
                </div>
            `;
        }
    }

    out.innerHTML = `
        <div class="output-block" style="border-bottom: 1px dashed #1e2633; padding-bottom: 15px; margin-bottom: 15px;">
            <span class="math-step">${langData.js.step1_scaling}</span><br>
            ${langData.js.rate} <span class="rate-highlight">${rate.toFixed(3)} ${langData.js.coins_per_kg}</span>
        </div>
        ${dbValidationHtml}
        ${triangulationHtml}
    `;
}

// --- BINDINGS ---
document.getElementById('langSwitch').addEventListener('change', (e) => {
    loadLanguage(e.target.value);
});

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

// Boot
window.onload = bootTerminal;