// =========================================================
// 0. LANGUAGE TRANSLATION ENGINE (TOOLS SPECIFIC)
// =========================================================
let langData = { js: {} }; 
let currentLang = localStorage.getItem('fishAppLang') || window.SERVER_DEFAULT_LANG || 'en';

async function loadLanguage(langCode) {
    try {
        // Fetch from /lang/en.json (Fallback to tools_en.json if you split them)
        const res = await fetch(`/lang/${langCode}.json`);
        if (!res.ok) throw new Error('Language payload failed');
        langData = await res.json();
        
        applyTranslations();
        
        localStorage.setItem('fishAppLang', langCode);
        const langSwitch = document.getElementById('langSwitch');
        if (langSwitch) langSwitch.value = langCode;

        if (masterFishArray.length > 0) {
            populateSelectors(true); 
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
}

// =========================================================
// 1. VIEW ROUTER (SPA ARCHITECTURE)
// =========================================================
function setupViewRouter() {
    const toggleBtn = document.getElementById('toggleSidebar');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });
    }

    document.querySelectorAll('.nav-btn[data-target]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update Active Tab UI
            document.querySelectorAll('.nav-btn[data-target]').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');

            // Switch View Container
            const targetId = e.currentTarget.getAttribute('data-target');
            document.querySelectorAll('.tool-view').forEach(view => {
                view.style.display = view.id === targetId ? 'block' : 'none';
                if(view.id === targetId) {
                    view.style.animation = 'none';
                    view.offsetHeight; /* trigger reflow */
                    view.style.animation = null;
                }
            });
        });
    });
}

// =========================================================
// 2. STATE & DATA ARCHITECTURE
// =========================================================
let masterFishArray = []; 
let fishDatabase = {};    
let modifierData = { mutations: [], sizes: [] };

// Active states
let activeValidatorKey = null;
let activeEditorKey = null;

async function bootTerminal() {
    try {
        setupViewRouter();

        const [fishRes, modRes] = await Promise.all([
            fetch('/data/fish_data.json'),
            fetch('/data/modifiers_data.json')
        ]);
        
        if (!fishRes.ok || !modRes.ok) throw new Error('Data payload error');
        
        masterFishArray = await fishRes.json();
        modifierData = await modRes.json();
        
        syncDatabaseMap();
        populateSelectors(false);
    } catch (err) {
        console.error("Boot Error:", err);
        const errText = langData.js?.error_404 || "> ERROR: Payload 404.";
        document.getElementById('dmOutput').innerHTML = `<span style="color:var(--warning)">${errText}</span>`;
    }
}

function syncDatabaseMap() {
    fishDatabase = {};
    masterFishArray.forEach((fish, index) => {
        fishDatabase[index.toString()] = fish;
    });
}

