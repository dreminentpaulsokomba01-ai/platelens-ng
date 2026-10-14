"use strict";

/* =========================================================
   PlateLens NG - script.js
   ---------------------------------------------------------
   EDITABLE DATA (top of file)
     1. APP              - app settings
     2. BREAKPOINTS      - zone-diameter breakpoints  <-- YOU FILL THIS
     3. ORGANISMS        - organism pick list
     4. SAMPLE_TYPES     - sample type pick list
     5. DEFAULT_PANEL    - default antibiotic panel (names only)
     6. STATES / LGAS    - states and local government areas
     7. MAP_THRESHOLDS   - colour cut-offs for % susceptible
     8. LANGUAGES / I18N - all screen text (English, Pidgin)
   Then the app code. This same file also runs as the
   service worker (offline support) - see the bottom.
   ========================================================= */


/* ---------------------------------------------------------
   1. APP SETTINGS
   --------------------------------------------------------- */
const APP = {
  name: "PlateLens NG",
  version: "1.0.0",            // bump this when you edit the file, so phones refresh
  dbName: "platelens-ng",
  dbVersion: 1,
  consentVersion: 1,           // bump to ask all users to accept the notice again
  zoneMin: 0,                  // smallest zone you can enter (mm)
  zoneMax: 60,                 // largest zone you can enter (mm)
  minIsolatesForAntibiogram: 30,
  resultsPerPage: 50,
  // Fixed text printed at the bottom of every result sheet:
  sheetFooter: "Interpreted by software. Must be verified by a qualified scientist."
};


/* ---------------------------------------------------------
   2. BREAKPOINTS  (zone diameter, disc diffusion)
   ---------------------------------------------------------
   *** THIS TABLE IS INTENTIONALLY EMPTY. NO BREAKPOINT VALUES
   *** HAVE BEEN INVENTED. Fill it from the EUCAST tables.

   How each row is used:
     S  (susceptible) : zone >= S_ge
     R  (resistant)   : zone <  R_lt
     I  (intermediate / increased exposure): in between
   If S_ge and R_lt are the same number there is no I category.

   Rules:
     - "organism" must match an id in ORGANISMS below.
     - "antibiotic" must match a name in the panel (any capitals).
     - Put real numbers in S_ge and R_lt, then set placeholder: false
       (or delete the placeholder property).
     - Rows with placeholder: true, or with null values, are ignored,
       and the app shows "NB" (no breakpoint) for that drug.
     - Write the EUCAST version you used in "source"; it is printed
       on every result sheet.
   --------------------------------------------------------- */
const BREAKPOINTS = {
  source: "PLACEHOLDER - write the EUCAST breakpoint table version here",
  rows: [
    // PLACEHOLDER ROW 1 - NOT A REAL BREAKPOINT. Replace with real values.
    { organism: "escherichia_coli", antibiotic: "Ciprofloxacin", disc: "", S_ge: null, R_lt: null, placeholder: true },

    // PLACEHOLDER ROW 2 - NOT A REAL BREAKPOINT. Replace with real values.
    { organism: "staphylococcus_aureus", antibiotic: "Gentamicin", disc: "", S_ge: null, R_lt: null, placeholder: true }

    // Add more rows below, same format, e.g.
    // { organism: "...", antibiotic: "...", disc: "", S_ge: 0, R_lt: 0, placeholder: false },
  ]
};


/* ---------------------------------------------------------
   3. ORGANISMS  (id is used inside BREAKPOINTS)
   --------------------------------------------------------- */
const ORGANISMS = [
  { id: "escherichia_coli",        name: "Escherichia coli" },
  { id: "klebsiella_pneumoniae",   name: "Klebsiella pneumoniae" },
  { id: "staphylococcus_aureus",   name: "Staphylococcus aureus" },
  { id: "pseudomonas_aeruginosa",  name: "Pseudomonas aeruginosa" },
  { id: "salmonella_spp",          name: "Salmonella spp." },
  { id: "proteus_mirabilis",       name: "Proteus mirabilis" },
  { id: "enterococcus_faecalis",   name: "Enterococcus faecalis" },
  { id: "streptococcus_pneumoniae", name: "Streptococcus pneumoniae" },
  { id: "acinetobacter_baumannii", name: "Acinetobacter baumannii" },
  { id: "shigella_spp",            name: "Shigella spp." },
  { id: "enterobacter_spp",        name: "Enterobacter spp." },
  { id: "other",                   name: "Other organism" }
];


/* ---------------------------------------------------------
   4. SAMPLE TYPES  (labels come from I18N keys "st.<id>")
   --------------------------------------------------------- */
const SAMPLE_TYPES = ["urine", "blood", "wound", "stool", "sputum"];


/* ---------------------------------------------------------
   5. DEFAULT ANTIBIOTIC PANEL  (names only, no breakpoints)
   Labs can add or remove drugs in Settings.
   --------------------------------------------------------- */
const DEFAULT_PANEL = [
  "Amoxicillin-clavulanate",
  "Ampicillin",
  "Cefuroxime",
  "Ceftriaxone",
  "Ceftazidime",
  "Cefoxitin",
  "Gentamicin",
  "Amikacin",
  "Ciprofloxacin",
  "Levofloxacin",
  "Nitrofurantoin",
  "Trimethoprim-sulfamethoxazole",
  "Meropenem",
  "Piperacillin-tazobactam",
  "Tetracycline",
  "Chloramphenicol",
  "Erythromycin",
  "Clindamycin"
];


/* ---------------------------------------------------------
   6. STATES AND LGAs
   LGAs is empty on purpose: the LGA box accepts typing.
   To get suggestions, add lists like:
     LGAS["Lagos"] = ["Ikeja", "Surulere", ...];
   --------------------------------------------------------- */
const STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
  "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
  "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"
];
const LGAS = {};


/* ---------------------------------------------------------
   7. COLOUR CUT-OFFS for % susceptible (display only)
   --------------------------------------------------------- */
const MAP_THRESHOLDS = { good: 90, caution: 70 };


/* ---------------------------------------------------------
   8. LANGUAGES AND TEXT
   To add a language: add it to LANGUAGES, then add a block in
   I18N with the same keys as "en". Missing keys fall back to
   English, so you can translate a little at a time.
     { code: "yo", label: "Yorùbá" }, { code: "ha", label: "Hausa" },
     { code: "ig", label: "Igbo" }
   Use {n}, {org}, {abx}, {min}, {max}, {src}, {list} as placeholders.
   --------------------------------------------------------- */
const LANGUAGES = [
  { code: "en",  label: "English" },
  { code: "pcm", label: "Nigerian Pidgin" }
];

const I18N = {
  en: {
    "nav.new": "New",
    "nav.history": "Results",
    "nav.abg": "Antibiogram",
    "nav.map": "Map",
    "nav.settings": "Settings",

    "chip.setup": "Set up lab",
    "banner.profile": "Set up your lab profile first. Tap here.",
    "warn.noBreakpoints": "No breakpoints loaded for this organism. Results will show NB (no breakpoint).",
    "warn.noStorage": "Saving is not available in this browser. Results will be lost when you close the app.",
    "common.select": "Select...",

    "new.title": "New sensitivity result",
    "new.sampleId": "Sample ID (anonymous)",
    "new.sampleIdHint": "Lab code only. Letters, numbers, - _ / . No names or phone numbers.",
    "new.sampleType": "Sample type",
    "new.organism": "Organism",
    "new.date": "Date",
    "new.zones": "Zone diameters (mm)",
    "new.zonesHint": "Enter the zone for each disc tested. Leave blank if not tested.",
    "new.save": "Save result",
    "new.clear": "Clear form",

    "st.urine": "Urine",
    "st.blood": "Blood",
    "st.wound": "Wound swab",
    "st.stool": "Stool",
    "st.sputum": "Sputum",

    "res.S": "Susceptible",
    "res.I": "Intermediate",
    "res.R": "Resistant",
    "res.NB": "No breakpoint",
    "res.legend": "S = susceptible, I = intermediate / increased exposure, R = resistant, NB = no breakpoint loaded",

    "err.noProfile": "Set up your lab profile in Settings before saving results.",
    "err.sampleId": "Enter a sample ID.",
    "err.sampleIdBad": "Sample ID may use only letters, numbers and - _ / . with no spaces. Do not use names or phone numbers.",
    "err.sampleType": "Choose a sample type.",
    "err.organism": "Choose an organism.",
    "err.date": "Enter the date.",
    "err.dateFuture": "The date cannot be in the future.",
    "err.noZones": "Enter at least one zone diameter.",
    "err.zoneBad": "{abx}: zone must be a whole number from {min} to {max} mm.",
    "err.labFields": "Lab name, state and LGA are required.",
    "err.saveFailed": "Could not save. Please try again.",

    "confirm.dup": "A result with the same sample ID, organism and date is already saved. Save another?",
    "confirm.delete": "Delete this result? This cannot be undone.",
    "confirm.deleteAll1": "Delete ALL saved results on this device?",
    "confirm.deleteAll2": "This cannot be undone. Delete everything now?",
    "confirm.resetPanel": "Reset the antibiotic panel to the default list?",

    "toast.saved": "Result saved",
    "toast.profileSaved": "Lab profile saved",
    "toast.deleted": "Result deleted",
    "toast.allDeleted": "All results deleted",
    "toast.exported": "CSV file downloaded",
    "toast.noData": "No results to export",
    "toast.reinterpreted": "{n} results re-interpreted",
    "toast.abxExists": "That antibiotic is already in the panel",
    "toast.panelReset": "Panel reset",

    "history.title": "Saved results",
    "history.empty": "No results saved yet.",
    "history.sheet": "Result sheet",
    "history.delete": "Delete",
    "history.more": "Show more",

    "abg.title": "Local antibiogram",
    "abg.desc": "Percent susceptible for results saved on this device.",
    "abg.organism": "Organism",
    "abg.empty": "No results saved for this organism yet.",
    "abg.summary": "{n} isolates of {org} on this device.",
    "abg.small": "Fewer than {min} isolates: interpret with caution.",
    "abg.note": "% susceptible counts S only. Results with no breakpoint are not counted.",
    "abg.colAbx": "Antibiotic",
    "abg.colN": "Tested",
    "abg.colPct": "% S",

    "map.title": "Resistance map",
    "map.desc": "Percent susceptible by state and LGA, from results saved on this device.",
    "map.organism": "Organism",
    "map.antibiotic": "Antibiotic",
    "map.empty": "No interpreted results for this choice yet.",
    "map.phase2": "A live map with data from many labs is planned for Phase 2. For now this table shows only this device.",
    "map.colState": "State",
    "map.colLga": "LGA",
    "map.colN": "Tested",
    "map.colPct": "% S",

    "settings.title": "Settings",
    "settings.lab": "Lab profile",
    "settings.labName": "Lab name",
    "settings.state": "State",
    "settings.lga": "LGA",
    "settings.mlscn": "MLSCN registration number",
    "settings.mlscnHint": "Printed on result sheets.",
    "settings.saveProfile": "Save profile",
    "settings.language": "Language",
    "settings.panel": "Antibiotic panel",
    "settings.panelHint": "These drugs appear on the zone entry form.",
    "settings.addAbx": "Add antibiotic name",
    "settings.add": "Add",
    "settings.remove": "Remove",
    "settings.resetPanel": "Reset to default panel",
    "settings.data": "Your data",
    "settings.dataNote": "Stored only on this device. Export a CSV for backup.",
    "settings.export": "Export results (CSV)",
    "settings.reinterpret": "Re-interpret all saved results",
    "settings.deleteAll": "Delete all results",
    "settings.about": "About",
    "settings.disclaimer": "For use by qualified laboratory professionals only. Not medical advice. Results are interpreted by software and must be verified by a qualified scientist.",
    "settings.phase2": "Planned for Phase 2: plate photo with automatic zone measurement, cloud sync, outbreak alerts.",

    "sheet.close": "Close",
    "sheet.print": "Print / Save PDF",
    "sheet.title": "Antibiotic Sensitivity Report",
    "sheet.mlscn": "MLSCN Reg. No.",
    "sheet.sampleId": "Sample ID",
    "sheet.sampleType": "Sample type",
    "sheet.organism": "Organism",
    "sheet.date": "Date",
    "sheet.abx": "Antibiotic",
    "sheet.zone": "Zone (mm)",
    "sheet.result": "Result",
    "sheet.bp": "Breakpoints: {src}",
    "sheet.verified": "Verified by (name and signature): ______________________   Date: ____________",
    "sheet.professional": "For use by qualified laboratory professionals only. Not medical advice.",

    "consent.lang": "Language",
    "consent.title": "Data protection and consent",
    "consent.b1": "PlateLens NG is a support tool for qualified medical laboratory professionals only. It is not for patients and does not give medical advice.",
    "consent.b2": "Do not enter patient names, phone numbers, addresses or any identifying details. Use an anonymous lab sample ID only.",
    "consent.b3": "What you enter is stored only on this device, in your browser. Nothing is sent to any server in this version. Your lab remains responsible for the records it keeps, in line with the Nigeria Data Protection Act 2023. Protect this phone with a screen lock and back up your data.",
    "consent.b4": "In future versions, anonymised results (state, LGA, organism, antibiotic result) may be shared to a resistance map only if you separately agree. You can export or delete your data at any time in Settings.",
    "consent.check": "I am a qualified laboratory professional. I understand and agree.",
    "consent.accept": "Accept and continue"
  },

  /* Nigerian Pidgin - please have a native speaker review these. */
  pcm: {
    "nav.new": "New",
    "nav.history": "Results",
    "nav.abg": "Antibiogram",
    "nav.map": "Map",
    "nav.settings": "Settings",

    "chip.setup": "Set up lab",
    "banner.profile": "Set up your lab details first. Tap here.",
    "warn.noBreakpoints": "We never load breakpoint for this organism. Result go show NB (no breakpoint).",
    "warn.noStorage": "Save no work for this browser. Results go commot when you close the app.",
    "common.select": "Select...",

    "new.title": "New sensitivity result",
    "new.sampleId": "Sample ID (no put name)",
    "new.sampleIdHint": "Lab code only. Letters, numbers, - _ / . No put person name or phone number.",
    "new.sampleType": "Type of sample",
    "new.organism": "Organism",
    "new.date": "Date",
    "new.zones": "Zone size (mm)",
    "new.zonesHint": "Put the zone for each disc wey you test. Leave am empty if you no test am.",
    "new.save": "Save result",
    "new.clear": "Clear form",

    "st.urine": "Urine",
    "st.blood": "Blood",
    "st.wound": "Wound swab",
    "st.stool": "Stool",
    "st.sputum": "Sputum",

    "res.S": "Susceptible",
    "res.I": "Intermediate",
    "res.R": "Resistant",
    "res.NB": "No breakpoint",
    "res.legend": "S = susceptible, I = intermediate / increased exposure, R = resistant, NB = no breakpoint loaded",

    "err.noProfile": "Set up your lab details for Settings before you save result.",
    "err.sampleId": "Put sample ID.",
    "err.sampleIdBad": "Sample ID fit use only letters, numbers and - _ / . no space. No use name or phone number.",
    "err.sampleType": "Choose type of sample.",
    "err.organism": "Choose organism.",
    "err.date": "Put the date.",
    "err.dateFuture": "Date no fit dey for future.",
    "err.noZones": "Put at least one zone size.",
    "err.zoneBad": "{abx}: zone must be whole number from {min} to {max} mm.",
    "err.labFields": "Lab name, state and LGA must dey.",
    "err.saveFailed": "E no save. Try again.",

    "confirm.dup": "Result wey get the same sample ID, organism and date don already dey. Save another one?",
    "confirm.delete": "Delete this result? You no fit bring am back.",
    "confirm.deleteAll1": "Delete ALL the results for this phone?",
    "confirm.deleteAll2": "You no fit bring am back. Delete everything now?",
    "confirm.resetPanel": "Reset the antibiotic panel to the default list?",

    "toast.saved": "Result don save",
    "toast.profileSaved": "Lab details don save",
    "toast.deleted": "Result don delete",
    "toast.allDeleted": "All results don delete",
    "toast.exported": "CSV file don download",
    "toast.noData": "No result to export",
    "toast.reinterpreted": "{n} results don interpret again",
    "toast.abxExists": "That antibiotic don already dey for the panel",
    "toast.panelReset": "Panel don reset",

    "history.title": "Results wey you save",
    "history.empty": "You never save any result.",
    "history.sheet": "Result sheet",
    "history.delete": "Delete",
    "history.more": "Show more",

    "abg.title": "Local antibiogram",
    "abg.desc": "Percent susceptible for the results wey dey this phone.",
    "abg.organism": "Organism",
    "abg.empty": "You never save result for this organism.",
    "abg.summary": "{n} isolates of {org} dey this phone.",
    "abg.small": "Isolates no reach {min}: use am with care.",
    "abg.note": "% susceptible dey count S only. Result wey no get breakpoint no dey count.",
    "abg.colAbx": "Antibiotic",
    "abg.colN": "Tested",
    "abg.colPct": "% S",

    "map.title": "Resistance map",
    "map.desc": "Percent susceptible by state and LGA, from results wey dey this phone.",
    "map.organism": "Organism",
    "map.antibiotic": "Antibiotic",
    "map.empty": "No interpreted result for this choice yet.",
    "map.phase2": "Live map wey get data from plenty labs dey come for Phase 2. For now, this table na only this phone.",
    "map.colState": "State",
    "map.colLga": "LGA",
    "map.colN": "Tested",
    "map.colPct": "% S",

    "settings.title": "Settings",
    "settings.lab": "Lab details",
    "settings.labName": "Lab name",
    "settings.state": "State",
    "settings.lga": "LGA",
    "settings.mlscn": "MLSCN registration number",
    "settings.mlscnHint": "E go show for result sheet.",
    "settings.saveProfile": "Save details",
    "settings.language": "Language",
    "settings.panel": "Antibiotic panel",
    "settings.panelHint": "These drugs go show for the zone form.",
    "settings.addAbx": "Add antibiotic name",
    "settings.add": "Add",
    "settings.remove": "Remove",
    "settings.resetPanel": "Reset to default panel",
    "settings.data": "Your data",
    "settings.dataNote": "E dey only for this phone. Export CSV to keep copy.",
    "settings.export": "Export results (CSV)",
    "settings.reinterpret": "Interpret all saved results again",
    "settings.deleteAll": "Delete all results",
    "settings.about": "About",
    "settings.disclaimer": "Na only qualified laboratory professionals suppose use am. E no be medical advice. Software interpret the results, so qualified scientist must check am before anybody use am.",
    "settings.phase2": "Wetin dey come for Phase 2: plate photo wey go measure zone by itself, cloud sync, outbreak alerts.",

    "sheet.close": "Close",
    "sheet.print": "Print / Save PDF",
    "sheet.title": "Antibiotic Sensitivity Report",
    "sheet.mlscn": "MLSCN Reg. No.",
    "sheet.sampleId": "Sample ID",
    "sheet.sampleType": "Type of sample",
    "sheet.organism": "Organism",
    "sheet.date": "Date",
    "sheet.abx": "Antibiotic",
    "sheet.zone": "Zone (mm)",
    "sheet.result": "Result",
    "sheet.bp": "Breakpoints: {src}",
    "sheet.verified": "Verified by (name and signature): ______________________   Date: ____________",
    "sheet.professional": "Na only qualified laboratory professionals suppose use am. E no be medical advice.",

    "consent.lang": "Language",
    "consent.title": "Data protection and consent",
    "consent.b1": "PlateLens NG na support tool for qualified medical laboratory professionals only. E no be for patients and e no dey give medical advice.",
    "consent.b2": "No put patient name, phone number, address or any detail wey fit show who the person be. Use anonymous lab sample ID only.",
    "consent.b3": "Wetin you put here dey only for this phone, inside your browser. Nothing dey go any server for this version. Your lab still dey responsible for the records wey e keep, as Nigeria Data Protection Act 2023 talk. Put screen lock for this phone and keep copy of your data.",
    "consent.b4": "For future versions, anonymised results (state, LGA, organism, antibiotic result) fit go resistance map only if you agree separately. You fit export or delete your data any time for Settings.",
    "consent.check": "I be qualified laboratory professional. I understand and I agree.",
    "consent.accept": "Accept and continue"
  }
};