// =========================================================
// 3. UI POPULATION
// =========================================================
function populateSelectors(isLangUpdate) {
    const vSel = document.getElementById('fishSelector');
    const eSel = document.getElementById('editorFishSelect');
    
    const savedV = vSel ? vSel.value : null;
    const savedE = eSel ? eSel.value : null;
    
    const defaultText = langData.js?.select_target || "-- Select Target --";
    if (vSel) vSel.innerHTML = `<option value="">${defaultText}</option>`;
    if (eSel) eSel.innerHTML = `<option value="">${defaultText}</option>`;
    
    const sortedKeys = Object.keys(fishDatabase).sort((a,b) => {
        const nameA = langData?.database?.fish?.[fishDatabase[a].id] || fishDatabase[a].name;
        const nameB = langData?.database?.fish?.[fishDatabase[b].id] || fishDatabase[b].name;
        return nameA.localeCompare(nameB);
    });

    sortedKeys.forEach(k => {
        const f = fishDatabase[k];
        const dName = langData?.database?.fish?.[f.id] || f.name;
        
        if (vSel) {
            let optV = document.createElement('option');
            optV.value = k; optV.textContent = dName;
            vSel.appendChild(optV);
        }

        if (eSel) {
            let optE = document.createElement('option');
            optE.value = k; optE.textContent = dName;
            eSel.appendChild(optE);
        }
    });

    if (savedV && vSel) vSel.value = savedV;
    if (savedE && eSel) eSel.value = savedE;

    if (!isLangUpdate) {
        ['A', 'B'].forEach(t => {
            const mSel = document.getElementById(`mut${t}`);
            const sSel = document.getElementById(`size${t}`);
            if (!mSel || !sSel) return;

            const savedMut = mSel.value; const savedSize = sSel.value;

            mSel.innerHTML = ''; sSel.innerHTML = '';
            
            modifierData.mutations.forEach(m => {
                let opt = document.createElement('option');
                opt.value = m.value; 
                const tName = langData?.database?.modifiers?.[m.id] || m.label.split(' ')[0];
                opt.textContent = `${tName} (${m.value.toFixed(1)}x)`;
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
}

// =========================================================
// 4. EDITOR ENGINE LOGIC
// =========================================================
function loadEditorForm() {
    activeEditorKey = document.getElementById('editorFishSelect').value;
    const form = document.getElementById('editorForm');

    if (!activeEditorKey) {
        form.style.opacity = 0.5;
        form.style.pointerEvents = 'none';
        return;
    }

    const fish = fishDatabase[activeEditorKey];
    
    document.getElementById('edId').value = fish.id;
    document.getElementById('edName').value = fish.name;
    document.getElementById('edRarity').value = fish.rarity;
    document.getElementById('edMinW').value = fish.baseMinW;
    document.getElementById('edMaxW').value = fish.baseMaxW;
    document.getElementById('edFloor').value = fish.baseFloor;
    document.getElementById('edCeil').value = fish.baseCeil;
    document.getElementById('edXp').value = fish.baseXP || 0;
    document.getElementById('edPerfXp').value = fish.perfectXP || 0;

    form.style.opacity = 1;
    form.style.pointerEvents = 'auto';
}

function createNewEntry() {
    const newFish = {
        "id": "new_fish_" + Date.now(),
        "name": "New Unnamed Fish",
        "baseMinW": "1", "baseMaxW": "5",
        "baseFloor": 10, "baseCeil": 20,
        "rarity": "Common",
        "baseXP": 15, "perfectXP": 23
    };
    
    masterFishArray.push(newFish);
    syncDatabaseMap();
    
    const newKey = (masterFishArray.length - 1).toString();
    
    populateSelectors(false);
    document.getElementById('editorFishSelect').value = newKey;
    loadEditorForm();
}

function saveToSessionMemory() {
    if (!activeEditorKey) return;
    
    const updatedFish = {
        "id": document.getElementById('edId').value,
        "name": document.getElementById('edName').value,
        "baseMinW": document.getElementById('edMinW').value,
        "baseMaxW": document.getElementById('edMaxW').value,
        "baseFloor": parseInt(document.getElementById('edFloor').value) || 0,
        "baseCeil": parseInt(document.getElementById('edCeil').value) || 0,
        "rarity": document.getElementById('edRarity').value,
        "baseXP": parseInt(document.getElementById('edXp').value) || 0,
        "perfectXP": parseInt(document.getElementById('edPerfXp').value) || 0
    };

    masterFishArray[parseInt(activeEditorKey)] = updatedFish;
    syncDatabaseMap();
    populateSelectors(true); 
    document.getElementById('editorFishSelect').value = activeEditorKey; 
    
    const statusMsg = document.getElementById('saveStatus');
    statusMsg.style.opacity = 1;
    setTimeout(() => { statusMsg.style.opacity = 0; }, 2000);
}

function triggerJsonDownload() {
    const dataStr = JSON.stringify(masterFishArray, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = "fish_data.json";
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// =========================================================
// 5. VALIDATOR MATH ENGINE
// =========================================================
function runMathEngine() {
    const out = document.getElementById('dmOutput');
    const sBox = document.getElementById('activeFishStats');
    if (!activeValidatorKey || !fishDatabase[activeValidatorKey]) return;

    const db = fishDatabase[activeValidatorKey];
    
    const dbMinW = parseFloat(db.baseMinW) || 0;
    const dbMaxW = parseFloat(db.baseMaxW) || 0;
    const dbFloor = parseFloat(db.baseFloor) || 0;
    const dbCeil = parseFloat(db.baseCeil) || 0;
    const rodBC = parseFloat(document.getElementById('rodBC').value) || 0;
    
    sBox.innerHTML = `> <span style="color:var(--accent); font-weight:bold;">${langData.js?.target_locked || "Target Locked:"}</span> ${langData.js?.db_range || "DB Range"} ${dbMinW}kg to ${dbMaxW}kg`;

    const getCatch = (t) => {
        const sEl = document.getElementById(`size${t}`);
        const sOpt = sEl.selectedOptions[0];
        return {
            w: parseFloat(document.getElementById(`w${t}`).value),
            p: parseFloat(document.getElementById(`p${t}`).value),
            mMult: parseFloat(document.getElementById(`mut${t}`).value),
            sMult: parseFloat(document.getElementById(`size${t}`).value),
            isHuge: sOpt && sOpt.dataset.id === 'size_huge',
            isTiny: sOpt && sOpt.dataset.id === 'size_tiny'
        };
    };

    const cA = getCatch('A'); const cB = getCatch('B');
    if (isNaN(cA.w) || isNaN(cA.p) || isNaN(cB.w) || isNaN(cB.p)) return;
    if (cA.w === cB.w) {
        out.innerHTML = `<span style="color:var(--warning)">${langData.js?.error_variance || "Variance Error"}</span>`;
        return;
    }

    cA.nP = cA.p / (cA.mMult * cA.sMult);
    cB.nP = cB.p / (cB.mMult * cB.sMult);

    const isAGreater = cA.w > cB.w;
    const heavy = isAGreater ? cA : cB;
    const light = isAGreater ? cB : cA;

    const eHeavyW = heavy.isTiny ? dbMinW : Math.max(dbMinW, Math.min(dbMaxW, heavy.w));
    const eLightW = light.isTiny ? dbMinW : Math.max(dbMinW, Math.min(dbMaxW, light.w));
    
    let rate = 0; let pZero = 0;
    
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
        const fDiff = expectedFloor - dbFloor; const cDiff = expectedCeil - dbCeil;
        
        dbValidationHtml = `
            <div class="output-block" style="border-bottom: 1px dashed var(--border); padding-bottom: 15px; margin-bottom: 15px;">
                <span class="math-step">${langData.js?.step2_db || "Step 2: Compare to DB"}</span><br>
                <div class="diff-container">
                    <div class="diff-col left">
                        <span class="diff-label">JSON Data</span><br>
                        Floor: <span style="color:#fff">${dbFloor}</span><br>Ceil: <span style="color:#fff">${dbCeil}</span>
                    </div>
                    <div class="diff-col">
                        <span class="diff-label" style="color:var(--warning)">Engine Expected</span><br>
                        <span style="color:${fDiff === 0 ? 'var(--success)' : '#ff595e'}">Floor: ${expectedFloor} (${fDiff >= 0 ? '+' : ''}${fDiff})</span><br>
                        <span style="color:${cDiff === 0 ? 'var(--success)' : '#ff595e'}">Ceil: ${expectedCeil} (${cDiff >= 0 ? '+' : ''}${cDiff})</span>
                    </div>
                </div>
            </div>`;
    }

    let triangulationHtml = "";
    if (heavy.isTiny || heavy.isHuge || light.isTiny || light.isHuge) {
        triangulationHtml = `
            <div class="output-block" style="border-left: 3px solid #ff595e; padding-left: 15px;">
                <span class="math-step">Hardware Extrapolation Disabled</span><br>
                <span style="color:#ff595e">Cannot solve true boundaries using mutated inputs.</span>
            </div>`;
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

            let hardwareStatus = rodBC > 0 ? `Floor Shifted ${(minPct*100).toFixed(1)}%` : rodBC < 0 ? `Ceil Penalized ${(maxPct*100).toFixed(1)}%` : "True 0% to 100%";

            triangulationHtml = `
                <div class="output-block" style="border-left: 3px solid var(--success); padding-left: 15px;">
                    <span class="math-step">Step 3: Hardware Extrapolation</span><br>
                    <span class="math-step" style="color:var(--accent)">Shift Check: ${hardwareStatus}</span><br>
                    <div style="margin-top:8px;">True Min: <span class="math-highlight">${trueMinW.toFixed(2)}kg</span> &nbsp; | &nbsp; True Floor: <span class="rate-highlight">${trueFloor}</span></div>
                    <div>True Max: <span class="math-highlight">${trueMaxW.toFixed(2)}kg</span> &nbsp; | &nbsp; True Ceil: <span class="rate-highlight">${trueCeil}</span></div>
                </div>`;
        }
    }

    out.innerHTML = `
        <div class="output-block" style="border-bottom: 1px dashed var(--border); padding-bottom: 15px; margin-bottom: 15px;">
            <span class="math-step">${langData.js?.step1_scaling || "Step 1: Calculate Base Rate"}</span><br>
            Rate: <span class="rate-highlight">${rate.toFixed(3)} Coins/kg</span>
        </div>
        ${dbValidationHtml}
        ${triangulationHtml}
    `;
}

// =========================================================
// 6. EVENT BINDINGS & BOOT
// =========================================================
document.addEventListener('DOMContentLoaded', () => {

    // --- THEME SWITCHER LOGIC ---
    const themeSwitch = document.getElementById('themeSwitch');
    if (themeSwitch) {
        themeSwitch.value = localStorage.getItem('fishAppTheme') || 'auto';
        themeSwitch.addEventListener('change', (e) => {
            localStorage.setItem('fishAppTheme', e.target.value);
            window.location.reload();
        });
    }

    // --- LANGUAGE SWITCHER ---
    const langSwitch = document.getElementById('langSwitch');
    if (langSwitch) {
        langSwitch.addEventListener('change', (e) => loadLanguage(e.target.value));
    }

    // --- VALIDATOR BINDINGS ---
    const fishSelector = document.getElementById('fishSelector');
    if (fishSelector) {
        fishSelector.addEventListener('change', (e) => {
            activeValidatorKey = e.target.value;
            const sBox = document.getElementById('activeFishStats');
            if(sBox) sBox.style.display = activeValidatorKey ? 'block' : 'none';
            runMathEngine();
        });
    }

    ['wA','pA','mutA','sizeA','wB','pB','mutB','sizeB','rodBC'].forEach(id => {
        const el = document.getElementById(id);
        if(el) { 
            el.addEventListener('input', runMathEngine); 
            el.addEventListener('change', runMathEngine); 
        }
    });

    // --- EDITOR BINDINGS ---
    document.getElementById('editorFishSelect')?.addEventListener('change', loadEditorForm);
    document.getElementById('btnNewFish')?.addEventListener('click', createNewEntry);
    document.getElementById('btnSaveSession')?.addEventListener('click', saveToSessionMemory);
    document.getElementById('btnExportJSON')?.addEventListener('click', triggerJsonDownload);

    // Boot Language and DB
    loadLanguage(currentLang).then(() => {
        bootTerminal();
    });
});