/* =========================================================
   APP CODE  (runs in the page)
   SERVICE WORKER CODE (runs offline cache) is at the bottom.
   ========================================================= */
if (typeof document !== "undefined") {
(function () {

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  var state = {
    lang: "en",
    profile: null,
    panel: [],
    results: [],
    consent: null,
    historyLimit: APP.resultsPerPage,
    tab: "new",
    storageOk: true
  };

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  /* ---------- text ---------- */
  function t(key, vars) {
    var dict = I18N[state.lang] || {};
    var s = dict[key];
    if (s === undefined) s = I18N.en[key];
    if (s === undefined) s = key;
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : m; });
    }
    return s;
  }

  function applyI18n() {
    document.documentElement.lang = state.lang;
    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = t(nodes[i].getAttribute("data-i18n"));
    var ph = document.querySelectorAll("[data-i18n-placeholder]");
    for (var j = 0; j < ph.length; j++) ph[j].placeholder = t(ph[j].getAttribute("data-i18n-placeholder"));
  }

  /* ---------- storage (IndexedDB, with in-memory fallback) ---------- */
  var store = (function () {
    var db = null;
    var mem = { meta: {}, results: [], nextId: 1 };

    function open() {
      return new Promise(function (resolve) {
        if (!window.indexedDB) { resolve(false); return; }
        var req;
        try { req = indexedDB.open(APP.dbName, APP.dbVersion); } catch (e) { resolve(false); return; }
        req.onupgradeneeded = function () {
          var d = req.result;
          if (!d.objectStoreNames.contains("results")) d.createObjectStore("results", { keyPath: "id", autoIncrement: true });
          if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", { keyPath: "key" });
        };
        req.onsuccess = function () { db = req.result; resolve(true); };
        req.onerror = function () { resolve(false); };
        req.onblocked = function () { resolve(false); };
      });
    }

    function run(storeName, mode, fn) {
      return new Promise(function (resolve, reject) {
        var tx, req;
        try {
          tx = db.transaction(storeName, mode);
          req = fn(tx.objectStore(storeName));
        } catch (e) { reject(e); return; }
        tx.oncomplete = function () { resolve(req ? req.result : undefined); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error); };
      });
    }

    return {
      open: open,
      useMemory: function () { db = null; },
      getMeta: function (key) {
        if (!db) return Promise.resolve(mem.meta[key]);
        return run("meta", "readonly", function (s) { return s.get(key); }).then(function (r) { return r ? r.value : undefined; });
      },
      setMeta: function (key, value) {
        if (!db) { mem.meta[key] = value; return Promise.resolve(); }
        return run("meta", "readwrite", function (s) { return s.put({ key: key, value: value }); });
      },
      allResults: function () {
        if (!db) return Promise.resolve(mem.results.slice());
        return run("results", "readonly", function (s) { return s.getAll(); });
      },
      addResult: function (rec) {
        if (!db) { rec.id = mem.nextId++; mem.results.push(rec); return Promise.resolve(rec.id); }
        return run("results", "readwrite", function (s) { return s.add(rec); });
      },
      putMany: function (recs) {
        if (!db) { return Promise.resolve(); }
        return run("results", "readwrite", function (s) { recs.forEach(function (r) { s.put(r); }); return null; });
      },
      deleteResult: function (id) {
        if (!db) { mem.results = mem.results.filter(function (r) { return r.id !== id; }); return Promise.resolve(); }
        return run("results", "readwrite", function (s) { return s.delete(id); });
      },
      clearResults: function () {
        if (!db) { mem.results = []; return Promise.resolve(); }
        return run("results", "readwrite", function (s) { return s.clear(); });
      }
    };
  })();

  /* ---------- interpretation engine ---------- */
  function findBreakpoint(org, abx) {
    var a = String(abx).trim().toLowerCase();
    for (var i = 0; i < BREAKPOINTS.rows.length; i++) {
      var r = BREAKPOINTS.rows[i];
      if (r.organism === org && String(r.antibiotic).trim().toLowerCase() === a) return r;
    }
    return null;
  }

  function breakpointUsable(r) {
    return !!r && r.placeholder !== true &&
      Number.isFinite(r.S_ge) && Number.isFinite(r.R_lt) && r.R_lt <= r.S_ge;
  }

  function interpret(org, abx, zone) {
    var r = findBreakpoint(org, abx);
    if (!breakpointUsable(r)) return "NB";
    if (zone >= r.S_ge) return "S";
    if (zone < r.R_lt) return "R";
    return "I";
  }

  function orgHasBreakpoints(org) {
    return BREAKPOINTS.rows.some(function (r) { return r.organism === org && breakpointUsable(r); });
  }

  /* ---------- helpers ---------- */
  function orgName(id) {
    for (var i = 0; i < ORGANISMS.length; i++) if (ORGANISMS[i].id === id) return ORGANISMS[i].name;
    return id;
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function fmtDate(iso) {
    var p = String(iso).split("-");
    if (p.length !== 3) return iso;
    return p[2] + " " + MONTHS[Number(p[1]) - 1] + " " + p[0];
  }

  function pctBucket(p) {
    return p >= MAP_THRESHOLDS.good ? "S" : (p >= MAP_THRESHOLDS.caution ? "I" : "R");
  }

  var toastTimer = null;
  function toast(msg, ms) {
    var box = $("toast");
    box.textContent = msg;
    box.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.hidden = true; }, ms || 2600);
  }

  function fillSelect(sel, items, placeholder) {
    var prev = sel.value;
    sel.textContent = "";
    if (placeholder) {
      var o = document.createElement("option");
      o.value = "";
      o.textContent = placeholder;
      sel.appendChild(o);
    }
    items.forEach(function (it) {
      var op = document.createElement("option");
      op.value = it.value;
      op.textContent = it.label;
      sel.appendChild(op);
    });
    if (prev && items.some(function (i) { return i.value === prev; })) sel.value = prev;
  }

  function pickDefaultOrg(sel) {
    if (sel.value) return;
    var best = "", bestN = -1;
    ORGANISMS.forEach(function (o) {
      var n = state.results.filter(function (r) { return r.organism === o.id; }).length;
      if (n > bestN) { best = o.id; bestN = n; }
    });
    if (best) sel.value = best;
  }

  function orgItemsWithCounts() {
    return ORGANISMS.map(function (o) {
      var n = state.results.filter(function (r) { return r.organism === o.id; }).length;
      return { value: o.id, label: o.name + " (" + n + ")" };
    });
  }

  function buildTable(cls, headers, rows) {
    var table = el("table", cls);
    var thead = el("thead");
    var tr = el("tr");
    headers.forEach(function (h) { tr.appendChild(el("th", null, h)); });
    thead.appendChild(tr);
    table.appendChild(thead);
    var tb = el("tbody");
    rows.forEach(function (r) { tb.appendChild(r); });
    table.appendChild(tb);
    return table;
  }

  function pctCell(pct) {
    var td = el("td", "pct");
    if (pct === null) { td.textContent = "-"; return td; }
    var bar = el("span", "bar");
    var fill = el("span", "fill c-" + pctBucket(pct));
    fill.style.setProperty("--pct", String(pct));
    bar.appendChild(fill);
    td.appendChild(bar);
    td.appendChild(el("b", null, pct + "%"));
    return td;
  }

  function numCell(n) { return el("td", "num", String(n)); }

  /* ---------- navigation ---------- */
  function showTab(name) {
    state.tab = name;
    var views = document.querySelectorAll(".view");
    for (var i = 0; i < views.length; i++) views[i].hidden = views[i].getAttribute("data-view") !== name;
    var btns = document.querySelectorAll(".nav-btn");
    for (var j = 0; j < btns.length; j++) btns[j].classList.toggle("active", btns[j].getAttribute("data-tab") === name);
    if (name === "history") renderHistory();
    if (name === "abg") renderAbg();
    if (name === "map") renderMap();
    window.scrollTo(0, 0);
  }

  /* ---------- static selects ---------- */
  function renderStaticSelects() {
    fillSelect($("sampleType"), SAMPLE_TYPES.map(function (id) { return { value: id, label: t("st." + id) }; }), t("common.select"));
    fillSelect($("organism"), ORGANISMS.map(function (o) { return { value: o.id, label: o.name }; }), t("common.select"));
    fillSelect($("labState"), STATES.map(function (s) { return { value: s, label: s }; }), t("common.select"));
    var langs = LANGUAGES.map(function (l) { return { value: l.code, label: l.label }; });
    fillSelect($("langSelect"), langs);
    fillSelect($("consentLang"), langs);
    $("langSelect").value = state.lang;
    $("consentLang").value = state.lang;
  }

  /* ---------- banners and chip ---------- */
  function updateBanners() {
    $("profileBanner").hidden = !!state.profile;
    var org = $("organism").value;
    $("bpBanner").hidden = !org || orgHasBreakpoints(org);
    $("labChip").textContent = state.profile ? state.profile.labName : t("chip.setup");
  }

  /* ---------- new result form ---------- */
  function updateBadge(row) {
    var inp = row.querySelector("input");
    var b = row.querySelector(".badge");
    var org = $("organism").value;
    var v = inp.value.trim();
    b.className = "badge";
    b.textContent = "";
    b.removeAttribute("title");
    if (v === "") { b.classList.add("empty"); return; }
    var n = Number(v);
    if (!/^\d{1,2}$/.test(v) || n < APP.zoneMin || n > APP.zoneMax) {
      b.classList.add("bad");
      b.textContent = "!";
      return;
    }
    if (!org) { b.classList.add("empty"); return; }
    var r = interpret(org, inp.getAttribute("data-abx"), n);
    b.classList.add("b-" + r);
    b.textContent = r;
    b.title = t("res." + r);
  }

  function updateAllBadges() {
    var rows = $("zoneList").querySelectorAll(".zone-row");
    for (var i = 0; i < rows.length; i++) updateBadge(rows[i]);
    updateBanners();
  }

  function renderZones() {
    var box = $("zoneList");
    var keep = {};
    var old = box.querySelectorAll(".zone-input");
    for (var k = 0; k < old.length; k++) keep[old[k].getAttribute("data-abx")] = old[k].value;
    box.textContent = "";
    state.panel.forEach(function (abx, idx) {
      var row = el("div", "zone-row");
      var id = "zone_" + idx;
      var lab = el("label", null, abx);
      lab.htmlFor = id;
      var inp = document.createElement("input");
      inp.type = "number";
      inp.id = id;
      inp.className = "zone-input";
      inp.setAttribute("data-abx", abx);
      inp.setAttribute("inputmode", "numeric");
      inp.min = String(APP.zoneMin);
      inp.max = String(APP.zoneMax);
      inp.step = "1";
      inp.placeholder = "mm";
      if (keep[abx] !== undefined) inp.value = keep[abx];
      var badge = el("span", "badge empty");
      badge.setAttribute("aria-live", "polite");
      row.appendChild(lab);
      row.appendChild(inp);
      row.appendChild(badge);
      box.appendChild(row);
      updateBadge(row);
    });
  }

  function showFormError(msg) {
    var box = $("formError");
    box.textContent = msg;
    box.hidden = !msg;
    if (msg) box.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function looksLikePhone(s) {
    var digits = s.replace(/\D/g, "");
    return digits.length >= 10 && /^(0|234)?[789][01]\d{8}$/.test(digits);
  }

  function readAndValidate() {
    if (!state.profile) return { error: t("err.noProfile") };
    var sampleId = $("sampleId").value.trim();
    if (!sampleId) return { error: t("err.sampleId") };
    if (!/^[A-Za-z0-9][A-Za-z0-9\-_\/.]{0,29}$/.test(sampleId) || looksLikePhone(sampleId)) return { error: t("err.sampleIdBad") };
    var sampleType = $("sampleType").value;
    if (!sampleType) return { error: t("err.sampleType") };
    var organism = $("organism").value;
    if (!organism) return { error: t("err.organism") };
    var date = $("resultDate").value;
    if (!date) return { error: t("err.date") };
    if (date > todayStr()) return { error: t("err.dateFuture") };

    var zones = {};
    var interp = {};
    var count = 0;
    var inputs = $("zoneList").querySelectorAll(".zone-input");
    for (var i = 0; i < inputs.length; i++) {
      var abx = inputs[i].getAttribute("data-abx");
      var v = inputs[i].value.trim();
      if (v === "") continue;
      var n = Number(v);
      if (!/^\d{1,2}$/.test(v) || n < APP.zoneMin || n > APP.zoneMax) {
        return { error: t("err.zoneBad", { abx: abx, min: APP.zoneMin, max: APP.zoneMax }) };
      }
      zones[abx] = n;
      interp[abx] = interpret(organism, abx, n);
      count++;
    }
    if (!count) return { error: t("err.noZones") };

    return {
      record: {
        sampleId: sampleId,
        sampleType: sampleType,
        organism: organism,
        date: date,
        zones: zones,
        interp: interp,
        labName: state.profile.labName,
        labState: state.profile.state,
        labLga: state.profile.lga,
        labMlscn: state.profile.mlscn || "",
        createdAt: new Date().toISOString(),
        appVersion: APP.version
      }
    };
  }

  function resetForm() {
    $("sampleId").value = "";
    $("organism").value = "";
    var inputs = $("zoneList").querySelectorAll(".zone-input");
    for (var i = 0; i < inputs.length; i++) inputs[i].value = "";
    showFormError("");
    updateAllBadges();
  }

  function onSave(ev) {
    ev.preventDefault();
    showFormError("");
    var out = readAndValidate();
    if (out.error) { showFormError(out.error); return; }
    var rec = out.record;
    var dup = state.results.some(function (r) {
      return r.sampleId === rec.sampleId && r.organism === rec.organism && r.date === rec.date;
    });
    if (dup && !window.confirm(t("confirm.dup"))) return;

    store.addResult(rec).then(function (id) {
      rec.id = id;
      state.results.push(rec);
      toast(t("toast.saved"));
      resetForm();
      openSheet(rec);
    }).catch(function () {
      showFormError(t("err.saveFailed"));
    });
  }

  /* ---------- saved results ---------- */
  function countInterp(rec) {
    var c = { S: 0, I: 0, R: 0 };
    Object.keys(rec.interp || {}).forEach(function (k) {
      var v = rec.interp[k];
      if (c[v] !== undefined) c[v]++;
    });
    return c;
  }

  function renderHistory() {
    var list = $("historyList");
    list.textContent = "";
    var sorted = state.results.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.id || 0) - (a.id || 0);
    });
    $("historyEmpty").hidden = sorted.length > 0;
    sorted.slice(0, state.historyLimit).forEach(function (rec) {
      var card = el("div", "card");
      var top = el("div", "card-top");
      top.appendChild(el("span", "card-id", rec.sampleId));
      top.appendChild(el("span", "card-date", fmtDate(rec.date)));
      card.appendChild(top);
      card.appendChild(el("div", "card-sub", orgName(rec.organism) + " - " + t("st." + rec.sampleType)));
      var c = countInterp(rec);
      var counts = el("div", "counts");
      ["S", "I", "R"].forEach(function (k) { counts.appendChild(el("span", "count c-" + k, k + " " + c[k])); });
      card.appendChild(counts);
      var actions = el("div", "card-actions");
      var open = el("button", "btn primary small", t("history.sheet"));
      open.type = "button";
      open.addEventListener("click", function () { openSheet(rec); });
      var del = el("button", "btn danger small", t("history.delete"));
      del.type = "button";
      del.addEventListener("click", function () { deleteOne(rec); });
      actions.appendChild(open);
      actions.appendChild(del);
      card.appendChild(actions);
      list.appendChild(card);
    });
    if (sorted.length > state.historyLimit) {
      var more = el("button", "btn secondary more", t("history.more"));
      more.type = "button";
      more.addEventListener("click", function () {
        state.historyLimit += APP.resultsPerPage;
        renderHistory();
      });
      list.appendChild(more);
    }
  }

  function deleteOne(rec) {
    if (!window.confirm(t("confirm.delete"))) return;
    store.deleteResult(rec.id).then(function () {
      state.results = state.results.filter(function (r) { return r.id !== rec.id; });
      renderHistory();
      toast(t("toast.deleted"));
    });
  }

  /* ---------- local antibiogram ---------- */
  function renderAbg() {
    var sel = $("abgOrganism");
    fillSelect(sel, orgItemsWithCounts());
    pickDefaultOrg(sel);
    renderAbgTable();
  }

  function renderAbgTable() {
    var org = $("abgOrganism").value;
    var recs = state.results.filter(function (r) { return r.organism === org; });
    var wrap = $("abgTable");
    wrap.textContent = "";
    $("abgEmpty").hidden = recs.length > 0;
    $("abgSummary").textContent = recs.length ? t("abg.summary", { n: recs.length, org: orgName(org) }) : "";
    $("abgNote").hidden = !recs.length;
    if (!recs.length) return;

    var stats = {};
    recs.forEach(function (r) {
      Object.keys(r.interp || {}).forEach(function (abx) {
        var v = r.interp[abx];
        if (!stats[abx]) stats[abx] = { n: 0, s: 0 };
        if (v === "S" || v === "I" || v === "R") {
          stats[abx].n++;
          if (v === "S") stats[abx].s++;
        }
      });
    });
    var rows = Object.keys(stats).sort().map(function (abx) {
      var st = stats[abx];
      var tr = el("tr");
      tr.appendChild(el("td", null, abx));
      tr.appendChild(numCell(st.n));
      tr.appendChild(pctCell(st.n ? Math.round(100 * st.s / st.n) : null));
      return tr;
    });
    wrap.appendChild(buildTable("tbl", [t("abg.colAbx"), t("abg.colN"), t("abg.colPct")], rows));

    var note = t("abg.note");
    if (recs.length < APP.minIsolatesForAntibiogram) note = t("abg.small", { min: APP.minIsolatesForAntibiogram }) + " " + note;
    $("abgNote").textContent = note;
  }

  /* ---------- resistance map table ---------- */
  function collectAntibiotics() {
    var seen = {};
    var list = [];
    function add(a) { if (!seen[a.toLowerCase()]) { seen[a.toLowerCase()] = true; list.push(a); } }
    state.panel.forEach(add);
    state.results.forEach(function (r) { Object.keys(r.interp || {}).forEach(add); });
    return list.sort();
  }

  function renderMap() {
    var orgSel = $("mapOrganism");
    fillSelect(orgSel, orgItemsWithCounts());
    pickDefaultOrg(orgSel);
    var abxSel = $("mapAntibiotic");
    var abxs = collectAntibiotics();
    fillSelect(abxSel, abxs.map(function (a) { return { value: a, label: a }; }));
    if (!abxSel.value && abxs.length) abxSel.value = abxs[0];
    renderMapTable();
  }

  function renderMapTable() {
    var org = $("mapOrganism").value;
    var abx = $("mapAntibiotic").value;
    var wrap = $("mapTable");
    wrap.textContent = "";
    var groups = {};
    state.results.forEach(function (r) {
      if (r.organism !== org) return;
      var v = r.interp ? r.interp[abx] : undefined;
      if (v !== "S" && v !== "I" && v !== "R") return;
      var key = (r.labState || "-") + "||" + (r.labLga || "-");
      if (!groups[key]) groups[key] = { state: r.labState || "-", lga: r.labLga || "-", n: 0, s: 0 };
      groups[key].n++;
      if (v === "S") groups[key].s++;
    });
    var keys = Object.keys(groups).sort();
    $("mapEmpty").hidden = keys.length > 0;
    if (!keys.length) return;
    var rows = keys.map(function (k) {
      var g = groups[k];
      var tr = el("tr");
      tr.appendChild(el("td", null, g.state));
      tr.appendChild(el("td", null, g.lga));
      tr.appendChild(numCell(g.n));
      tr.appendChild(pctCell(Math.round(100 * g.s / g.n)));
      return tr;
    });
    wrap.appendChild(buildTable("tbl", [t("map.colState"), t("map.colLga"), t("map.colN"), t("map.colPct")], rows));
  }

  /* ---------- settings: profile ---------- */
  function updateLgaList() {
    var list = LGAS[$("labState").value] || [];
    var dl = $("lgaList");
    dl.textContent = "";
    list.forEach(function (l) {
      var o = document.createElement("option");
      o.value = l;
      dl.appendChild(o);
    });
  }

  function loadProfileForm() {
    var p = state.profile || {};
    $("labName").value = p.labName || "";
    $("labState").value = p.state || "";
    $("labLga").value = p.lga || "";
    $("labMlscn").value = p.mlscn || "";
    updateLgaList();
  }

  function onSaveProfile(ev) {
    ev.preventDefault();
    var name = $("labName").value.trim();
    var st = $("labState").value;
    var lga = $("labLga").value.trim();
    var box = $("labError");
    if (!name || !st || !lga) {
      box.textContent = t("err.labFields");
      box.hidden = false;
      return;
    }
    box.hidden = true;
    state.profile = { labName: name, state: st, lga: lga, mlscn: $("labMlscn").value.trim() };
    store.setMeta("profile", state.profile).then(function () {
      toast(t("toast.profileSaved"));
      updateBanners();
    });
  }

  /* ---------- settings: panel ---------- */
  function renderPanelList() {
    var ul = $("panelList");
    ul.textContent = "";
    state.panel.forEach(function (abx, i) {
      var li = el("li");
      li.appendChild(el("span", null, abx));
      var b = el("button", null, "×");
      b.type = "button";
      b.setAttribute("aria-label", t("settings.remove") + " " + abx);
      b.addEventListener("click", function () {
        state.panel.splice(i, 1);
        savePanel();
      });
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  function savePanel() {
    store.setMeta("panel", state.panel);
    renderPanelList();
    renderZones();
  }

  function addAntibiotic() {
    var inp = $("newAbx");
    var name = inp.value.trim();
    if (!name) return;
    var exists = state.panel.some(function (a) { return a.toLowerCase() === name.toLowerCase(); });
    if (exists) { toast(t("toast.abxExists")); return; }
    state.panel.push(name);
    inp.value = "";
    savePanel();
  }

  /* ---------- settings: data ---------- */
  function csvCell(v) {
    var s = String(v === undefined || v === null ? "" : v);
    if (/^[=+@\-]/.test(s) && isNaN(Number(s))) s = "'" + s;
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function exportCsv() {
    if (!state.results.length) { toast(t("toast.noData")); return; }
    var lines = [["sample_id", "date", "sample_type", "organism", "lab_state", "lab_lga", "antibiotic", "zone_mm", "interpretation"].join(",")];
    state.results.forEach(function (r) {
      Object.keys(r.zones || {}).forEach(function (abx) {
        lines.push([r.sampleId, r.date, r.sampleType, orgName(r.organism), r.labState, r.labLga, abx, r.zones[abx], r.interp ? r.interp[abx] : ""].map(csvCell).join(","));
      });
    });
    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "platelens-ng-results-" + todayStr().replace(/-/g, "") + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    toast(t("toast.exported"));
  }

  function reinterpretAll() {
    state.results.forEach(function (r) {
      var out = {};
      Object.keys(r.zones || {}).forEach(function (abx) { out[abx] = interpret(r.organism, abx, r.zones[abx]); });
      r.interp = out;
    });
    store.putMany(state.results).then(function () {
      toast(t("toast.reinterpreted", { n: state.results.length }));
    });
  }

  function deleteAll() {
    if (!window.confirm(t("confirm.deleteAll1"))) return;
    if (!window.confirm(t("confirm.deleteAll2"))) return;
    store.clearResults().then(function () {
      state.results = [];
      toast(t("toast.allDeleted"));
    });
  }

  /* ---------- result sheet ---------- */
  function openSheet(rec) {
    var body = $("sheetBody");
    body.textContent = "";

    var head = el("header", "sh-head");
    head.appendChild(el("div", "sh-app", APP.name));
    head.appendChild(el("h2", "sh-lab", rec.labName || "-"));
    var loc = [rec.labLga, rec.labState].filter(Boolean).join(", ");
    if (loc) head.appendChild(el("div", "sh-sub", loc));
    if (rec.labMlscn) head.appendChild(el("div", "sh-sub", t("sheet.mlscn") + ": " + rec.labMlscn));
    body.appendChild(head);

    body.appendChild(el("h3", "sh-title", t("sheet.title")));

    var meta = el("dl", "sh-meta");
    [
      ["sheet.sampleId", rec.sampleId],
      ["sheet.date", fmtDate(rec.date)],
      ["sheet.sampleType", t("st." + rec.sampleType)],
      ["sheet.organism", orgName(rec.organism)]
    ].forEach(function (p) {
      var box = el("div");
      box.appendChild(el("dt", null, t(p[0])));
      box.appendChild(el("dd", null, p[1]));
      meta.appendChild(box);
    });
    body.appendChild(meta);

    var rows = Object.keys(rec.zones || {}).map(function (abx) {
      var code = rec.interp ? rec.interp[abx] : "NB";
      var tr = el("tr");
      tr.appendChild(el("td", null, abx));
      tr.appendChild(el("td", "num", String(rec.zones[abx])));
      var td = el("td");
      var res = el("span", "sh-res");
      res.appendChild(el("span", "badge b-" + code, code));
      res.appendChild(el("span", null, t("res." + code)));
      td.appendChild(res);
      tr.appendChild(td);
      return tr;
    });
    body.appendChild(buildTable("sh-table", [t("sheet.abx"), t("sheet.zone"), t("sheet.result")], rows));

    body.appendChild(el("p", "sh-legend", t("res.legend")));
    body.appendChild(el("p", "sh-bp", t("sheet.bp", { src: BREAKPOINTS.source })));
    body.appendChild(el("p", "sh-sign", t("sheet.verified")));

    var foot = el("div", "sh-foot", APP.sheetFooter);
    foot.appendChild(el("small", null, t("sheet.professional")));
    body.appendChild(foot);

    $("sheet").hidden = false;
    $("sheet").scrollTop = 0;
    document.body.classList.add("noscroll");
  }

  function closeSheet() {
    $("sheet").hidden = true;
    document.body.classList.remove("noscroll");
  }

  /* ---------- consent ---------- */
  function showConsent() {
    $("consentCheck").checked = false;
    $("consentAccept").disabled = true;
    $("consent").hidden = false;
    document.body.classList.add("noscroll");
  }

  function acceptConsent() {
    state.consent = { version: APP.consentVersion, at: new Date().toISOString() };
    store.setMeta("consent", state.consent);
    $("consent").hidden = true;
    document.body.classList.remove("noscroll");
  }

  /* ---------- language ---------- */
  function setLang(code) {
    if (!I18N[code]) code = "en";
    state.lang = code;
    store.setMeta("lang", code);
    renderAll();
  }

  /* ---------- render everything ---------- */
  function renderAll() {
    applyI18n();
    renderStaticSelects();
    renderPanelList();
    renderZones();
    updateBanners();
    $("aboutVersion").textContent = APP.name + " v" + APP.version;
    if (state.tab === "history") renderHistory();
    if (state.tab === "abg") renderAbg();
    if (state.tab === "map") renderMap();
  }

  /* ---------- events ---------- */
  function bindEvents() {
    var nav = document.querySelectorAll(".nav-btn");
    for (var i = 0; i < nav.length; i++) {
      nav[i].addEventListener("click", function (e) { showTab(e.currentTarget.getAttribute("data-tab")); });
    }
    $("profileBanner").addEventListener("click", function () { showTab("settings"); });

    $("resultForm").addEventListener("submit", onSave);
    $("btnClear").addEventListener("click", resetForm);
    $("organism").addEventListener("change", updateAllBadges);
    $("zoneList").addEventListener("input", function (e) {
      var row = e.target.closest ? e.target.closest(".zone-row") : null;
      if (row) updateBadge(row);
    });

    $("abgOrganism").addEventListener("change", renderAbgTable);
    $("mapOrganism").addEventListener("change", renderMapTable);
    $("mapAntibiotic").addEventListener("change", renderMapTable);

    $("labForm").addEventListener("submit", onSaveProfile);
    $("labState").addEventListener("change", updateLgaList);
    $("langSelect").addEventListener("change", function (e) { setLang(e.target.value); });
    $("btnAddAbx").addEventListener("click", addAntibiotic);
    $("newAbx").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); addAntibiotic(); }
    });
    $("btnResetPanel").addEventListener("click", function () {
      if (!window.confirm(t("confirm.resetPanel"))) return;
      state.panel = DEFAULT_PANEL.slice();
      savePanel();
      toast(t("toast.panelReset"));
    });
    $("btnExport").addEventListener("click", exportCsv);
    $("btnReinterpret").addEventListener("click", reinterpretAll);
    $("btnDeleteAll").addEventListener("click", deleteAll);

    $("sheetClose").addEventListener("click", closeSheet);
    $("sheetPrint").addEventListener("click", function () { window.print(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !$("sheet").hidden) closeSheet();
    });

    $("consentLang").addEventListener("change", function (e) { setLang(e.target.value); });
    $("consentCheck").addEventListener("change", function (e) { $("consentAccept").disabled = !e.target.checked; });
    $("consentAccept").addEventListener("click", acceptConsent);
  }

  /* ---------- offline + install (best effort) ---------- */
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
    try { navigator.serviceWorker.register("script.js").catch(function () {}); } catch (e) { /* ignore */ }
  }

  function drawIcon(size) {
    var c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    var g = c.getContext("2d");
    var u = size / 100;
    g.fillStyle = "#0b3c6f";
    g.fillRect(0, 0, size, size);
    g.lineWidth = 7 * u;
    g.strokeStyle = "#0e8f8c";
    g.beginPath(); g.arc(50 * u, 50 * u, 30 * u, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#ffffff";
    [[42, 42], [58, 44], [50, 59]].forEach(function (p) {
      g.beginPath(); g.arc(p[0] * u, p[1] * u, 7 * u, 0, Math.PI * 2); g.fill();
    });
    return c.toDataURL("image/png");
  }

  function injectManifest() {
    try {
      var icon192 = drawIcon(192);
      var icon512 = drawIcon(512);
      var base = location.href.split("#")[0].split("?")[0];
      var manifest = {
        name: APP.name,
        short_name: "PlateLens",
        start_url: base,
        scope: base.replace(/[^\/]*$/, ""),
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#0b3c6f",
        icons: [
          { src: icon192, sizes: "192x192", type: "image/png", purpose: "any" },
          { src: icon512, sizes: "512x512", type: "image/png", purpose: "any" }
        ]
      };
      var link = document.createElement("link");
      link.rel = "manifest";
      link.href = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }));
      document.head.appendChild(link);
      var apple = document.createElement("link");
      apple.rel = "apple-touch-icon";
      apple.href = icon192;
      document.head.appendChild(apple);
    } catch (e) { /* ignore: app still works without install support */ }
  }

  /* ---------- start ---------- */
  function init() {
    bindEvents();
    $("resultDate").value = todayStr();
    $("resultDate").max = todayStr();

    store.open().then(function (ok) {
      state.storageOk = ok;
      if (!ok) return null;
      return Promise.all([
        store.getMeta("lang"), store.getMeta("profile"), store.getMeta("panel"),
        store.getMeta("consent"), store.allResults()
      ]);
    }).catch(function () {
      store.useMemory();
      state.storageOk = false;
      return null;
    }).then(function (loaded) {
      state.panel = DEFAULT_PANEL.slice();
      if (loaded) {
        if (loaded[0] && I18N[loaded[0]]) state.lang = loaded[0];
        state.profile = loaded[1] || null;
        if (Array.isArray(loaded[2]) && loaded[2].length) state.panel = loaded[2];
        state.consent = loaded[3] || null;
        state.results = Array.isArray(loaded[4]) ? loaded[4] : [];
      }
      renderAll();
      loadProfileForm();
      showTab("new");
      if (!state.consent || state.consent.version !== APP.consentVersion) showConsent();
      if (!state.storageOk) toast(t("warn.noStorage"), 6000);
      registerServiceWorker();
      setTimeout(injectManifest, 1500);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

})();
}


/* =========================================================
   SERVICE WORKER (same file, runs only when loaded as a worker)
   Keeps the app working with no network. Cached copy is shown
   first and refreshed in the background; after you edit this
   file, reload the page twice to see your changes.
   ========================================================= */
if (typeof document === "undefined" && typeof self !== "undefined" && self.addEventListener) {
  var CACHE_NAME = "platelens-ng-" + APP.version;
  var CORE_FILES = ["./", "index.html", "style.css", "script.js"];

  self.addEventListener("install", function (e) {
    e.waitUntil(
      caches.open(CACHE_NAME).then(function (c) { return c.addAll(CORE_FILES); }).then(function () { return self.skipWaiting(); })
    );
  });

  self.addEventListener("activate", function (e) {
    e.waitUntil(
      caches.keys().then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k.indexOf("platelens-ng-") === 0 && k !== CACHE_NAME; })
          .map(function (k) { return caches.delete(k); }));
      }).then(function () { return self.clients.claim(); })
    );
  });

  self.addEventListener("fetch", function (e) {
    if (e.request.method !== "GET") return;
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
        var network = fetch(e.request).then(function (res) {
          if (res && res.ok && new URL(e.request.url).origin === self.location.origin) {
            var copy = res.clone();
            caches.open(CACHE_NAME).then(function (c) { c.put(e.request, copy); });
          }
          return res;
        }).catch(function () { return hit || caches.match("index.html"); });
        return hit || network;
      })
    );
  });
}
