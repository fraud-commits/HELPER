
let unregisterFilterEventListener = null;
let unregisterMarkSelectionEventListener = null;
let worksheet = null;
let worksheetName = null;
let categoryColumnNumber = null;
let valueColumnNumber = null;

// Visible diagnosis: any uncaught crash is shown in the empty-state panel
// instead of leaving a silent dashboard full of dashes.
// NOTE: Tableau data callbacks run inside promises, so both 'error' and
// 'unhandledrejection' must be trapped.
function showExtError(msg){
  try{
    $('#dashboard-content').hide();
    $('#empty-state h4').text('Extension error');
    $('#empty-state p').text(String(msg));
    $('#empty-state').css('display', 'flex');
  }catch(_){}
}
window.addEventListener('error', function(e){ showExtError((e && e.message) || e); });
window.addEventListener('unhandledrejection', function(e){
  let r = e && e.reason;
  showExtError((r && r.message) || r || e);
});
function fail(msg){ throw new Error(msg); }

// ---- Dark / light theme (body.dark overrides the tokens in style.css) ----
function applyTheme(mode, save){
  let dark = (mode === 'dark');
  document.body.classList.toggle('dark', dark);
  let btn = document.getElementById('theme-toggle');
  if(btn){
    btn.innerHTML = '<i class="bi bi-' + (dark ? 'sun' : 'moon') + '"></i>';
    btn.title = dark ? 'Light mode' : 'Dark mode';
  }
  if(save !== false){ try{ localStorage.setItem('helper-theme', dark ? 'dark' : 'light'); }catch(e){} }
}
function initTheme(){
  let mode = 'light';
  try{ mode = localStorage.getItem('helper-theme') || 'light'; }catch(e){}
  applyTheme(mode, false);
}
initTheme();
// ---- loading overlay: shown while Tableau data is being re-pulled, removed when
// the render finishes — Load pipeline: reset -> fetch -> render -> unblur ----
function loadOverlay(show, text){
  let $ov = $('#load-overlay');
  if(!$ov.length){ return; }
  if(show){
    $ov.find('.load-text').text(text || 'Loading…');
    $ov.css('display', 'flex');
  }else{
    $ov.hide();
  }
}
// any global error must not leave the blur on screen
window.addEventListener('error', function(){ loadOverlay(false); });
window.addEventListener('unhandledrejection', function(){ loadOverlay(false); });
$(document).off('click.curtoggle', '#currency-toggle, #currency-toggle-2').on('click.curtoggle', '#currency-toggle, #currency-toggle-2', function(){
  $(this).blur(); // no stuck focus highlight on the chip
  MoneyMode = (MoneyMode === 'native') ? 'eur' : 'native';
  drawChartJS(); // full re-render in the selected currency
});
$(document).off('click.themetoggle', '#theme-toggle').on('click.themetoggle', '#theme-toggle', function(){
  applyTheme(document.body.classList.contains('dark') ? 'light' : 'dark');
  drawChartJS(); // re-render so canvas colors follow the theme
});
// ---- manual refresh: tool-side only ----
// the workbook data source is NOT re-queried (no refreshAsync) — the extension
// just re-reads the worksheet summary cache and re-renders; overlay blur is
// already toggled inside drawChartJS
$(document).off('click.extrefresh', '#ext-refresh').on('click.extrefresh', '#ext-refresh', function(){
  let btn = $(this);
  if(btn.hasClass('busy')){ return; } // one refresh at a time
  btn.addClass('busy').blur();
  btn.find('i').attr('class','bi bi-arrow-repeat spin');
  try{ drawChartJS(); }catch(e){ /* drawChartJS wraps its own re-render */ }
  btn.removeClass('busy');
  btn.find('i').attr('class','bi bi-arrow-repeat');
});

// theme token reader (CSS variables in style.css); chart follows a future
// dark theme automatically, falls back to light values if unavailable
function themeVar(name, fallback){
  try{
    let v = getComputedStyle(document.documentElement).getPropertyValue(name);
    v = v ? v.trim() : '';
    return v || fallback;
  }catch(e){ return fallback; }
}

// ---- Number format (EN style): decimal dot + comma thousands ----
// Every money/percent value in the UI goes through fmtNum, so tables, cards,
// tooltips and findings all read the same way ("42,900.00" instead of
// "42900.00"). Formatted by hand on purpose: toLocaleString('en-US') depends on
// ICU data being present in the Tableau webview, which is not guaranteed.
function fmtNum(v, digits){
  let d = (digits === undefined) ? 2 : digits;
  let n = Number(v);
  if(!isFinite(n)){ return '—'; }
  // large native-currency sums (IDR/INR/… millions) get no decimals so the
  // tables keep their column widths; explicit digits requests are untouched
  if(digits === undefined && Math.abs(n) >= 100000){ d = 0; }
  let neg = n < 0;
  let parts = Math.abs(n).toFixed(d).split('.');
  let int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); // comma thousands
  let out = int + (parts.length > 1 ? '.' + parts[1] : '');
  return (neg ? '-' : '') + out;
}

// long round ids (uuid) don't fit the Round statistics column — show a short
// form and keep the full value in the cell tooltip; clicking the cell copies
// the full id to the clipboard (the tooltip alone can't be copied)
function shortRoundId(id){
  let s = String(id || '');
  return s.length > 14 ? s.slice(0, 8) + '…' + s.slice(-3) : s;
}
function copyPlainText(txt, done){
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(function(){ done(true); }, function(){ done(copyPlainTextExec(txt)); });
      return;
    }
  }catch(e){}
  done(copyPlainTextExec(txt));
}
function copyPlainTextExec(txt){
  try{
    let ta = document.createElement('textarea');
    ta.value = String(txt);
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }catch(e){ return false; }
}
$(document).off('click.roundcopy').on('click.roundcopy', '.table-roundTop tbody td:first-child', function(){
  let full = $(this).attr('title') || $(this).text();
  let $cell = $(this);
  copyPlainText(full, function(ok){
    let prev = $cell.html();
    $cell.html('<span style="color:#0f766e;font-size:10px">' + (ok ? '✓ copied' : 'copy failed') + '</span>');
    setTimeout(function(){ $cell.html(prev); }, 900);
  });
});

// ---- currency helpers ----
// The dashboard shows EUR by default; the "Financial analysis from player's
// perspective" block switches to the session's native currency (Currency +
// native BET/NET columns in the sheet) when the session has one consistent one.
function currencyLabel(code){
  const m = { EUR:'€', USD:'$', GBP:'£', CAD:'C$', AUD:'A$', CHF:'CHF ', INR:'₹', TRY:'₺', ZAR:'R', KES:'KSh ', NGN:'₦', BRL:'R$', MXN:'MX$' };
  return m[code] || (code + ' ');
}
let SessionNative = '';   // detected native currency code for the session, '' = none/EUR
let NativeBetIdx = -1;    // summary column index of native BET (when usable)
let NativeNetIdx = -1;    // summary column index of native NET (when usable)

// whole-dashboard currency mode: 'eur' (default) | 'native' (header switch)
let MoneyMode = 'eur';
let MoneyModeCur = '';    // native code the current mode was set for (resets on currency change)

// Watchdog: if Tableau never answers with data (blocked extension, missing
// sheet, unset filters), say so instead of leaving eternal zeros/dashes.
let booted = false;
// Global game scope: the whole dashboard follows DashGameFilter ('__all' or a GameType).
let DashGameFilter = '__all';
// Bet type table filter: 'all' | 'main' | 'side'.
let BetTypeFilter = 'all';
// Rounds whose timestamp could not be parsed (break analysis skips them).
let UnparsedTimeCount = 0;
// chart click-tooltip element (declared here: chartTipHide() runs at refresh
// top, long before the chart section below — late `let` would throw TDZ).
let $chartTip = null;
// pinned round id (click) vs transient hover preview; last round shown (rebuild guard)
let chartTipPinned = null, chartTipFor = null;

//////////////////////////////////////////////////////////////////////////////////////
// BREAK RULES (explicitly defined):
//   gap between two consecutive played rounds < 3 min   -> Sequential
//   3 min  <= gap < 10 min  -> SKIP  (player watched but did not bet, est. skipped rounds counted)
//   10 min <= gap < 30 min  -> SHORT BREAK
//   gap    >= 30 min        -> LONG BREAK
// Rounds are sorted by time first; timestamps that cannot be parsed are skipped.
//
// NOTE: these bindings sit at the TOP LEVEL on purpose. Almost all of the analysis
// code lives inside drawChartJS()'s .then() callback, and code there runs before any
// declaration further down — a `let` declared inside that callback is in the temporal
// dead zone when earlier code touches it ("Cannot access ... before initialization"),
// and applyClientLabel() would not exist for the init call.
const BREAK_RULES = { SKIP_MIN: 3, SKIP_MAX: 10, SHORT_MAX: 30 };
// ---- client (workbook level) identification ---------------------------------
// Sub Partner Id / CompanyCode differs for every player, so it cannot be the client
// key. Sources, in order of precedence: 1) the value typed into the "Client" field
// (extension settings, saved in the workbook), 2) the fraud sheet's own name — rename
// the sheet "fraud" -> "fraud Mac88" / "fraud | RG" and the suffix is the client,
// 3) a Title/Text zone name (only readable with Extensions lib >= 1.1).
// The dashboard tab name is NOT a source — it names the dashboard, not the client.
const CLIENT_BREAK_RULES = {
  // keys are matched against the Client label (case-insensitive substring for
  // keys of 4+ chars, word-bounded for short ones like 'rg')
  'mac88':       { SKIP_MIN: 5, SKIP_MAX: 10, SHORT_MAX: 30 },
  'royalgaming': { SKIP_MIN: 5, SKIP_MAX: 10, SHORT_MAX: 30 },
  'rg':          { SKIP_MIN: 5, SKIP_MAX: 10, SHORT_MAX: 30 }
};
let ClientLabel = '';       // detected client label (from the Client field / fraud sheet name)
// key of the client name stored in the extension Settings namespace (per workbook)
const CLIENT_LABEL_KEY = 'helperClientLabel';
// normal interval between rounds for THIS client, in seconds (0 = use the
// per-game default table). Every client runs its tables at its own speed, so the
// bot "plays very fast" check needs the client's own pace as the baseline.
const CLIENT_PACE_KEY = 'helperClientPace';
let ClientPaceSec = 0;
// measured normal round interval of the clients we know, in seconds:
// mac88 and RG run a round about every 1.5 min. The per-game table below
// (measured on a 38k-round sample of other clients) is much faster, so
// without this the bot check would flag normal play as "plays very fast".
const CLIENT_PACE_SEC = {
  'mac88': 90, 'royalgaming': 90, 'rg': 90
};
// Median gap between rounds on a table, measured on the sample file (38k rounds).
// Used as a fallback when the player's own cadence cannot be estimated.
const TYPICAL_ROUND_MIN = {
  'Andar Bahar': 1.42, 'BacBo': 0.68, 'Baccarat': 0.53, 'Blackjack': 0.60,
  'Casino Holdem': 0.93, 'Dragon Tiger': 0.47, 'Dynamite Roulette': 0.72,
  'HiLo': 0.50, 'Land of Ra': 0.97, 'Lucky Wheelionaire': 1.00,
  'Multiplier Auto Roulette': 0.70, 'Roulette': 0.68, 'Roulette Rouge': 0.77,
  'Scalable Blackjack': 1.00, 'Sic Bo': 0.58, 'Teen Patti': 0.90
};
const DEFAULT_ROUND_MIN = 0.67; // 40 s, overall median in the sample
// median gap (minutes) measured for a game type — the "normal pace" baseline
function typicalRoundMinForGame(gameType){
  const g = String(gameType || '').toLowerCase().replace(/\s+/g, '');
  if(!g){ return DEFAULT_ROUND_MIN; }
  for(let k in TYPICAL_ROUND_MIN){
    if(g.indexOf(String(k).toLowerCase().replace(/\s+/g, '')) >= 0){ return TYPICAL_ROUND_MIN[k]; }
  }
  return DEFAULT_ROUND_MIN;
}

// the "Client" input: Enter / leaving the field saves the label into the workbook
$(document).off('change.clientlabel', '#client-label-input').on('change.clientlabel', '#client-label-input', function(){
  saveClientLabel(String($(this).val() || '').trim());
});
$(document).off('keydown.clientlabel', '#client-label-input').on('keydown.clientlabel', '#client-label-input', function(e){
  if(e.keyCode === 13){ $(this).blur(); }                       // Enter = save (change fires on blur)
  else if(e.keyCode === 27){ $(this).val(ClientLabel).blur(); } // Esc = undo edits
});
// the "pace" input: the client's normal round interval, in seconds
$(document).off('change.clientpace', '#client-pace-input').on('change.clientpace', '#client-pace-input', function(){
  saveClientPace(String($(this).val() || '').trim());
});
$(document).off('keydown.clientpace', '#client-pace-input').on('keydown.clientpace', '#client-pace-input', function(e){
  if(e.keyCode === 13){ $(this).blur(); }
  else if(e.keyCode === 27){ $(this).val(ClientPaceSec || '').blur(); }
});

function labelMatchesKey(label, key){
  const l = String(label).toLowerCase(), k = String(key).toLowerCase();
  if(k.length >= 4){ return l.indexOf(k) >= 0; }   // 'mac88' matches "3.Mac88_PC3"
  // short keys ('rg') must sit between non-alphanumerics, not inside a word
  return new RegExp('(^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(l);
}
function currentBreakRulesKey(){
  // rules are keyed ONLY by the explicit client label (the Client field, or the
  // fraud sheet's name suffix). Operator ids are no longer a key: sub partner ids
  // differ per player, and the "(operator)" legend was noise for the analyst.
  const keys = Object.keys(CLIENT_BREAK_RULES);
  for(let i = 0; i < keys.length; i++){
    if(ClientLabel && labelMatchesKey(ClientLabel, keys[i])){ return keys[i]; }
  }
  return '';
}
function currentBreakRules(){
  const key = currentBreakRulesKey();
  return key ? CLIENT_BREAK_RULES[key] : BREAK_RULES;
}
// built-in normal round interval of the detected client, in seconds (0 = none).
// mac88 / RG run a round about every 1.5 min - the per-game table is measured
// on other clients and is much faster there.
function currentClientPaceDefault(){
  const keys = Object.keys(CLIENT_PACE_SEC);
  for(let i = 0; i < keys.length; i++){
    if(ClientLabel && labelMatchesKey(ClientLabel, keys[i])){ return CLIENT_PACE_SEC[keys[i]]; }
  }
  return 0;
}
// the pace actually used as the baseline: the value typed by the analyst wins,
// then the client's built-in default, then (0) the per-game default table.
// The default is derived from the CURRENT label on every call - it must never
// go stale when the client name changes.
function effectivePaceSec(){
  if(ClientPaceSec > 0){ return ClientPaceSec; }
  return currentClientPaceDefault();
}
// baseline of the bot "plays very fast" check: the client's own pace wins over
// the per-game default table (every client runs its tables at its own speed).
// Pure function of the current label/pace — testable without Tableau.
function botPaceBaseline(botGame){
  let paceSec = effectivePaceSec();
  if(paceSec > 0){
    return {
      useClientPace: true,
      min: paceSec / 60,
      // the note names the client when the baseline is the built-in default
      source: ClientPaceSec > 0 ? 'this client' : (ClientLabel || 'this client')
    };
  }
  return { useClientPace: false, min: typicalRoundMinForGame(botGame), source: botGame };
}
// The fraud sheet may carry the client name in ITS OWN NAME (worksheet title text is
// NOT exposed by the Extensions API — only the sheet name is), e.g. rename the sheet
// "fraud" -> "fraud Mac88" / "fraud | RG". The suffix becomes the client label.
const FRAUD_SHEET_RE = /^fraud(\s*[|:\-–—·]\s*|\s+)(.+)$/;
function findFraudSheet(worksheets){
  return worksheets.find(function(s){ return s.name === 'fraud'; }) ||
         worksheets.find(function(s){ return FRAUD_SHEET_RE.test(String(s.name || '')); });
}
function fraudSheetClient(sheetName){
  const m = FRAUD_SHEET_RE.exec(String(sheetName || '').trim());
  const suffix = m ? m[2].trim() : '';
  return /[a-zа-я]/i.test(suffix) ? suffix : '';   // "fraud 2" is a copy, not a client
}
function detectClientLabelSources(){
  // reads the workbook only: the fraud sheet's own name first, then a Title/Text zone.
  // The dashboard tab name is deliberately NOT used — it names the dashboard, not the client.
  let found = [], detected = '';
  let generic = /^(title|text|blank|image|dashboard|sheet|page)([\s_-]*\d+)?$/i;
  try{
    const dash = tableau.extensions.dashboardContent.dashboard;
    const sheets = dash.worksheets || [];
    for(let i = 0; i < sheets.length; i++){
      const nm = sheets[i] && sheets[i].name ? String(sheets[i].name).trim() : '';
      const client = fraudSheetClient(nm);
      if(client){
        found.push('sheet "' + nm + '"');
        if(!detected){ detected = client; }
      }
    }
    const objs = dash.objects || [];
    for(let i = 0; i < objs.length; i++){
      const o = objs[i];
      const tp = String(o && o.type ? o.type : '').toLowerCase();
      if(tp !== 'title' && tp !== 'text'){ continue; }
      const nm = o.name ? String(o.name).trim() : '';   // .name needs Extensions lib >= 1.1.0
      if(!nm){ continue; }
      found.push('zone "' + nm + '"');
      if(!detected && !generic.test(nm)){ detected = nm; }
    }
  }catch(e){ found.push('error: ' + e); }
  return { label: detected, sources: found };
}
function applyClientLabel(){
  // precedence: the value typed into the "Client" field (saved in the workbook via
  // extension settings) wins over what could be detected from the workbook itself
  let saved = '';
  try{ saved = String(tableau.extensions.settings.get(CLIENT_LABEL_KEY) || '').trim(); }catch(e){}
  let det = detectClientLabelSources();
  ClientLabel = saved || det.label;
  let src = saved ? ['settings "' + saved + '"'].concat(det.sources) : det.sources;
  let $inp = $('#client-label-input');
  if($inp.length){
    if(document.activeElement !== $inp[0]){ $inp.val(ClientLabel); }
    // warn when the typed name matches no break-rule key (rules silently fall back to default)
    let noRule = !!ClientLabel && !currentBreakRulesKey();
    $inp.toggleClass('no-rule', noRule);
    if(noRule){ src.push('no break rule for this name — default 3 min rules are used'); }
    $inp.attr('title', src.length
      ? 'client label sources: ' + src.join(' · ')
      : 'no client label found — type the client name and press Enter');
  }
  // client's own pace (seconds between rounds) — baseline for the bot speed check
  let pace = 0;
  try{ pace = parseFloat(tableau.extensions.settings.get(CLIENT_PACE_KEY) || 0) || 0; }catch(e){}
  ClientPaceSec = (pace > 0 && isFinite(pace)) ? Math.round(pace) : 0;
  // built-in default of this client (mac88 / RG: a round takes ~1.5 min)
  let dflt = currentClientPaceDefault();
  let $pace = $('#client-pace-input');
  if($pace.length){
    if(document.activeElement !== $pace[0]){ $pace.val(ClientPaceSec || ''); }
    // the built-in default is shown as a placeholder — the field itself stays empty
    // so the analyst can tell "not set" from "set to X"
    $pace.attr('placeholder', (ClientPaceSec ? '' : (dflt ? (dflt + ' s') : 'pace s')));
    $pace.attr('title', ClientPaceSec
      ? 'normal round interval for this client: ~' + ClientPaceSec + ' s (typed by the analyst — used by the bot speed check)'
      : (dflt
          ? 'normal round interval for ' + (ClientLabel || 'this client') + ': ~' + dflt + ' s (built-in default, used by the bot speed check) — type a value to override'
          : 'normal round interval for this client in seconds (e.g. 32 baccarat, 40 roulette) — leave empty to use the per-game default'));
  }
  console.log('HELPER client label:', ClientLabel || '(none)', src, saved ? '(saved)' : '(auto)',
              'pace:', ClientPaceSec ? ClientPaceSec + 's (typed)'
                             : (dflt ? dflt + 's (client default)' : '(per-game default)'));
}
function saveClientLabel(value){
  // persists into the workbook (Settings namespace) — save the .twb once afterwards
  const clean = String(value === undefined || value === null ? '' : value).trim();
  try{
    tableau.extensions.settings.set(CLIENT_LABEL_KEY, clean);
    tableau.extensions.settings.saveAsync().then(function(){
      applyClientLabel();
      drawChartJS();   // re-run break analysis with the new label
    }, function(e){ console.log('settings save failed', e); });
  }catch(e){ console.log('settings save failed', e); }
}
function saveClientPace(value){
  // the client's normal pace in seconds; empty = per-game default table
  const num = parseFloat(value);
  const clean = (isFinite(num) && num > 0) ? String(Math.round(num)) : '';
  try{
    tableau.extensions.settings.set(CLIENT_PACE_KEY, clean);
    tableau.extensions.settings.saveAsync().then(function(){
      applyClientLabel();
      drawChartJS();   // re-run the bot check with the new baseline
    }, function(e){ console.log('settings save failed', e); });
  }catch(e){ console.log('settings save failed', e); }
}

setTimeout(function(){
  if(!booted){
    showExtError('Tableau did not return data in 15s. Check: 1) the fraud sheet is on this dashboard, 2) Player Id / Timestamp parameters are set, 3) the extension was re-added from the current .trex — then Reload.');
  }
}, 15000);





$(document).ready(function () {
   tableau.extensions.initializeAsync().then(function () {
      // Draw the chart when initialising the dashboard.
      applyClientLabel();   // client name: saved value (settings) or workbook Title/tab
      getSettings();
      drawChartJS();
      // Set up the Settings Event Listener.
      unregisterSettingsEventListener = tableau.extensions.settings.addEventListener(tableau.TableauEventType.SettingsChanged, (settingsEvent) => {
         // On settings change.
      applyClientLabel();
      getSettings();
       drawChartJS();
      });
   }, function () { console.log('Error while Initializing: ' +err.toString()); });
});









function getSettings() {
   // Once the settings change populate global variables from the settings.

   const worksheets = tableau.extensions.dashboardContent.dashboard.worksheets;

   var worksheet = findFraudSheet(worksheets);

   if(!worksheet){ fail("Worksheet 'fraud' (or 'fraud <client>') is not on this dashboard — add the sheet and Reload the extension."); }

   // If settings are changed we will unregister and re register the listener.
   if (unregisterFilterEventListener != null) {
      unregisterFilterEventListener();
   }

   // If settings are changed we will unregister and re register the listener.
   if (unregisterMarkSelectionEventListener != null) {
      unregisterMarkSelectionEventListener();
   }

   // Get worksheet


   // Add listener
   unregisterFilterEventListener = worksheet.addEventListener(tableau.TableauEventType.FilterChanged, (filterEvent) => {
      drawChartJS();
   });

   unregisterMarkSelectionEventListener = worksheet.addEventListener(tableau.TableauEventType.MarkSelectionChanged, (filterEvent) => {
      drawChartJS();
   });
}




function drawChartJS() {

   loadOverlay(true, 'Refreshing…'); // pipeline step: hide the previous render
   const worksheets = tableau.extensions.dashboardContent.dashboard.worksheets;

   var worksheet = findFraudSheet(worksheets);

   if(!worksheet){ fail("Worksheet 'fraud' (or 'fraud <client>') is not on this dashboard — add the sheet and Reload the extension."); }

   

   worksheet.getSummaryDataAsync().then(function (sumdata) {
     booted = true;

     // --- No player selected: show placeholder instead of the dashboard ---
     if (!sumdata.data || sumdata.data.length === 0) {
       $('#dashboard-content').hide();
       $('#empty-state').css('display', 'flex');
       loadOverlay(false);
       return;
     }
     $('#empty-state').hide();
     $('#dashboard-content').show();

     $(".Break-Heat-Map").empty();
     $(".DealerTop").empty();
     $(".TableTop").empty();
     $(".GameTypeTop").empty();
     $(".RoundTop").empty();
     $(".BetPosTop").empty();
     if ($.fn.DataTable.isDataTable('.table-dealer')) { $('.table-dealer').DataTable().clear().destroy(); }
     if ($.fn.DataTable.isDataTable('.table-table'))  { $('.table-table').DataTable().clear().destroy(); }
     if ($.fn.DataTable.isDataTable('.table-game'))   { $('.table-game').DataTable().clear().destroy(); }
     if ($.fn.DataTable.isDataTable('.table-roundTop')) { $('.table-roundTop').DataTable().clear().destroy(); }
     if ($.fn.DataTable.isDataTable('.table-bettop'))   { $('.table-bettop').DataTable().clear().destroy(); }

           // ---- columns: read strictly by fixed index (client column names differ) ----
      // standard sheet order:
      //   0 Timestamp, 1 Operator, 2 Round Id, 3 Dealer Id, 4 Game Type,
      //   5 Player Id, 6 Table ID, 7 Bet Position, 8 BET EUR, 9 NET EUR,
      //   appended at the end when present: 10 Currency, 11 BET, 12 NET
      const RoundTime = 0,
            UserId = 5,
            CompanyCode = 1,
            RoundID = 2,
            GameType = 4,
            BetPosition = 7,
            DealerName = 3,
            TableName = 6;
      let BetEUR = 8, NetEUR = 9;

      // ---- detect a consistent native currency for the session ----
      // activates only when the sheet ends with Currency(10) + BET(11) + NET(12)
      // and every row has the same NON-EUR 3-letter currency; otherwise stay in EUR
      SessionNative = ''; NativeBetIdx = -1; NativeNetIdx = -1;
      let SumCols = (sumdata.columns || []);
      let colCount = SumCols.length;
      let dt0c = sumdata.data || [];
      if(colCount >= 13){
        function findExactName(rex){
          for(let i = 0; i < colCount; i++){
            let fn = normName(SumCols[i] && SumCols[i].fieldName);
            if(rex.test(fn)){ return i; }
          }
          return -1;
        }
        let curCol = findExactName(/^(sum)?currency$/);
        if(curCol === -1){ curCol = 10; }
        let natBet = findExactName(/^(sum)?bet$/);
        if(natBet === -1){ natBet = 11; }
        let natNet = findExactName(/^(sum)?net$/);
        if(natNet === -1){ natNet = 12; }
        let curPrev = '', curOk = true;
        for(let kci = 0; kci < dt0c.length; kci++){
          let cv = String((dt0c[kci][curCol] && dt0c[kci][curCol].formattedValue) || '').trim().toUpperCase();
          if(!cv){ continue; }
          // a currency cell must look like a short code (USD, GEL, SS1…) —
          // 2-6 alphanumeric chars containing letters; digits-only junk is
          // rejected to protect against the sheet not ending with Currency/BET/NET
          if(!/^[A-Z0-9]{2,6}$/.test(cv) || !/[A-Z]/.test(cv)){ curOk = false; break; }
          if(!curPrev){ curPrev = cv; }
          else if(cv !== curPrev){ curOk = false; break; }
        }
        if(curOk && curPrev && curPrev !== 'EUR'){
          SessionNative = curPrev; NativeBetIdx = natBet; NativeNetIdx = natNet;
        }
      }
      // ---- resolve safety net ----
      // 1) trust positions 8/9 when they are really numeric; 2) otherwise
      // re-locate 'BET EUR'/'NET EUR' by name (aggregated pills like
      // 'SUM(BET EUR)' match too); 3) never crash: numv() falls back to
      // parsing formattedValue, unresolved cells sum as 0.
      function normName(s){ return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
      function parseMoney(txt){
        if(txt === null || txt === undefined){ return NaN; }
        let s = String(txt).replace(/\u2212/g, '-').replace(/[^0-9.,\-]/g, '');
        let hasC = s.indexOf(',') >= 0, hasD = s.indexOf('.') >= 0;
        if(hasC && hasD){
          if(s.lastIndexOf(',') > s.lastIndexOf('.')){ s = s.replace(/\./g, '').replace(',', '.'); }
          else { s = s.replace(/,/g, ''); }
        } else if(hasC){
          s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
        }
        let v = parseFloat(s);
        return isFinite(v) ? v : NaN;
      }
      function numv(row, idx){
        let cell = row ? row[idx] : null;
        if(cell === null || cell === undefined){ return 0; }
        let v = cell.value;
        if(typeof v !== 'number' || !isFinite(v)){ v = parseMoney(cell.formattedValue); }
        if(!isFinite(v)){ v = 0; }
        return v;
      }
      function colNumericOk(idx){
        if(idx < 0 || idx >= colCount){ return false; }
        for(let i = 0; i < Math.min(dt0c.length, 40); i++){
          let cell = dt0c[i][idx];
          if(cell && typeof cell.value === 'number' && isFinite(cell.value)){ return true; }
        }
        return dt0c.length === 0;
      }
      function findMoneyCol(sub){
        let target = normName(sub), loose = null;
        for(let i = 0; i < colCount; i++){
          let fn = normName(SumCols[i] && SumCols[i].fieldName);
          if(!fn){ continue; }
          if(fn === target){ return i; }
          if(fn.indexOf(target) >= 0 && loose === null){ loose = i; }
        }
        return loose === null ? -1 : loose;
      }
      let BetBad = !colNumericOk(BetEUR), NetBad = !colNumericOk(NetEUR);
      if(BetBad || NetBad){
        let bByName = findMoneyCol('beteur'), nByName = findMoneyCol('neteur');
        if(bByName >= 0 && colNumericOk(bByName)){ BetEUR = bByName; }
        if(nByName >= 0 && colNumericOk(nByName)){ NetEUR = nByName; }
      }
      let names55 = [];
      for(let nI = 0; nI < Math.min(colCount, 16); nI++){
        names55.push(nI + ':' + String((SumCols[nI] && SumCols[nI].fieldName) || '').toLowerCase().replace(/sum\(|\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 14));
      }
      let badge = 'cols=' + colCount + ' · beteur=' + BetEUR + ' · neteur=' + NetEUR + (SessionNative ? ' · native=' + SessionNative : '') + ' · ' + names55.join(' ');
      if(BetBad && BetEUR === 8){ badge += ' · BetEUR✗'; }
      if(NetBad && NetEUR === 9){ badge += ' · NetEUR✗'; }
      let colList = SumCols.slice(0, 16).map(function(c, i){
        return i + ':' + (c && c.fieldName ? String(c.fieldName).slice(0, 20) : '?');
      }).join(' | ');
      console.log('HELPER money shadow: ' + badge);
      console.log('HELPER sheet columns: ' + colList);
      try{
        if(!$('#ext-diag').length){ $('.ext-version').after('<span id="ext-diag" style="opacity:.55;font-size:10px"></span>'); }
        $('#ext-diag').text(' (' + badge + ')');
      }catch(e){}

      // ---- whole-dashboard currency switch (header button) ----
      // client exception: Ballys sessions are always reported in USD, so the
      // dashboard starts in the native currency for that client
      let sheetClientLow = (String(ClientLabel || '') + ' ' + String((worksheet && worksheet.name) || '')).toLowerCase();
      if(!SessionNative){ MoneyMode = 'eur'; MoneyModeCur = ''; }
      else if(MoneyModeCur !== SessionNative){
        MoneyModeCur = SessionNative;
        MoneyMode = (sheetClientLow.indexOf('ballys') >= 0 && SessionNative === 'USD') ? 'native' : 'eur';
      }
      let $curBtn = $('#currency-toggle, #currency-toggle-2');
      if($curBtn.length){
        if(SessionNative){
          let curTxt = (MoneyMode === 'native') ? SessionNative : (String.fromCharCode(8364) + ' EUR');
          $curBtn.show().text(curTxt).prop('disabled', false).toggleClass('cur-native', MoneyMode === 'native');
          $curBtn[0].title = 'Switch dashboard currency: EUR <-> ' + SessionNative;
        }else{
          $curBtn.show().text(String.fromCharCode(8364) + ' EUR').prop('disabled', true).removeClass('cur-native');
          $curBtn[0].title = 'Native currency switch: needs Currency + BET/NET columns and one consistent NON-EUR currency for the whole session';
        }
      }
      // ---- display helpers for the active currency mode ----
      function modeNative(){ return MoneyMode === 'native' && SessionNative && NativeBetIdx >= 0; }
      function moneySym(){ return modeNative() ? currencyLabel(SessionNative) : String.fromCharCode(8364); }
      function aggBet(e){ return modeNative() ? (e.NativeBet || 0) : e.TotalBet; }
      function aggNet(e){ return modeNative() ? (e.NativeNet || 0) : e.TotalNet; }
      function rBetM(e){ return modeNative() ? (e.NativeBet || 0) : e.TotalRoundBet; }
      function rNetM(e){ return modeNative() ? (e.NativeNet || 0) : e.TotalRoundNet; }
      function baseBetM(e){ return modeNative() ? (e.BaseNative > 0 ? e.BaseNative : (e.NativeBet || 0)) : (e.BaseBet > 0 ? e.BaseBet : e.TotalRoundBet); }



           let RoundSkipp = 0;
           let ShortBreak = 0;
           let LongBreak = 0;
           let SequentialGame = 0;

           let indexStart,
               indexNext;
          
           let TotalBet = 0;
let NativeTotalBet = 0;
           let TotalNet = 0;
let NativeTotalNet = 0;

           let RoundArry= [];
           let RoundArry2= [];
           let RatioArry= [];

            let totaltest = 0;
            var worksheetData = sumdata.data;

            // ---- global game scope: the whole dashboard follows DashGameFilter ----
            // (game list built from the full fetch so "All games" is always available)
            let dashGames = [];
            for(let gi = 0; gi < worksheetData.length; gi++){
              let gg = (worksheetData[gi][GameType] && worksheetData[gi][GameType].formattedValue) || 'Unknown';
              if(dashGames.indexOf(gg) === -1){ dashGames.push(gg); }
            }
            dashGames.sort();
            if(dashGames.indexOf(DashGameFilter) === -1){ DashGameFilter = '__all'; }
            let $dsel = $('#dash-game-filter');
            if($dsel.length){
              let dhtml = '<option value="__all">All games</option>';
              for(let gi = 0; gi < dashGames.length; gi++){
                dhtml += '<option value="' + dashGames[gi].replace(/"/g, '&quot;') + '">' + dashGames[gi] + '</option>';
              }
              $dsel.html(dhtml);
              $dsel.val(DashGameFilter);
            }
            if(DashGameFilter !== '__all'){
              worksheetData = worksheetData.filter(function(r){
                return ((r[GameType] && r[GameType].formattedValue) || 'Unknown') === DashGameFilter;
              });
            }
     
            let DealerArry =[];
            let BetPositionArry =[];
            let TableArry = [];

            let up = 0,
            same = 0,
            negativ = 0,
            betRaise = 0,  // raise after a loss + raise after a win (escalation counter)
            martingeil = 0;

            // in blackjack, double/split/insurance are hand decisions, not staking changes —
            // progression analysis excludes them from the base bet
            function isHandAction(gameType, pos){
              let g = String(gameType || '').toUpperCase();
              let p = String(pos || '').toUpperCase();
              if(g.indexOf('BLACKJACK') === -1){ return false; }
              return /^(DOUBLE|SPLIT|INSURANCE|BLIND_DOUBLE|BB_DOUBLE|BB_SPLIT|BB_INSURANCE)/.test(p);
            }
            // ---- Main vs Side bets (per-game rules from the provider bet-type mapping) ----
            // returns 'Side Bet' only for known side wagers, everything else is 'Main Bet'
            function betCategory(gameType, pos){
              let g = String(gameType || '').toUpperCase();
              let p = String(pos || '').toUpperCase();
              if(p.indexOf('BONUS') !== -1){ return 'Side Bet'; }
              if(g.indexOf('BACCARAT') !== -1){ return /PAIR|EITHER|PERFECT|SUPER/.test(p) ? 'Side Bet' : 'Main Bet'; }
              if(g.indexOf('BLACKJACK') !== -1){ return /^21\+3|^PAIR|BONUS|DEALER_PAIR|DEALER_BUST|LUCKY_LADIES/.test(p) ? 'Side Bet' : 'Main Bet'; }
              if(g.indexOf('TEEN PATTI') !== -1){ return p.indexOf('PAIR PLUS') !== -1 ? 'Side Bet' : 'Main Bet'; }
              if(g.indexOf('DRAGON TIGER') !== -1){ return /BIG|SMALL|ODD|EVEN/.test(p) ? 'Side Bet' : 'Main Bet'; }
              return 'Main Bet';
            }
            


            



function Trigger(){

  $('.UserName').text(worksheetData[0][UserId].formattedValue);
  $('.CompanyCode').text(worksheetData[0][CompanyCode].formattedValue);

  // BO player profile link: https://lfscbo.com/#lfs/player&id=<operator>:<player>
  // raw .value (not formattedValue) so ids never pick up thousand separators etc.
  function cellId(cell){ return (cell && cell.value !== undefined && cell.value !== null) ? String(cell.value) : String(cell ? cell.formattedValue : ''); }
  let operatorId = cellId(worksheetData[0][CompanyCode]);
  let playerId = cellId(worksheetData[0][UserId]);
  $('.PlayerId').text(playerId);
  $('.OperatorId').text(operatorId);
  if(operatorId && playerId){
    let boUrl = 'https://lfscbo.com/#lfs/player&id=' + operatorId + ':' + playerId;
    $('.bo-link').attr('href', boUrl).show();
    $('.bo-url').text(boUrl);
  }else{
    $('.bo-link').hide();
    $('.bo-url').text('');
  }

  for (var i = 0; i < worksheetData.length; i++) {

    indexStart = i;
      
    if(i == worksheetData.length - 1){

      indexNext =  worksheetData.length -1


    }else{
      indexNext = i + 1
    }
                              
    if(worksheetData.length > 4){
    //  BreakCounter(indexStart,indexNext)
    }
    totalCounter(indexStart)
    RoundTotla(indexStart,indexNext)
    FraudPattern(indexStart)
  }

}
Trigger();

  function totalCounter(indexStart){
//Tableau Bet and Net messure Sum
   TotalBet += numv(worksheetData[indexStart], BetEUR);
   TotalNet += numv(worksheetData[indexStart], NetEUR);
   if(NativeBetIdx >= 0){
     NativeTotalBet += numv(worksheetData[indexStart], NativeBetIdx);
     NativeTotalNet += numv(worksheetData[indexStart], NativeNetIdx);
   }

  }

  let Margin = TotalNet / TotalBet * 100;
    console.log("Margin : " + Margin)

  // helpers: red color for negative values
  function negClass(v){ return (typeof v === 'number' && v < 0) ? ' class="neg-val"' : ''; }
  function negWrap(v, txt){
    return (typeof v === 'number' && v < 0) ? '<span class="neg-val">' + txt + '</span>' : txt;
  }

  $('.Totalbet').text(moneySym() + " " + fmtNum(modeNative() ? NativeTotalBet : TotalBet));
  $('.Totalnet').text(moneySym() + " " + fmtNum(modeNative() ? NativeTotalNet : TotalNet)).toggleClass('neg-val', (modeNative() ? NativeTotalNet : TotalNet) < 0);
  // session margin bar encodes RISK, not the sign: teal in the normal band,
  // neutral grey when the player loses (casino profits — nothing to flag),
  // red only when abnormally high (>= 50%, worth attention);
  // diverging from the centre zero (±100% scale clamped, 100% = half the track)
  let mHigh = Margin >= 50;
  $('.Margin').text(fmtNum(Margin) + "%").toggleClass('neg-val', mHigh);
  let mClamped = Math.max(-100, Math.min(100, Margin));
  let mBar = $('.margin-bar')
    .toggleClass('bar-pos', Margin >= 0 && !mHigh)
    .toggleClass('bar-minus', Margin < 0)
    .toggleClass('bar-neg', mHigh);
  if(mClamped >= 0){ mBar.css({left: '50%', width: (mClamped / 2) + '%'}); }
  else{ mBar.css({left: (50 + mClamped / 2) + '%', width: (-mClamped / 2) + '%'}); }
  $('.session-dot')
    .toggleClass('dot-pos', Margin >= 0 && !mHigh)
    .toggleClass('dot-minus', Margin < 0)
    .toggleClass('dot-neg', mHigh);




/*

  function BreakCounter(indexStart,indexNext){

   // console.log("start index " + indexStart)
 //   console.log("end index "+ indexNext)

   //console.log(worksheetData[0][UserId])

    var startTime=moment(worksheetData[indexStart][RoundTime].formattedValue, "DD-MM-YYYY HH:mm:ss a");
    var endTime=moment(worksheetData[indexNext][RoundTime].formattedValue, "DD-MM-YYYY HH:mm:ss a");
    var duration = moment.duration(endTime.diff(startTime));
    var hours = parseInt(duration.asHours());
    var minutes = parseInt(duration.asMinutes())-hours*60;

//    console.log((hours + ' hour and '+ minutes+' minutes.'))
       
   //    var result = endTime.diff(startTime, 'hours') + " Hrs and " +     
   //                     endTime.diff(startTime, 'minutes') + " Mns";
//SKIP
      if(hours == 0 && minutes > 2 && minutes <= 10 && worksheetData[indexStart][RoundID].formattedValue !== worksheetData[indexNext][RoundID].formattedValue){
        RoundSkipp += 1;
        $('.skipcnt').text("format");
        $('.break-Heat-Map').append('<div class="badge-sqr badge-skip-c"></div>')
//SHORT        
      }else if(hours == 0 && minutes > 10 && minutes <= 30 && worksheetData[indexStart][RoundID].formattedValue !== worksheetData[indexNext][RoundID].formattedValue){
        ShortBreak += 1;
        $('.break-Heat-Map').append('<div class="badge-sqr badge-short-c"></div>')
//LONG        
      }else if(hours >= 1 || minutes >= 31 && worksheetData[indexStart][RoundID].formattedValue !== worksheetData[indexNext][RoundID].formattedValue){
        LongBreak += 1;
        $('.break-Heat-Map').append('<div class="badge-sqr badge-long-c"></div>')
// Sequential        
      }else if(worksheetData[indexStart][RoundID].formattedValue !== worksheetData[indexNext][RoundID].formattedValue || indexStart == 0){
        SequentialGame += 1;
        $('.break-Heat-Map').append('<div class="badge-sqr badge-sql-c"></div>')
      }

   $('.skipcnt').text(RoundSkipp);
  $('.shortcnt').text(ShortBreak);
  $('.longcnt').text(LongBreak);
  $('.seqcnt').text(SequentialGame);


              
  }


*/

function RoundTotla(indexStart,indexNext){

  let index = RoundArry.findIndex(object => object.RoundId === worksheetData[indexStart][RoundID].formattedValue);
  let index2 = DealerArry.findIndex(object => object.DealerName === worksheetData[indexStart][DealerName].formattedValue);
  let bpName = worksheetData[indexStart][BetPosition].formattedValue;
  let bpGame = worksheetData[indexStart][GameType].formattedValue;
  let index3 = BetPositionArry.findIndex(object => object.BetPosition === bpName && object.GameType === bpGame);
  let index4 = TableArry.findIndex(object => object.TableName === worksheetData[indexStart][TableName].formattedValue);

  if (index === -1) {

    RoundArry.push({
      RoundId: worksheetData[indexStart][RoundID].formattedValue,
      TotalRoundBet: 0,
      BaseBet: 0, // hand stake without in-game actions (blackjack double/split/insurance)
      NativeBet: 0, NativeNet: 0, BaseNative: 0, // native-currency mirrors
      TotalRoundNet:0,
      DealerName: worksheetData[indexStart][DealerName].formattedValue,
      TableName: worksheetData[indexStart][TableName].formattedValue,
      Margin: 0,
      RoundTime: worksheetData[indexStart][RoundTime].formattedValue,
      GameType: worksheetData[indexStart][GameType].formattedValue,
      Positions: {}

    })
  }
  
  if (index2 === -1) {
    DealerArry.push({
      DealerName: worksheetData[indexStart][DealerName].formattedValue,
      TotalBet: 0,
      NativeBet: 0,
      TotalNet:0,
      NativeNet: 0,
      RoundCount :0

    })
  }

////// IF INCLUDES

/*
  const sentence = 'The quick brown foxxxx jumps over the lazy dog.';

  const word = 'fox';
  
  //console.log(`The word "${word}" ${sentence.includes(word) ? 'is' : 'is not'} in the sentence`);
  // expected output: "The word "fox" is in the sentence"
  if(sentence.includes(word) == true){
  console.log("hellow")
  }
*/
  if (index3 === -1) {


    BetPositionArry.push({
      BetPosition: bpName,
      GameType: bpGame,
      TotalBet: 0,
      NativeBet: 0,
      TotalNet:0,
      NativeNet: 0,
      RoundCount :0,
      Category: betCategory(bpGame, bpName)


    })
  }

  if (index4 === -1) {
    TableArry.push({
      TableName: worksheetData[indexStart][TableName].formattedValue,
      TotalBet: 0,
      NativeBet: 0,
      TotalNet: 0,
      NativeNet: 0,
      RoundCount: 0
    })
  }



  let element = RoundArry.find(e => e.RoundId === worksheetData[indexStart][RoundID].formattedValue);
  if (element) {
    element.TotalRoundBet += numv(worksheetData[indexStart], BetEUR);
    element.TotalRoundNet += numv(worksheetData[indexStart], NetEUR);
    // native per-round sums (used by the "Financial analysis" block when the
    // session has one consistent non-EUR currency with native BET/NET in the sheet)
    if(NativeBetIdx >= 0){
      element.NativeBet = (element.NativeBet || 0) + numv(worksheetData[indexStart], NativeBetIdx);
      element.NativeNet = (element.NativeNet || 0) + numv(worksheetData[indexStart], NativeNetIdx);
    }
    // base hand stake excludes in-game actions (blackjack double/split/insurance) —
    // those are hand decisions, not staking decisions, so progression uses BaseBet
    if(!isHandAction(worksheetData[indexStart][GameType].formattedValue, worksheetData[indexStart][BetPosition].formattedValue)){
      element.BaseBet += numv(worksheetData[indexStart], BetEUR);
      if(NativeBetIdx >= 0){ element.BaseNative = (element.BaseNative || 0) + numv(worksheetData[indexStart], NativeBetIdx); }
    }
    // per-round bet-position set (roulette layout coverage analysis)
    if(!element.Positions){ element.Positions = {}; }
    element.Positions[worksheetData[indexStart][BetPosition].formattedValue] = true;
}

let element2 = DealerArry.find(e => e.DealerName === worksheetData[indexStart][DealerName].formattedValue);
if (element2 ) {
  element2.TotalBet += numv(worksheetData[indexStart], BetEUR);
  element2.TotalNet += numv(worksheetData[indexStart], NetEUR);
  if(NativeBetIdx >= 0){
    element2.NativeBet = (element2.NativeBet || 0) + numv(worksheetData[indexStart], NativeBetIdx);
    element2.NativeNet = (element2.NativeNet || 0) + numv(worksheetData[indexStart], NativeNetIdx);
  }

}

// table statistics (per table id / game type)
let element4 = TableArry.find(e => e.TableName === worksheetData[indexStart][TableName].formattedValue);
if (element4) {
  element4.TotalBet += numv(worksheetData[indexStart], BetEUR);
  element4.TotalNet += numv(worksheetData[indexStart], NetEUR);
  if(NativeBetIdx >= 0){
    element4.NativeBet = (element4.NativeBet || 0) + numv(worksheetData[indexStart], NativeBetIdx);
    element4.NativeNet = (element4.NativeNet || 0) + numv(worksheetData[indexStart], NativeNetIdx);
  }
}

let element3 = BetPositionArry.find(e => e.BetPosition === worksheetData[indexStart][BetPosition].formattedValue && e.GameType === worksheetData[indexStart][GameType].formattedValue);
if (element3 ) {
  element3.TotalBet += numv(worksheetData[indexStart], BetEUR);
  element3.TotalNet += numv(worksheetData[indexStart], NetEUR);
  if(NativeBetIdx >= 0){
    element3.NativeBet = (element3.NativeBet || 0) + numv(worksheetData[indexStart], NativeBetIdx);
    element3.NativeNet = (element3.NativeNet || 0) + numv(worksheetData[indexStart], NativeNetIdx);
  }
  element3.RoundCount += 1;
  element3.Category = betCategory(worksheetData[indexStart][GameType].formattedValue, worksheetData[indexStart][BetPosition].formattedValue);
 
}

}


console.log(BetPositionArry)
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// BREAK RULES, CLIENT_BREAK_RULES, ClientLabel, findFraudSheet(),
// currentBreakRules() / applyClientLabel() and the pace tables
// (TYPICAL_ROUND_MIN / typicalRoundMinForGame) moved to the TOP LEVEL of the
// file — they must exist before drawChartJS() starts (analysis code inside its
// .then() callback runs before this point in the code below).

let EstSkippedRounds = 0; // estimated number of game rounds missed during skips

// Median gap between rounds on a table, measured on the sample file (38k rounds).
// Used as a fallback when the player's own cadence cannot be estimated.
function typicalRoundMin(roundsArr){
  // most frequent table name among the player's rounds -> its measured median gap
  let freq = {};
  for(let i = 0; i < roundsArr.length; i++){
    let t = String(roundsArr[i].TableName || '').replace(/^\s*\d+\s*-\s*/, '').trim();
    if(!t){ continue; }
    freq[t] = (freq[t] || 0) + 1;
  }
  let best = '', bestN = 0;
  for(let k in freq){ if(freq[k] > bestN){ best = k; bestN = freq[k]; } }
  if(best && TYPICAL_ROUND_MIN[best] !== undefined){ return TYPICAL_ROUND_MIN[best]; }
  return DEFAULT_ROUND_MIN;
}

// most frequent game type of the rounds in scope (checks are game-aware)
function dominantGameType(roundsArr){
  let freq = {};
  for(let i = 0; i < roundsArr.length; i++){
    let g = String((roundsArr[i] && roundsArr[i].GameType) || 'Unknown');
    freq[g] = (freq[g] || 0) + 1;
  }
  let best = '', bestN = 0;
  for(let k in freq){ if(freq[k] > bestN){ bestN = freq[k]; best = k; } }
  return best || 'Unknown';
}

// games with only a few natural bet positions (baccarat has 2 sides): repeating
// bets are the norm there, so the "few repeating bets" bot signal does not apply
function isLowPositionGame(gameType){
  return /baccarat|blackjack|teenpatti|cards|andar|bahar|holdem|poker|dragontiger|hilo|sicbo|bacbo/i
    .test(String(gameType || '').replace(/\s+/g, ''));
}

function parseRoundTime(t){
  // strict first (DD/MM before MM/DD matters: 09/10 = 9 Oct, not 10 Sep).
  // Single-letter tokens reject zero-padded values in strict mode, so both
  // padded (DD/MM/YYYY HH) and unpadded (D/M/YYYY H) variants are listed.
  let m = moment(t, ["DD-MM-YYYY HH:mm:ss a", "DD-MM-YYYY HH:mm:ss", "YYYY-MM-DD HH:mm:ss",
                     "DD/MM/YYYY HH:mm:ss A", "DD/MM/YYYY HH:mm:ss",
                     "D/M/YYYY H:mm:ss A", "D/M/YYYY H:mm:ss"], true);
  if(!m.isValid()){ m = moment(t); } // last resort: let moment guess the format
  return m.isValid() ? m : null;
}

function fmtGap(mins){
  if(mins >= 60){
    let h = Math.floor(mins / 60);
    let m = Math.round(mins - h * 60);
    return h + ' h ' + m + ' min';
  }
  return fmtNum(mins, 1) + ' min';
}

// ================== GAP TOOLTIP (Break pattern heat map) ==================
// hover = peek · click square = fix (pin) · click a round id = copy it
let $gapTip = null, gapTipPinned = null, gapHideTimer = null;

function gapTipEnsure(){
  if(!$gapTip || !$gapTip.length){
    $gapTip = $('<div class="gap-tip" id="gap-tip"></div>');
    $('body').append($gapTip);
  }
  return $gapTip;
}

function gapTipShow(el){
  let $el = $(el);
  let tip = gapTipEnsure();
  let from = $el.attr('data-from') || '';
  let to = $el.attr('data-to') || '';
  let meta = $el.attr('data-meta') || '';
  // plain text, not an input: mouse selection + right-click → Copy works in embedded Tableau,
  // Ctrl+C there does not. JS copy stays as a bonus where the browser allows it.
  function idText(v){
    return '<span class="gap-copy" data-round="' + v.replace(/"/g, '&quot;') + '" title="select with the mouse, right-click → Copy">' + v + '</span>';
  }
  let ids = '';
  let twoIds = false;
  if(from){ ids += idText(from); }
  if(to){ ids += ' <span class="gap-arrow">→</span> ' + idText(to); twoIds = true; }
  // two ids -> stacked block: a pair of long UUIDs does not fit on one line
  tip.html(
    '<div class="gap-tip-ids' + (twoIds ? ' two' : '') + '">' + ids + '</div>' +
    '<div class="gap-tip-meta">' + meta + '</div>'
  );
  tip.addClass('show');
  gapTipPosition(el);
}

function gapTipPosition(el){
  if(!$gapTip){ return; }
  let rect = el.getBoundingClientRect();
  let scrollL = window.pageXOffset || document.documentElement.scrollLeft || 0;
  let scrollT = window.pageYOffset || document.documentElement.scrollTop || 0;
  let w = $gapTip[0].offsetWidth;
  let h = $gapTip[0].offsetHeight;
  let vw = document.documentElement.clientWidth;

  // keep the tooltip inside the dashboard borders
  let maxLeft = vw - w - 8;
  if(maxLeft < 8){ maxLeft = 8; }
  let left = rect.left + scrollL + rect.width / 2 - w / 2;
  if(left < 8){ left = 8; }
  if(left > maxLeft){ left = maxLeft; }

  // above the square, below it when there is no space on top
  let top = rect.top + scrollT - h - 8;
  if(rect.top - h - 8 < 0){ top = rect.bottom + scrollT + 8; }

  $gapTip.css({ left: left + 'px', top: top + 'px' });
}

function gapTipHide(force){
  if(!force && gapTipPinned){ return; } // pinned tooltip stays until clicked away
  if($gapTip){ $gapTip.removeClass('show'); }
}

function gapTipScheduleHide(){
  clearTimeout(gapHideTimer);
  gapHideTimer = setTimeout(function(){ gapTipHide(false); }, 160);
}

function gapTipCancelHide(){ clearTimeout(gapHideTimer); }

function gapTipUnpin(){
  gapTipPinned = null;
  $('.hmap-tip.gap-tip-pinned').removeClass('gap-tip-pinned');
}

$(document)
  .off('mouseenter.gaptip', '.hmap-tip')
  .on('mouseenter.gaptip', '.hmap-tip', function(){
    if(gapTipPinned){ return; }
    gapTipCancelHide();
    gapTipShow(this);
  })
  .off('mouseleave.gaptip', '.hmap-tip')
  .on('mouseleave.gaptip', '.hmap-tip', gapTipScheduleHide)
  .off('click.gaptip', '.hmap-tip')
  .on('click.gaptip', '.hmap-tip', function(e){
    e.stopPropagation();
    if(gapTipPinned === this){ // second click unfixed
      gapTipUnpin();
      gapTipHide(true);
      return;
    }
    gapTipUnpin();
    gapTipPinned = this;
    $(this).addClass('gap-tip-pinned');
    gapTipCancelHide();
    gapTipShow(this);
  })
  .off('mouseenter.gaptip', '#gap-tip')
  .on('mouseenter.gaptip', '#gap-tip', gapTipCancelHide)
  .off('mouseleave.gaptip', '#gap-tip')
  .on('mouseleave.gaptip', '#gap-tip', gapTipScheduleHide)
  .off('click.gaptip', '#gap-tip')
  .on('click.gaptip', '#gap-tip', function(e){ e.stopPropagation(); })
  .off('click.gaptip-out')
  .on('click.gaptip-out', function(e){ // click anywhere else unfixed
    if($(e.target).closest('#gap-tip').length){ return; } // clicks inside the tooltip don't unfix
    if(gapTipPinned){ gapTipUnpin(); gapTipHide(true); }
  })
  .off('click.gapcopy', '.gap-copy')
  .on('click.gapcopy', '.gap-copy', function(e){
    // IDs are plain text so the analyst can select them with the mouse and
    // right-click -> Copy (that works in the embedded browser); Ctrl+C there is blocked.
    // A JS copy attempt stays as a bonus where the browser allows it.
    e.stopPropagation();
    let $span = $(this);
    let txt = $span.attr('data-round') || $span.text();
    function setHint(t){ $span.closest('.gap-tip').find('.gap-tip-hint').text(t); }
    function ok(){
      $span.addClass('copied');
      setHint('copied to clipboard ✓');
      setTimeout(function(){ $span.removeClass('copied'); }, 1500);
    }
    function needManual(){
      setHint('clipboard is blocked — select the id with the mouse, right-click → Copy');
    }
    function fallback(){
      let done = false, ta = null;
      try{
        ta = document.createElement('textarea');
        ta.value = txt;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try{ ta.setSelectionRange(0, txt.length); }catch(err3){}
        done = document.execCommand('copy');
      }catch(err){ done = false; }
      try{ if(ta){ document.body.removeChild(ta); } }catch(err4){}
      if(done){ ok(); } else { needManual(); }
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(ok, fallback);
    }else{
      fallback();
    }
  });

function BreakCounter(){

  gapTipUnpin();   // data refresh: drop a stale fixed tooltip
  gapTipHide(true);

  let key = currentBreakRulesKey();
  let rules = key ? CLIENT_BREAK_RULES[key] : BREAK_RULES; // client override or defaults
  // legend reflects the rules actually in use (default vs client exception) and
  // names the SOURCE that matched: the Title label, or the operator id fallback
  let $brn = $('#break-rules-note');
  if($brn.length){
    let src = '';
    if(rules !== BREAK_RULES){
      src = ' (' + ((ClientLabel && labelMatchesKey(ClientLabel, key)) ? ClientLabel : key) + ')';
    }
    $brn.text(rules === BREAK_RULES
      ? 'gap 3–10 min = skip (est. missed rounds) · 10–30 min = short break · >30 min = long break'
      : 'client rule' + src + ': gap ' + rules.SKIP_MIN + '–' + rules.SKIP_MAX + ' min = skip · ' + rules.SKIP_MAX + '–' + rules.SHORT_MAX + ' min = short · >' + rules.SHORT_MAX + ' min = long');
  }

  // --- sort a copy of rounds by timestamp (data order is not guaranteed) ---
  let sorted = RoundArry.slice().map(function(r){
    return { r: r, t: parseRoundTime(r.RoundTime) };
  }).filter(function(o){ return o.t !== null; })
    .sort(function(a, b){ return a.t.valueOf() - b.t.valueOf(); });
  UnparsedTimeCount = RoundArry.length - sorted.length;

  // --- typical round cadence = median gap of fast (sequential) intervals ---
  let gaps = [];
  for(let i = 1; i < sorted.length; i++){
    let g = sorted[i].t.diff(sorted[i-1].t, 'minutes', true);
    if(g >= 0 && g < rules.SKIP_MIN){ gaps.push(g); }
  }
  gaps.sort(function(a, b){ return a - b; });
  // median gap of fast (sequential) intervals; if none, fall back to the
  // measured median round time of the player's main table (sample file: 38k rounds)
  let cadence = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : typicalRoundMin(RoundArry);
  if(cadence <= 0){ cadence = DEFAULT_ROUND_MIN; }

  let prevValid = null;

  for(let i = 0; i < sorted.length; i++){

    if(prevValid === null){
      // first played round of the session
      SequentialGame += 1;
      $('.break-Heat-Map').append('<div class="badge-sqr badge-sql-c hmap-tip" data-from="' + sorted[i].r.RoundId + '" data-meta="first round of the session"></div>');
      prevValid = sorted[i];
      continue;
    }

    // gap in minutes between this round and the previous PLAYED round
    let gap = sorted[i].t.diff(prevValid.t, 'minutes', true);
    let gapType, gapClass, gapEst = 0;

    if(gap < rules.SKIP_MIN){
      SequentialGame += 1;
      gapType = 'sequential'; gapClass = 'badge-sql-c';
    }else if(gap < rules.SKIP_MAX){
      // SKIP: player stayed but did not bet; estimate how many game rounds were missed
      RoundSkipp += 1;
      gapEst = Math.max(1, Math.round(gap / cadence) - 1);
      EstSkippedRounds += gapEst;
      gapType = 'SKIP'; gapClass = 'badge-skip-c';
    }else if(gap < rules.SHORT_MAX){
      ShortBreak += 1;
      gapType = 'SHORT BREAK'; gapClass = 'badge-short-c';
    }else{
      LongBreak += 1;
      gapType = 'LONG BREAK'; gapClass = 'badge-long-c';
    }

    // remember the gap on the round itself -> used for hover hint in Round statistics
    sorted[i].r.gapInfo = {
      gap: gap,
      type: gapType,
      est: gapEst,
      prevRound: prevValid.r.RoundId
    };

    // tooltip data for the heat-map square: between which rounds the gap is
    let gapMeta = fmtGap(gap) + ' · ' + gapType
                + (gapEst > 0 ? ' (~' + gapEst + ' rounds missed)' : '');
    $('.break-Heat-Map').append('<div class="badge-sqr ' + gapClass + ' hmap-tip" data-from="' + prevValid.r.RoundId + '" data-to="' + sorted[i].r.RoundId + '" data-meta="' + gapMeta.replace(/"/g, '&quot;') + '"></div>');

    prevValid = sorted[i];
  }

  $('.skipcnt').text(RoundSkipp);
  $('.shortcnt').text(ShortBreak);
  $('.longcnt').text(LongBreak);
  $('.seqcnt').text(SequentialGame);
}
let SkippProcent = RoundSkipp / RoundArry.length * 100;
let ShortProcent = ShortBreak / RoundArry.length * 100;
let LongProcent = LongBreak / RoundArry.length * 100;
let SequentialProcent = SequentialGame / RoundArry.length * 100;
//$('.WinProcent').text(WinProcent.toFixed(2) + "%");
//$('.WinProcent-bar').css('width', WinProcent.toFixed(2) + "%");
let BetContinuty;
let BetContinuty2;



if(RoundArry.length  <= 26){
  BetContinuty = "Short Session"
}else if (SkippProcent <= 5 && RoundArry.length >= 11){
  BetContinuty = "Mainly sequentail"
}else if (SkippProcent > 5 && RoundArry.length >= 11){
  BetContinuty = "Mainly sequentail games, however at some passages skips rounds"
}else if (RoundArry.length == 1){
  BetContinuty = "Only One game round held"
}

if(RoundArry.length == 1){
  BetContinuty2 = "Only one game round held"
}else if (ShortBreak == 1 && LongBreak == 0){
  BetContinuty2 = "One short break"
}else if (ShortBreak == 2 && LongBreak == 0 ){
  BetContinuty2 = "Two short break"
}else if (ShortBreak > 3 && LongBreak == 0 ){
  BetContinuty2 = "Several short breaks"
}else if (LongBreak == 1 && ShortBreak == 0 ){
  BetContinuty2 = "One long break"
}else if (LongBreak == 2 && ShortBreak == 0 ){
  BetContinuty2 = "Two long break"
}else if (LongBreak > 3 && ShortBreak == 0 ){
  BetContinuty2 = "Several long break"
}else if (LongBreak == 1 && ShortBreak == 1 ){
  BetContinuty2 = "One short and one long break"
}else if (LongBreak == 2 && ShortBreak == 2 ){
  BetContinuty2 = "Two short and two long break"
}else if (LongBreak > 2 && ShortBreak > 2 ){
  BetContinuty2 = "Several long and short"
}else if (LongBreak == 1 && ShortBreak ==  2 ){
  BetContinuty2 = "One long and two short breaks"
}else if (LongBreak == 2 && ShortBreak ==  1 ){
  BetContinuty2 = "Two long and one short break"
}
else if (LongBreak == 1 && ShortBreak ==  2 ){
  BetContinuty2 = "Two short and one long break"
}else if (LongBreak >= 3 && ShortBreak == 1 ){
  BetContinuty2 = "Several long breaks and one short"
}else if (LongBreak >= 3 && ShortBreak == 2 ){
  BetContinuty2 = "Several long breaks and two short"
}else if (ShortBreak >= 3 && LongBreak == 1 ){
  BetContinuty2 = "Several short breaks and one long"
}else if (ShortBreak >= 3 && LongBreak == 2 ){
  BetContinuty2 = "Several short breaks and two long"
}else if (ShortBreak == 0 && LongBreak == 0 ){
  BetContinuty2 = "No Breaks"
}

   // console.log(SkippProcent) 
   // Betcontinuty    
    $('.Betcontinuty').text(BetContinuty);    
    
    $('.Betcontinuty2').text(BetContinuty2);

   BreakCounter()

   // time order matters from here on: BetProgression compares each round with the
   // NEXT played round, so RoundArry must be chronological (Tableau row order is not guaranteed)
   RoundArry.sort(function(a, b){
     let ta = parseRoundTime(a.RoundTime), tb = parseRoundTime(b.RoundTime);
     if(!ta && !tb){ return 0; }
     if(!ta){ return 1; }
     if(!tb){ return -1; }
     return ta.valueOf() - tb.valueOf();
   });


function BetProgression (){

  for (let i = 0; i < RoundArry.length; i++ ){

    let cur = i;
    let next;

    if(i == RoundArry.length - 1){

      next =  RoundArry.length -1

    }else{

      next = i + 1
    }

    // transition cur -> next (chronological order guaranteed above):
    // flat = same stake ±2% (10 vs 10.2 is flat, 10 vs 15 is not);
    // negative pattern = raise after a loss OR lower after a win;
    // positive pattern = raise after a win OR lower after a loss.
    // (chaotic is session-level — both systems mixed — not a transition label.)
    // BaseBet = hand stake without blackjack double/split/insurance actions;
    // falls back to the total when a round has no base stake (safety).
    let curBet = RoundArry[cur].BaseBet > 0 ? RoundArry[cur].BaseBet : RoundArry[cur].TotalRoundBet;
    let nextBet = RoundArry[next].BaseBet > 0 ? RoundArry[next].BaseBet : RoundArry[next].TotalRoundBet;
    let curNet = RoundArry[cur].TotalRoundNet;
    if (Math.abs(nextBet - curBet) <= curBet * 0.02){
      same += 1; //Flat
    }else if(nextBet > curBet && curNet <= 0){
      // raise after a loss → negative pattern (any size, not just 2x);
      // Martingale is detected separately below (it needs a run of 5+ doublings)
      negativ += 1; // Negative
      betRaise += 1; // escalation counter: stake raised
    }else if(nextBet > curBet){
      betRaise += 1; // escalation counter: stake raised
      up += 1; // raise after a win → positive pattern
    }else if(curNet > 0){
      negativ += 1; // lower after a win (back to base) → negative pattern
    }else{
      up += 1; // lower after a loss (cut) → positive pattern
    }

    
    }

  // ---- Martingale: a run of >= 5 consecutive doublings (x2, 2% tolerance) after
  // losses — 2 -> 4 -> 8 -> 16 -> 32 (and further). A shorter run is ordinary
  // negative progression: two random bigger stakes are NOT a martingale system.
  let mgRun = 0;
  martingeil = 0;   // number of chains of >= 5 consecutive doublings
  for(let i = 1; i < RoundArry.length; i++){
    let prevRound = RoundArry[i-1], curRound = RoundArry[i];
    let prevBet = prevRound.BaseBet > 0 ? prevRound.BaseBet : prevRound.TotalRoundBet;
    let curBet = curRound.BaseBet > 0 ? curRound.BaseBet : curRound.TotalRoundBet;
    if(prevRound.TotalRoundNet <= 0 && prevBet > 0 && curBet >= prevBet * 1.95){
      // 1.95 (not 2.00) absorbs cent rounding of the stake — 384.16 -> 752.95 is
      // 1.9599x and must still count as a doubling step
      mgRun += 1;
      if(mgRun >= 5){ martingeil += 1; mgRun = 0; }   // chain counted — look for the next one
    }else{
      mgRun = 0;
    }
  }



}



BetProgression ()








//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

console.log(RoundArry)
console.log(BetPositionArry)

//const results = RoundArry.filter(({ DealerName: id1 }) => !DealerArry.some(({ DealerName: id2 }) => id2 === id1));


let WinRoundCnt = 0;
let LossRoundCnt = 0;
let TieRoundCnt = 0;

let MainBet = {},
    SideBetSma = {};

function FraudPattern(indexStart){
/*
  let word = "Banker"

  let Category = ["Banker","Black","Red",];

  let BetPositionT = worksheetData[indexStart][BetPosition].formattedValue;


  
  if(BetPositionT.includes(word) == true){
    console.log("Main")
  }else{
    console.log("test")
  }
  */
}

function RoundTotals (){

  

  for(let i = 0; i < RoundArry.length; i++){
    if(RoundArry[i].TotalRoundNet > 0){
      WinRoundCnt += 1;
    }else if(RoundArry[i].TotalRoundNet < 0){
      LossRoundCnt += 1;
    }else{
      TieRoundCnt += 1;
    }

  }


}

RoundTotals ()

///////////////////////////////////////////////////
$('.total-round-cnt').text(RoundArry.length)
$('.win-round-cnt').text(WinRoundCnt)
$('.loss-round-cnt').text(LossRoundCnt)
$('.tie-round-cnt').text(TieRoundCnt)



let decidedRounds = WinRoundCnt + LossRoundCnt;
// win ratio excludes ties (decided rounds only) — same base as Key findings
let WinProcent = decidedRounds > 0 ? WinRoundCnt / decidedRounds * 100 : 0;
$('.WinProcent').text(decidedRounds > 0 ? fmtNum(WinProcent) + "%" : '—');
// red when abnormally high: >=55%, min 10 decided
let effWinPct = WinProcent;
let winCrit = decidedRounds >= 10 && effWinPct >= 55;
$('.WinProcent').toggleClass('neg-val', winCrit);
$('.WinProcent-bar').toggleClass('bar-neg', winCrit);
$('.WinProcent-bar').css('width', Math.min(100, WinProcent).toFixed(2) + "%");



// output = [3,7,5,2]
  // console.log(RoundArry2)


   // let result = RoundArry.map(a => a.RoundId);
   // console.log(RoundArry.map(a => a.RoundId))
   // console.log(RoundArry.map(a => a.TotalRoundBet))
   //console.log(RoundArry)

function DealerTop (){

  // default order: Net descending — rounds rendered Net-highest first
  let roundOrder = RoundArry.map(function(r, idx){ return idx; })
    .sort(function(a, b){ return RoundArry[b].TotalRoundNet - RoundArry[a].TotalRoundNet; });
  for(let k = 0; k < roundOrder.length; k++){
    x = roundOrder[k];
    RoundTop(x)
    let element = DealerArry.find(e => e.DealerName === RoundArry[x].DealerName);
if (element ) {
  element.RoundCount += 1;
}
  }

  // default order: Net descending
  DealerArry.sort(function(a, b){ return b.TotalNet - a.TotalNet; });
  TableArry.sort(function(a, b){ return b.TotalNet - a.TotalNet; });

  for(i = 0; i < DealerArry.length; i++){

    $(".DealerTop").append(`
    <tr>
      <td>` + DealerArry[i].DealerName + `</td>
      <td>` + fmtNum(aggBet(DealerArry[i])) + `</td>
      <td` + negClass(DealerArry[i].TotalNet) + `>` + fmtNum(aggNet(DealerArry[i])) + `</td>
      <td>`+ DealerArry[i].RoundCount +` </td>
      <td` + negClass(DealerArry[i].TotalNet) + `>`+ fmtNum(DealerArry[i].TotalBet > 0 ? DealerArry[i].TotalNet / DealerArry[i].TotalBet * 100 : 0) +` % </td>
      </tr>
      `
    )
  }

  // ---- per-table statistics (switchable with Dealer) ----
  for(let ti = 0; ti < TableArry.length; ti++){ TableArry[ti].RoundCount = 0; }
  for(let ri = 0; ri < RoundArry.length; ri++){ let tt = TableArry.find(e => e.TableName === RoundArry[ri].TableName); if(tt){ tt.RoundCount += 1; } }
  for(i = 0; i < TableArry.length; i++){
    $(".TableTop").append(`
    <tr>
      <td>` + TableArry[i].TableName + `</td>
      <td>` + fmtNum(aggBet(TableArry[i])) + `</td>
      <td` + negClass(TableArry[i].TotalNet) + `>` + fmtNum(aggNet(TableArry[i])) + `</td>
      <td>`+ TableArry[i].RoundCount +` </td>
      <td` + negClass(TableArry[i].TotalNet) + `>`+ fmtNum(TableArry[i].TotalBet > 0 ? TableArry[i].TotalNet / TableArry[i].TotalBet * 100 : 0) +` % </td>
      </tr>
      `
    )
  }

  // ---- per-game-type statistics ----
  let GameTypeArry = [];
  for(i = 0; i < RoundArry.length; i++){
    let g = RoundArry[i].GameType || 'Unknown';
    let el = GameTypeArry.find(e => e.GameType === g);
    if(!el){
      el = { GameType: g, TotalBet: 0, TotalNet: 0, RoundCount: 0 };
      GameTypeArry.push(el);
    }
    el.TotalBet += RoundArry[i].TotalRoundBet;
    el.NativeBet = (el.NativeBet || 0) + rBetM(RoundArry[i]);
    el.TotalNet += RoundArry[i].TotalRoundNet;
    el.NativeNet = (el.NativeNet || 0) + rNetM(RoundArry[i]);
    el.RoundCount += 1;
  }
  // default order: Net descending
  GameTypeArry.sort(function(a, b){ return b.TotalNet - a.TotalNet; });
  for(i = 0; i < GameTypeArry.length; i++){
    $(".GameTypeTop").append(`
    <tr>
      <td>` + GameTypeArry[i].GameType + `</td>
      <td>` + fmtNum(aggBet(GameTypeArry[i])) + `</td>
      <td` + negClass(GameTypeArry[i].TotalNet) + `>` + fmtNum(aggNet(GameTypeArry[i])) + `</td>
      <td>`+ GameTypeArry[i].RoundCount +` </td>
      <td` + negClass(GameTypeArry[i].TotalNet) + `>`+ fmtNum(GameTypeArry[i].TotalBet > 0 ? GameTypeArry[i].TotalNet / GameTypeArry[i].TotalBet * 100 : 0) +` % </td>
      </tr>
      `
    )
  }
}

function RoundTop(x){

  // hover hint: between which rounds the skip/break was (set by BreakCounter)
  let g = RoundArry[x].gapInfo;
  let gapTitle = '';
  if(g){
    gapTitle = ' title="' + g.prevRound + ' → ' + RoundArry[x].RoundId + ' · ' + fmtGap(g.gap) + ' · '
             + (g.type === 'sequential' ? 'sequential' : g.type + (g.est > 0 ? ' (~' + g.est + ' rounds missed)' : '')) + '"';
  }

  $(".RoundTop").append(`
  <tr` + gapTitle + `>
    <td>` + RoundArry[x].RoundId + `</td>
    <td>` + fmtNum(rBetM(RoundArry[x])) + `</td>
    <td` + negClass(RoundArry[x].TotalRoundNet) + `>` + fmtNum(rNetM(RoundArry[x])) + `</td>
    <td` + negClass(RoundArry[x].TotalRoundNet) + `>`+ fmtNum(RoundArry[x].TotalRoundBet > 0 ? RoundArry[x].TotalRoundNet / RoundArry[x].TotalRoundBet * 100 : 0) +` % </td>
    </tr>
    `
  )

}

DealerTop ()

// chronological order for the chart (and any per-round view): sort rounds by time
RoundArry.sort(function(a, b){
  let ta = parseRoundTime(a.RoundTime), tb = parseRoundTime(b.RoundTime);
  if(!ta && !tb){ return 0; }
  if(!ta){ return 1; }
  if(!tb){ return -1; }
  return ta.valueOf() - tb.valueOf();
});

// init AFTER all rows are appended (DealerTop fills Dealer/Table/Game/Round tables;
// any previous instances were already destroyed at the top of the refresh)
// order: [] keeps the pre-sorted (Net descending) DOM order on first paint;
// header arrows still sort on click as usual
$('.table-dealer').DataTable({order: [], autoWidth: false});
$('.table-table').DataTable({order: [], autoWidth: false});
$('.table-game').DataTable({order: [], autoWidth: false});
$('.table-roundTop').DataTable({order: [], autoWidth: false});
$('#table-table_wrapper, #table-game_wrapper').hide(); // inactive panes stay hidden with their controls


function BetPositionTop(){

  // one table filtered by the All / Main / Side switch, default order Net descending
  let rows = '';
  let tBet = 0, tNet = 0, tCnt = 0;

  let scope = BetPositionArry.filter(function(e){
    if(BetTypeFilter === 'main' && e.Category === 'Side Bet'){ return false; }
    if(BetTypeFilter === 'side' && e.Category !== 'Side Bet'){ return false; }
    return true;
  }).sort(function(a, b){ return b.TotalNet - a.TotalNet; });

  for(let i = 0; i < scope.length ; i++){
    let e = scope[i];
    rows += (`
      <tr>
                                          <td>` + e.BetPosition + `</td>
                                            <td>` + fmtNum(aggBet(e)) + `</td>
                                                <td` + negClass(e.TotalNet) + `>` + fmtNum(aggNet(e)) + `</td>
                                                <td` + negClass(e.TotalNet) + `>` + fmtNum(e.TotalBet > 0 ? e.TotalNet / e.TotalBet * 100 : 0) + ` % </td>
                                                <td>` + e.RoundCount + `</td>
                                                <td>` + e.Category + `</td>
                                            </tr>
    `);
    tBet += aggBet(e); tNet += aggNet(e); tCnt += e.RoundCount;
  }
  $(".BetPosTop").html(rows);

  // Grand totals follow the current filter
  let tMargin = tBet > 0 ? tNet / tBet * 100 : 0;
  $( '.table-bettop .foot-bet').text(fmtNum(tBet));
  $( '.table-bettop .foot-net').html(negWrap(tNet, fmtNum(tNet)));
  $( '.table-bettop .foot-margin').html(negWrap(tNet, fmtNum(tMargin) + ' %'));
  $( '.table-bettop .foot-count').text(tCnt);

  $( '.table-bettop').DataTable({order: [], autoWidth: false});
}


BetPositionTop()

// All / Main / Side bets switch (re-renders the single table in place)
$(document).off('click.btypeswitch', '.bet-switch').on('click.btypeswitch', '.bet-switch', function(){
  BetTypeFilter = $(this).data('btype') || 'all';
  $('.bet-switch').removeClass('active');
  $(this).addClass('active');
  if ($.fn.DataTable.isDataTable('.table-bettop')) { $('.table-bettop').DataTable().clear().destroy(); }
  BetPositionTop();
});

// ============================ KEY FINDINGS ============================

// ---- Roulette layout coverage helpers (Evolution-style position names;
// unknown/other providers' names map to [] and are simply not counted) ----
// Corner/street/split names come in range form (CORNER_1_TO_5 = {1,2,4,5})
// or explicit form (STREET_0_1_2); double zero (00) counts as pocket 0.
const ROULETTE_REDS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
function roulettePockets(gameType){ return /american/i.test(gameType || '') ? 38 : 37; }
function rouletteRedLine(gameType){ return roulettePockets(gameType) - 3; }
function rouletteRange(a, b){ let o = []; for(let n = a; n <= b; n++){ o.push(n); } return o; }
function rouletteColumn(c){ let o = []; for(let n = c; n <= 36; n += 3){ o.push(n); } return o; }
function rouletteNumbers(pos){
  let p = String(pos || '').toUpperCase().replace(/\s+/g, '_');
  if(p.indexOf('DOZEN_FIRST') === 0){ return rouletteRange(1, 12); }
  if(p.indexOf('DOZEN_SECOND') === 0){ return rouletteRange(13, 24); }
  if(p.indexOf('DOZEN_THIRD') === 0){ return rouletteRange(25, 36); }
  if(p.indexOf('COLUMN_FIRST') === 0){ return rouletteColumn(1); }
  if(p.indexOf('COLUMN_SECOND') === 0){ return rouletteColumn(2); }
  if(p.indexOf('COLUMN_THIRD') === 0){ return rouletteColumn(3); }
  if(p === 'RED'){ return ROULETTE_REDS.slice(); }
  if(p === 'BLACK'){ return rouletteRange(1, 36).filter(function(n){ return ROULETTE_REDS.indexOf(n) === -1; }); }
  if(p === 'EVEN'){ return rouletteRange(1, 18).map(function(n){ return n * 2; }); }
  if(p === 'ODD'){ return rouletteRange(1, 18).map(function(n){ return n * 2 - 1; }); }
  if(p === 'LOW' || p === '1_18'){ return rouletteRange(1, 18); }
  if(p === 'HIGH' || p === '19_36'){ return rouletteRange(19, 36); }
  let nums = p.match(/\d+/g);
  if(!nums){ return []; }
  nums = nums.map(Number);
  if(p.indexOf('CORNER_') === 0 && nums.length === 2){
    let a = nums[0], b = nums[1];
    return [a, a + 1, b - 1, b];
  }
  if((p.indexOf('STREET_') === 0 || p.indexOf('SIX_LINE_') === 0) && nums.length === 2){
    let o = [], a = nums[0], b = nums[1];
    for(let n = a; n <= b; n++){ o.push(n); }
    return o;
  }
  if(p.indexOf('LINE_') === 0 && nums.length === 1){ let r = nums[0]; return rouletteRange(3 * r - 2, 3 * r + 3); }
  return nums.filter(function(n){ return n >= 0 && n <= 36; }); // straight / split / corner / basket / explicit street
}
function rouletteCoveredCount(posObj){
  let seen = {};
  for(let k in posObj){
    let arr = rouletteNumbers(k);
    for(let i = 0; i < arr.length; i++){ seen[arr[i]] = true; }
  }
  return Object.keys(seen).length;
}
// Auto-generated analytical bullet points aligned with the Risk Analyst
// Manual (Roulette Monitoring checklist, Betting Progressions, Dealer
// Report guidelines). Levels: danger (red flag) > warning (needs
// attention) > info / success (normal behaviour).

function generateFindings(){

  let $list = $('#findings-card .findings-list');
  if(!$list.length){ return; } // panel is not present (e.g. index2.html)
  $list.empty();

  let findings = [];
  let rounds   = RoundArry.length;
  let decided  = WinRoundCnt + LossRoundCnt; // rounds without ties
  let effWin   = decided > 0 ? WinRoundCnt / decided * 100 : 0;
  let mTotalBet  = modeNative() ? NativeTotalBet : TotalBet;
  let mTotalNet  = modeNative() ? NativeTotalNet : TotalNet;
  let avgBet   = rounds  > 0 ? mTotalBet / rounds : 0;
  let maxRound = null;

  // ---- roulette layout coverage (computed early: it explains a high win rate) ----
  // a round that covers most of the wheel wins almost regardless of the ball, so
  // a high win rate of such a player is a consequence of coverage, not of an edge
  let domGame = dominantGameType(RoundArry);   // game the session is mostly about
  let coverStats = {total:0, max:0, maxRound:null, maxPockets:37, heavy:0, heavyMin:28, redLine:0};
  for(let i = 0; i < rounds; i++){
    const r = RoundArry[i];
    if(!r || !/roulette/i.test(r.GameType || '')){ continue; }
    const pockets = roulettePockets(r.GameType);
    const cov = rouletteCoveredCount(r.Positions);
    coverStats.total++;
    if(cov > coverStats.max){ coverStats.max = cov; coverStats.maxRound = r; coverStats.maxPockets = pockets; }
    if(cov >= coverStats.heavyMin){ coverStats.heavy++; }
    if(cov >= rouletteRedLine(r.GameType)){ coverStats.redLine++; }
  }

  for(let i = 0; i < rounds; i++){
    if(maxRound === null || rBetM(RoundArry[i]) > rBetM(maxRound)){
      maxRound = RoundArry[i];
    }
  }

  function eur(v){
    return moneySym() + fmtNum(Math.abs(v));
  }
  function pct(part, total){
    return total > 0 ? part / total * 100 : 0;
  }
  function add(level, text){ findings.push({level: level, text: text}); }

  // ---- 1. Win rate vs theoretical expectation ----
  if(decided >= 20){
    if(effWin >= 55){
      if(coverStats.heavy >= 2){
        // the win rate is mechanical: the player covers most of the wheel
        add('warning', '<b>High win rate explained by systematic coverage:</b> ' + coverStats.heavy + ' of ' + rounds +
            ' round(s) cover ' + coverStats.heavyMin + '+ of ' + coverStats.maxPockets +
            ' pockets — the outcome is near-guaranteed by construction, not an advantage-play signal (win rate ' +
            fmtNum(effWin, 1) + '%, expected ~48-49%).');
      }else{
        add('danger', '<b>Abnormally high win rate:</b> ' + fmtNum(effWin, 1) + '% (' + WinRoundCnt +
            ' wins in ' + decided + ' decided rounds), expected is ~48-49%.');
      }
    }else if(effWin <= 42){
      add('success', 'Win rate ' + fmtNum(effWin, 1) + '% is below expectation — no advantage play signs.');
    }else{
      add('success', 'Win rate ' + fmtNum(effWin, 1) + '% is within the expected range.');
    }
  }

  // ---- 2. Session result: profit alone is routine — flag it only from €50k ----
  if(TotalNet >= 50000){
    let lvl = (effWin >= 55 && decided >= 20) ? 'danger' : 'warning';
    add(lvl, '<b>Player finished in profit:</b> +' + eur(mTotalNet) + ' (margin +' + fmtNum(Margin) + '%).');
  }

  // ---- 2b. Profit concentration: top-3 wins share of gross winnings (luck vs edge) ----
  (function(){
    let gw = [];
    for(let i = 0; i < rounds; i++){ if(RoundArry[i].TotalRoundNet > 0){ gw.push(RoundArry[i].TotalRoundNet); } }
    if(gw.length < 3){ return; }
    gw.sort(function(a, b){ return b - a; });
    let gsum = 0;
    for(let i = 0; i < gw.length; i++){ gsum += gw[i]; }
    let t3 = gw[0] + gw[1] + gw[2];
    let sh = gsum > 0 ? t3 / gsum * 100 : 0;
    if(sh >= 50){
      add('info', '<b>Profit concentrated in a few rounds:</b> top 3 wins (' + eur(t3) + ') make ' +
          fmtNum(sh, 0) + '% of all winnings — result depends on isolated rounds, not a stable edge.');
    }
  })();

  // ---- 3. Betting strategy (manual §5.5: Flat / Negative & Martingale are
  //         normal; erratic play and Bet Ramps are red flags) ----
  // Note: chaotic is session-level (both staking systems mixed), not a transition bucket.
  let samePct   = pct(same, rounds);
  let negPct    = pct(negativ + martingeil, rounds);
  let upPct     = pct(up, rounds);

  if(rounds >= 5 && maxRound && avgBet > 0 && rBetM(maxRound) >= 3 * avgBet){
    add('warning', '<b>Bet ramp:</b> sudden sharp bet increase up to ' + eur(rBetM(maxRound)) +
        ' (' + fmtNum(rBetM(maxRound) / avgBet, 1) + '× the average, round ' + maxRound.RoundId +
        ') — may indicate advantage play.');
  }
  // erratic = both systems strongly present with no clear dominance
  // (a 56/24 martingale-style split is dominance, not chaos)
  // raise after loss AND raise after win dominating together is not chaos —
  // it is an escalation ladder: stakes climb regardless of the outcome
  let raiseDominant = rounds > 0 && betRaise / rounds >= 0.6;
  if(rounds >= 15 && negPct >= 25 && upPct >= 25 && Math.abs(negPct - upPct) < 25 && !raiseDominant){
    if(isLowPositionGame(domGame)){
      // card games have only a few positions: mixing sides and stake sizes is
      // normal play, and the bot check covers the scripting question separately
      add('info', 'Erratic bet sizing: negative pattern in ' + fmtNum(negPct, 0) +
          '% and positive pattern in ' + fmtNum(upPct, 0) + '% of rounds — in ' + domGame.toLowerCase() +
          ' the player mixes sides and stake sizes, which is normal play; noted for the report.');
    }else{
      add('warning', '<b>Erratic strategy:</b> no consistent staking system — negative pattern in ' + fmtNum(negPct, 0) +
          '% and positive pattern in ' + fmtNum(upPct, 0) + '% of rounds — could indicate testing, scripting or manipulation.');
    }
  }

  // ---- 3b. Win / loss streaks (tilt vs system; ties skipped like in effWin) ----
  (function(){
    let seq = [];
    for(let i = 0; i < rounds; i++){
      if(RoundArry[i].TotalRoundNet !== 0){ seq.push({net: RoundArry[i].TotalRoundNet, bet: RoundArry[i].TotalRoundBet}); }
    }
    function longest(wantWin){
      let best = {len: 0, avg: 0};
      let curLen = 0, curSum = 0, curN = 0, prevBet = 0;
      function flush(){
        if(curLen > best.len){ best.len = curLen; best.avg = curN > 0 ? curSum / curN : 0; }
      }
      for(let i = 0; i < seq.length; i++){
        let hit = wantWin ? seq[i].net > 0 : seq[i].net < 0;
        if(hit){
          if(curLen > 0 && prevBet > 0){ curSum += seq[i].bet / prevBet; curN++; }
          curLen++;
          prevBet = seq[i].bet;
        }else{ flush(); curLen = 0; curSum = 0; curN = 0; prevBet = 0; }
      }
      flush();
      return best;
    }
    let ls = longest(false), ws = longest(true);
    if(ls.len >= 4){
      let tilt = ls.avg >= 1.5;
      // A losing streak is not a risk for the operator — the session is at a loss.
      // It is a behaviour note (tilt / chasing losses) for AML and responsible-gaming
      // monitoring, so it stays an info note and does not land in "needs attention".
      add('info',
          '<b>Max loss streak: ' + ls.len + ' rounds</b>' +
          (ls.avg > 0 ? ' (avg raise ' + fmtNum(ls.avg, 1) + '× per step)' : '') +
          (tilt ? ' — player escalates stakes after losses (tilt): note for AML and responsible-gaming monitoring, not a fraud risk — the session is at a loss.'
                 : ' — stakes kept flat while losing, disciplined chasing.'));
    }
    if(ws.len >= 5){
      add('info', '<b>Max win streak: ' + ws.len + ' rounds</b>' +
          (ws.avg > 0 ? ' (avg raise ' + fmtNum(ws.avg, 1) + '× per step)' : '') + '.');
    }
  })();
  if(samePct >= 70){
    add('success', 'Flat betting throughout the session — consistent with normal play.');
  }
  if(negPct >= 30){
    if(martingeil >= 1){
      add('info', 'Martingale betting system (5+ consecutive doublings after losses): ' + martingeil +
          ' chain(s) detected, negative pattern in ' + fmtNum(negPct, 0) + '% of rounds.');
    }else{
      add('info', 'Negative progression (raises stakes after losses) in ' + fmtNum(negPct, 0) +
          '% of rounds — no martingale chain (5+ doublings), acceptable for ' + domGame.toLowerCase() + ' if other indicators are clean.');
    }
  }
  if(upPct >= 50){
    add('info', 'Positive progression (raises after wins) in ' + fmtNum(upPct, 0) + '% of rounds.');
  }

  // ---- 4. Round skipping (manual: "frequently skips game rounds, possibly
  //         waiting for favorable conditions") ----
  // Skip share is based on ESTIMATED skipped game rounds, not only gap count.
  let skipShare = (RoundSkipp > 0) ? EstSkippedRounds / (rounds + EstSkippedRounds) * 100 : 0;
  if(skipShare >= 30){
    add('danger', '<b>Frequently skips game rounds:</b> est. ' + EstSkippedRounds + ' round(s) skipped in ' +
        RoundSkipp + ' gap(s) (' + fmtNum(skipShare, 0) + '%) — possibly waiting for favorable conditions.');
  }else if(skipShare >= 15){
    add('warning', 'Player skips rounds: est. ' + EstSkippedRounds + ' round(s) skipped (' + fmtNum(skipShare, 0) + '% of the session).');
  }

  // ---- 5. Fragmented session (manual: "playing in short bursts with breaks
  //         between — may suggest strategic timing") ----
  let breaks = ShortBreak + LongBreak;
  if(breaks >= 3 && rounds < 30){
    add('warning', 'Session played in short bursts: ' + breaks + ' break(s) over ' + rounds +
        ' rounds — may suggest strategic timing.');
  }

  // ---- 7. Dealer analysis (manual: Dealer Report guidelines) ----
  if(rounds >= 15 && DealerArry.length > 1){
    // 7a. Wins concentrated on a single dealer while losing with others
    let topNet = DealerArry[0];
    for(let i = 1; i < DealerArry.length; i++){
      if(DealerArry[i].TotalNet > topNet.TotalNet){ topNet = DealerArry[i]; }
    }
    let othersLosing = 0;
    for(let i = 0; i < DealerArry.length; i++){
      if(DealerArry[i].DealerName !== topNet.DealerName && DealerArry[i].TotalNet < 0){ othersLosing++; }
    }
    if(topNet.TotalNet > 0 && othersLosing >= DealerArry.length - 1 && DealerArry.length >= 3){
      add(effWin >= 55 ? 'danger' : 'warning',
          '<b>Dealer pattern:</b> player profits only with dealer ' + topNet.DealerName + ' (+' + eur(aggNet(topNet)) +
          '), losing with all other dealers — prioritize video review (possible predictability or collusion).');
    }
    // 7b. Single dealer coverage with profit
    let topCnt = DealerArry[0];
    for(let i = 1; i < DealerArry.length; i++){
      if(DealerArry[i].RoundCount > topCnt.RoundCount){ topCnt = DealerArry[i]; }
    }
    let share = pct(topCnt.RoundCount, rounds);
    if(share >= 50 && topCnt.TotalNet > 0 && DealerArry.length < 3){
      add('warning', '<b>Dealer concentration:</b> ' + fmtNum(share, 0) + '% of rounds with dealer ' +
          topCnt.DealerName + ', player net +' + eur(aggNet(topCnt)) + ' with them.');
    }
    // 7c. Frequent dealer switching (manual: "plays only 1-2 hands per dealer")
    if(rounds / DealerArry.length <= 2.5 && DealerArry.length >= 6){
      add('warning', '<b>Frequent dealer switching:</b> ' + DealerArry.length + ' dealers over ' + rounds +
          ' rounds (~' + fmtNum(rounds / DealerArry.length, 1) + ' rounds each) — possible detection avoidance.');
    }
    // 7d. Sharp margin swings between dealers (manual: "+100% to -150%")
    let dMin = null, dMax = null;
    for(let i = 0; i < DealerArry.length; i++){
      let d = DealerArry[i];
      if(d.RoundCount < 3 || d.TotalBet < 500){ continue; }
      let m = d.TotalNet / d.TotalBet * 100;
      if(dMin === null || m < dMin.m){ dMin = {d: d, m: m}; }
      if(dMax === null || m > dMax.m){ dMax = {d: d, m: m}; }
    }
    if(dMin && dMax && dMax.m - dMin.m > 150){
      add('warning', '<b>Sharp margin swings between dealers:</b> ' + dMax.d.DealerName + ' (+' + fmtNum(dMax.m, 0) +
          '%) vs ' + dMin.d.DealerName + ' (' + fmtNum(dMin.m, 0) + '%) — statistical outlier per Dealer Report criteria.');
    }
  }

  // ---- 8. Sample size ----
  if(rounds < 15){
    add('info', 'Small sample: only ' + rounds + ' round(s) — conclusions are unreliable.');
  }

  // ---- 8b. Unreadable timestamps (break pattern skips such rounds silently) ----
  if(UnparsedTimeCount > 0){
    if(UnparsedTimeCount >= rounds){
      add('warning', '<b>Timestamps unreadable in all ' + rounds + ' round(s)</b> (expected DD/MM/YYYY) — break pattern, bet continuity and chronological order are unreliable.');
    }else{
      add('info', 'Timestamps unreadable in ' + UnparsedTimeCount + ' of ' + rounds + ' round(s) — break pattern covers only the rest.');
    }
  }

  // ---- 9. Roulette layout coverage (low-risk / bonus-abuse play) ----
  // counts distinct pockets covered by one round's positions
  if(coverStats.redLine > 0){
    add(coverStats.redLine >= 3 ? 'danger' : 'warning',
        '<b>Low-risk roulette coverage:</b> ' + coverStats.redLine + ' round(s) cover ' + (coverStats.maxPockets - 3) +
        '+ of ' + coverStats.maxPockets + ' pockets (max ' + coverStats.max + '/' + coverStats.maxPockets + ' in round ' +
        coverStats.maxRound.RoundId + ') — near-guaranteed outcome, typical bonus-abuse pattern.');
  }

  // ---- Bot / automation verdict (set by analyzeBot, runs before) ----
  if(typeof BotFinding !== 'undefined' && BotFinding){ add(BotFinding.level, BotFinding.text); }

  // ---- Summary bullet (always first) ----
  // header counts real issues only — the summary bullet itself is not counted
  let attCnt = 0, noteCnt = 0;
  for(let i = 0; i < findings.length; i++){
    if(findings[i].level === 'danger' || findings[i].level === 'warning'){ attCnt++; }
    else{ noteCnt++; }
  }
  let dangerCnt = findings.filter(f => f.level === 'danger').length;
  let warnCnt   = findings.filter(f => f.level === 'warning').length;
  // NOTE: no "No direct fraud indicators, but N point(s)..." bullet — it only
  // echoes the header counter. Danger and all-clear verdicts stay (they instruct).
  if(dangerCnt > 0){
    findings.unshift({level: 'danger', text: '<b>' + dangerCnt + ' red flag(s) detected</b> — manual review recommended: check game logs, CCTV and dealer footage per Incident Response flow.'});
  }else if(warnCnt === 0){
    findings.unshift({level: 'success', text: 'No unusual patterns detected in this session — gameplay corresponds to normal indicators from the monitoring checklist.'});
  }

  // ---- Render: danger > warning > info > success ----
  let weight = {danger: 0, warning: 1, info: 2, success: 3};
  let icons  = {danger: 'bi-exclamation-octagon-fill', warning: 'bi-exclamation-triangle-fill',
                info: 'bi-info-circle-fill', success: 'bi-check-circle-fill'};

  findings.sort(function(a, b){ return weight[a.level] - weight[b.level]; });

  for(let i = 0; i < findings.length; i++){
    $list.append('<li class="finding-' + findings[i].level + '">' +
                 '<i class="bi ' + icons[findings[i].level] + '"></i>' +
                 '<span>' + findings[i].text + '</span></li>');
  }

  // ---- Collapsible panel: summary counts in the header, list collapsed by default ----
  let sumTxt = '';
  if(attCnt > 0){ sumTxt += attCnt + ' need attention'; }
  if(noteCnt > 0){ sumTxt += (sumTxt ? ' · ' : '') + noteCnt + ' note' + (noteCnt === 1 ? '' : 's'); }
  if(!sumTxt){ sumTxt = 'no findings'; }
  $('#findings-summary').text(sumTxt);
  $('#findings-card').addClass('collapsed');
  $('#findings-toggle i').attr('class', 'bi bi-chevron-down');
}

$(document).off('click.findings', '.findings-head').on('click.findings', '.findings-head', function(){
  let $card = $('#findings-card');
  $card.toggleClass('collapsed');
  let collapsed = $card.hasClass('collapsed');
  $('#findings-toggle i').attr('class', collapsed ? 'bi bi-chevron-down' : 'bi bi-chevron-up');
});

let BotFinding = null; // set by analyzeBot(): {level, text} for the Key findings bullet
analyzeBot();
generateFindings();

// ---- switchable statistics table (Dealer / Table / Game type) ----
$(document).off('click.dim', '.dim-switch').on('click.dim', '.dim-switch', function(){
  let dim = $(this).data('dim');
  $('.dim-switch').removeClass('active');
  $(this).addClass('active');
  $('.dim-table').hide();
  $('#table-dealer_wrapper, #table-table_wrapper, #table-game_wrapper').hide();
  $('.dim-table[data-dim="' + dim + '"]').show();
  $('#table-' + dim + '_wrapper').show();
  $('#dim-stat-title').text(dim === 'dealer' ? 'Dealer statistics' : (dim === 'table' ? 'Table statistics' : 'Game type statistics'));
  try{ $(".dim-table[data-dim='" + dim + "']").DataTable().columns.adjust(); }catch(e){}
});

// ========================= BOT / AUTOMATION CHECK =========================
// Scripted-play signals for the CURRENT player, computed from the helper's
// own round data (no extra worksheet). Mirrors the ROBOT project logic:
// volume, bet-type entropy, stake variance, cadence, breaks.

function analyzeBot(){

  // pure computation: the result goes into Key findings via BotFinding (no own card)

  let rounds = RoundArry.length;

  // ---- 1. Bet type entropy (distinct positions per round, weighted) ----
  let entropy = 0, distinctTypes = 0;
  if(rounds > 0 && BetPositionArry.length > 0){
    let total = 0;
    for(let i = 0; i < BetPositionArry.length; i++){ total += BetPositionArry[i].RoundCount; }
    distinctTypes = BetPositionArry.length;
    if(total > 0){
      for(let i = 0; i < BetPositionArry.length; i++){
        let p = BetPositionArry[i].RoundCount / total;
        if(p > 0){ entropy -= p * Math.log2(p); }
      }
    }
  }

  // ---- 2. Stake variance (max bet / average bet, on the BASE hand stake —
  //         blackjack double/split actions would fake a 2x spike) ----
  let avgBet = 0, maxBet = 0;
  if(rounds > 0){ avgBet = TotalBet / rounds; }
  for(let i = 0; i < rounds; i++){
    let b = RoundArry[i].BaseBet > 0 ? RoundArry[i].BaseBet : RoundArry[i].TotalRoundBet;
    if(b > maxBet){ maxBet = b; }
  }
  let betVar = avgBet > 0 ? maxBet / avgBet : 0;

  // ---- 3. Median cadence between played rounds ----
  let sortedT = RoundArry.slice().map(function(r){ return parseRoundTime(r.RoundTime); })
                         .filter(function(t){ return t !== null; })
                         .sort(function(a, b){ return a.valueOf() - b.valueOf(); });
  let gaps = [];
  for(let i = 1; i < sortedT.length; i++){ gaps.push(sortedT[i].diff(sortedT[i-1], 'minutes', true)); }
  gaps.sort(function(a, b){ return a - b; });
  let cadence = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : 0;

  // ---- 4. Breaks ----
  let breakCnt = ShortBreak + LongBreak;

  // ---- signals ----
  let sig = 0;
  let notes = [];
  // game-aware baselines: baccarat has 2 sides, so "few repeating bets" is normal
  // there; and a fast table is fast for everyone, not only for bots.
  // The client's own pace wins over the per-game default table — every client
  // runs its tables at its own speed. The pace is either typed by the analyst
  // in the "pace" field or the built-in default of the client (mac88 / RG run
  // a round about every 1.5 min).
  let botGame = dominantGameType(RoundArry);
  let lowPosGame = isLowPositionGame(botGame);
  let base = botPaceBaseline(botGame);
  let useClientPace = base.useClientPace;
  let gameTypicalMin = base.min;
  let paceSource = base.source;

  if(rounds > 500){ sig++; notes.push('very long session: ' + rounds + ' rounds (> 500) — bots play long, flat sessions without tiring'); }
  if(entropy < 2.5 && distinctTypes > 0 && !lowPosGame){ sig++; notes.push('few repeating bets: only ' + distinctTypes + ' bet type(s) used (' + fmtNum(entropy) + ' bits) — bots stick to the same pattern'); }
  // scripted play keeps the stake almost fixed; a human spreads it out
  if(betVar < 1.5 && avgBet > 0){ sig++; notes.push('stake almost never changes: max bet is only ' + (betVar > 0 ? fmtNum(betVar, 1) : '0') + '× the average'); }
  // very fast, steady cadence — but only if it is fast for THAT game / client
  // (baccarat tables run ~32 s, roulette ~40 s; 25 s on baccarat is normal)
  let tooFast = useClientPace
    ? (cadence > 0 && cadence < gameTypicalMin * 0.7)                       // client pace replaces the absolute gate
    : (cadence > 0 && cadence < 0.5 && cadence < gameTypicalMin * 0.7);
  if(tooFast){
    sig++;
    notes.push('plays very fast: median ' + fmtNum(cadence * 60, 0) + ' s between rounds (normal for ' +
               paceSource + ' is ~' + fmtNum(gameTypicalMin * 60, 0) + ' s) — bots do not hesitate');
  }
  if(rounds > 300 && breakCnt <= 1){ sig++; notes.push('at most one break in ' + rounds + ' rounds — a human usually pauses'); }

  let verdict, lvl;
  if(sig >= 3){ verdict = 'Yes'; lvl = 'danger'; }
  else if(sig == 2){ verdict = 'Suspicious'; lvl = 'warning'; }
  else{ verdict = 'No'; lvl = 'success'; }

  // shared with Key findings: always a Yes / Suspicious / No line
  if(verdict === 'No'){ BotFinding = {level: 'success', text: '<b>Bot / automation: No.</b> ' + (notes.length ? 'Not a bot, but note: ' + notes.join('; ') + '.' : 'No signs of scripted play.')}; }
  else{ BotFinding = {level: lvl, text: '<b>Bot / automation (' + verdict.toLowerCase() + '):</b> ' + notes.join('; ') + '.'}; }
}


// ========================= END BOT / AUTOMATION CHECK =========================

// ========================= END KEY FINDINGS =========================

// ==================== WINNER REPORT SUGGESTIONS =====================
// Picks the exact dropdown options from the Winner Report form and
// computes the numeric report fields, so the analyst can copy them 1:1.

let lastWinnerAnswers = [];
// (global game scope lives in DashGameFilter; RoundArry is pre-filtered)

function computeWinnerAnswers(){

  let rounds  = RoundArry.length;
  let answers = [];
  lastWinnerAnswers = answers;

  let p = function(v){ return rounds > 0 ? v / rounds * 100 : 0; };
  function eur(v){
    return moneySym() + fmtNum(Math.abs(v));
  }

  // ---------- Betting progression (exact report options) ----------
  // Per-transition buckets: flat (±2%) / negative pattern (raise after loss,
  // lower after win) / positive pattern (raise after win, lower after loss).
  // Chaotic is a session-level verdict — both systems mixed with no dominance —
  // never a catch-all transition bucket.
  let samePct  = p(same);
  let negPct   = p(negativ);
  let upPct2   = p(up);

  // erratic = same rule as the Key findings bullet: both systems present, no
  // dominance (so the card label and the finding never contradict each other)
  let decidedD = (typeof WinRoundCnt !== 'undefined' && (WinRoundCnt + LossRoundCnt) > 0) ? (WinRoundCnt + LossRoundCnt) : rounds;
  let negPctD = decidedD > 0 ? negativ / decidedD * 100 : 0;
  let upPctD  = decidedD > 0 ? up / decidedD * 100 : 0;
  let raisePctD = decidedD > 0 ? betRaise / decidedD * 100 : 0;
  // stakes raised after a loss AND after a win both dominate → the ladder
  // climbs regardless of the outcome: progressive betting, not chaotic
  let raiseDominant = raisePctD >= 60 && negPctD < 70 && upPctD < 70;
  let erratic = rounds >= 15 && negPctD >= 25 && upPctD >= 25 && Math.abs(negPctD - upPctD) < 25 && !raiseDominant;

  let prog;
  if(rounds <= 1){ prog = 'Other one'; }
  else if(martingeil >= 1 && negPct >= 50){ prog = 'Martingale betting system'; }
  else if(samePct >= 70){ prog = 'Flat wagers'; }
  else if(raiseDominant){ prog = 'Progressive betting'; }
  else if(erratic){ prog = 'Chaotic wagers, regardless to previous game outcome'; }
  else if(negPct >= 70){ prog = 'Negative progression'; }
  else if(negPct >= 50){ prog = 'Mainly negative betting progression'; }
  else if(upPct2 >= 85){ prog = 'Positive progression'; }
  else if(upPct2 >= 60){ prog = 'Progressive betting'; }
  else if(samePct >= 50){ prog = 'Mainly flat wagers'; }
  else if(negPct >= 20 && upPct2 >= 20 && samePct >= 25){ prog = 'Chaotic, however at some passages flat wagers'; }
  else if(negPct >= 20 && upPct2 >= 20 && negPct > upPct2){ prog = 'Chaotic, at some passages negative progression is selected'; }
  else if(negPct >= 20 && upPct2 >= 20){ prog = 'Chaotic wagers, regardless to previous game outcome'; }
  else if(negPct >= 30 && samePct >= 20 && negPct >= samePct){ prog = 'Negative progression, however at some passages flat'; }
  else if(upPct2 >= 30 && samePct >= 20 && upPct2 > samePct){ prog = 'Progressive betting'; }
  else if(samePct >= negPct && samePct >= upPct2){ prog = 'Mainly flat wagers'; }
  else if(negPct >= upPct2){ prog = 'Mainly negative betting progression'; }
  else{ prog = 'Progressive betting'; }

  // NOTE: no "Ramping (Card counter)" override — a late bet spike alone is not enough
  // evidence for card counting; the percentage-based label below applies instead.
  // Sharp spikes are still flagged separately in Key findings ("Bet ramp" warning).
  let progWhy;
  if(rounds <= 1){ progWhy = 'only 1 round in the session'; }
  else{
    progWhy = 'flat ' + fmtNum(samePct, 0) + '% · negative ' + fmtNum(negPct, 0) + '% · positive ' + fmtNum(upPct2, 0) + '% of ' + rounds + ' rounds' +
      (martingeil >= 1 ? ' · ' + martingeil + ' martingale chain(s) of 5+ doublings' : '');
  }
  answers.push({group: 'Report dropdowns', field: 'Betting progression', value: prog, why: progWhy});

  // ---------- Bet continuity (exact report options) ----------
  // A skip counts as a skip — one gap = one skip, however many rounds the gap
  // hides (the est. missed count is secondary info, shown in the why-line/tooltip)
  let skipShare = (RoundSkipp > 0) ? RoundSkipp / rounds * 100 : 0;
  let cont;
  if(rounds == 1){ cont = 'Only one game round held'; }
  else if(rounds <= 4){ cont = 'Held only few game rounds'; }
  else if(rounds <= 10){ cont = RoundSkipp == 0 ? 'Short session, without skipping game rounds' : 'Short session, not many games in a row'; }
  else if(skipShare == 0){ cont = rounds >= 30 ? 'Plays many rounds in a row without skipping rounds' : 'Does not skip game rounds'; }
  else if(RoundSkipp == 1){ cont = 'Mainly sequential games, one skip during the session'; }
  else if(skipShare <= 5){ cont = 'Mainly sequential games, occasional skips'; }
  else if(skipShare <= 15){ cont = 'Sequential games, however at some passages skips rounds'; }
  else if(skipShare <= 40){ cont = 'Skips rounds time to time'; }
  else{ cont = 'Often skips rounds'; }
  let contWhy;
  if(rounds == 1){ contWhy = 'only 1 round in the session'; }
  else if(RoundSkipp == 0){ contWhy = rounds + ' played rounds, no skip gaps (' + currentBreakRules().SKIP_MIN + '–' + currentBreakRules().SKIP_MAX + ' min)'; }
  else{ contWhy = RoundSkipp + ' skip gap(s) of ' + rounds + ' played rounds (' + fmtNum(skipShare, 0) + '%)' +
        (EstSkippedRounds > 0 ? ' · est. ~' + EstSkippedRounds + ' rounds missed' : ''); }
  answers.push({group: 'Report dropdowns', field: 'Bet continuity', value: cont, why: contWhy});

  // ---------- Breaks during analysis (exact report options) ----------
  let S = ShortBreak, L = LongBreak, T = S + L;
  let br;
  if(rounds == 1){ br = 'Only one game round held'; }
  else if(T == 0){ br = 'No breaks during the session'; }
  else if(T == 1){ br = L == 1 ? 'One long break' : 'One short break'; }
  else if(T == 2){ br = L == 2 ? 'Two long breaks' : (S == 2 ? 'Two short breaks' : 'One short and one long break'); }
  else if(L == 0 && S <= 5){ br = 'Several short breaks'; }
  else if(S == 0 && L <= 5){ br = 'Several long breaks'; }
  else if(L > 0 && S > 0 && T <= 7){ br = 'Several long and short breaks'; }
  else if(L == 0){ br = 'Many short breaks'; }
  else if(S == 0){ br = 'Many long breaks'; }
  else{ br = 'Many long and short breaks'; }
  let brWhy;
  if(rounds == 1){ brWhy = 'only 1 round in the session'; }
  else if(T == 0){ brWhy = 'no gaps ≥ 10 min between played rounds'; }
  else{ brWhy = S + ' short (10–30 min) + ' + L + ' long (> 30 min) = ' + T + ' break(s)'; }
  answers.push({group: 'Report dropdowns', field: 'Breaks during analysis', value: br, why: brWhy});

  // ---------- Wager statistics (RoundArry already follows the global game scope) ----------
  // This block mirrors the Winner report. When the session has one consistent
  // native currency (≠ EUR) with native BET/NET columns in the sheet, values are
  // shown in that native currency; everything else on the dashboard stays in EUR.
  let useNative = modeNative();
  let repCur = useNative ? currencyLabel(SessionNative) : '€';
  function repEur(v){ return String(repCur).trim() + ' ' + fmtNum(Math.abs(v)); }
  function rBet(e){ return (useNative && e.NativeBet !== undefined) ? e.NativeBet : e.TotalRoundBet; }
  function rNet(e){ return (useNative && e.NativeNet !== undefined) ? e.NativeNet : e.TotalRoundNet; }
  let scope = RoundArry;
  let sRounds = scope.length;
  let sTotalBet = 0, sTotalNet = 0, sWin = 0, sLoss = 0, sTie = 0;
  for(let si = 0; si < sRounds; si++){
    sTotalBet += rBet(scope[si]);
    sTotalNet += rNet(scope[si]);
    if(rNet(scope[si]) > 0){ sWin++; }
    else if(rNet(scope[si]) < 0){ sLoss++; }
    else{ sTie++; }
  }
  let sAvgBet = sRounds > 0 ? sTotalBet / sRounds : 0;

  let maxWager = 0, minWager = null;
  let winNets = [];
  for(let i = 0; i < sRounds; i++){
    let b = rBet(scope[i]);
    if(b > maxWager){ maxWager = b; }
    if(minWager === null || b < minWager){ minWager = b; }
    if(rNet(scope[i]) > 0){ winNets.push(rNet(scope[i])); }
  }
  if(minWager === null){ minWager = 0; }

  // "In how many rounds" column of the report
  let maxWagerRounds = 0, minWagerRounds = 0;
  for(let i = 0; i < sRounds; i++){
    if(rBet(scope[i]) === maxWager){ maxWagerRounds++; }
    if(rBet(scope[i]) === minWager){ minWagerRounds++; }
  }

  answers.push({group: 'Wager statistics', field: 'Maximum round wager', value: repEur(maxWager), note: 'in ' + maxWagerRounds + (maxWagerRounds === 1 ? ' round' : ' rounds')});
  answers.push({group: 'Wager statistics', field: 'Minimum round wager', value: repEur(minWager), note: 'in ' + minWagerRounds + (minWagerRounds === 1 ? ' round' : ' rounds')});
  answers.push({group: 'Wager statistics', field: 'Average round wager', value: repEur(sAvgBet)});

  // ---------- Winning statistics ----------
  let maxW = 0, minW = null, sumW = 0;
  for(let i = 0; i < winNets.length; i++){
    if(winNets[i] > maxW){ maxW = winNets[i]; }
    if(minW === null || winNets[i] < minW){ minW = winNets[i]; }
    sumW += winNets[i];
  }
  if(minW === null){ minW = 0; }

  // profit concentration: top-3 wins share of gross winnings (luck vs edge)
  let top3sum = 0, top3share = 0;
  if(winNets.length > 0){
    let sw = winNets.slice().sort(function(a, b){ return b - a; });
    for(let wi = 0; wi < Math.min(3, sw.length); wi++){ top3sum += sw[wi]; }
    top3share = sumW > 0 ? top3sum / sumW * 100 : 0;
  }

  let maxWCount = 0, minWCount = 0;
  for(let i = 0; i < winNets.length; i++){
    if(winNets[i] === maxW){ maxWCount++; }
    if(winNets[i] === minW){ minWCount++; }
  }

  answers.push({group: 'Winning statistics', field: 'Maximum round winning', value: repEur(maxW), note: 'in ' + maxWCount + (maxWCount === 1 ? ' round' : ' rounds')});
  answers.push({group: 'Winning statistics', field: 'Minimum round winning', value: repEur(minW), note: 'in ' + minWCount + (minWCount === 1 ? ' round' : ' rounds')});
  answers.push({group: 'Winning statistics', field: 'Average round winning', value: repEur(winNets.length > 0 ? sumW / winNets.length : 0)});
  answers.push({group: 'Winning statistics', field: 'Top 3 winnings share', value: repEur(top3sum), note: fmtNum(top3share, 0) + '% of all winnings'});
  answers.push({group: 'Winning statistics', field: 'Average round result',
                value: (sRounds > 0 && sTotalNet >= 0 ? '+' : (sRounds > 0 ? '-' : '')) + repEur(sRounds > 0 ? sTotalNet / sRounds : 0),
                neg: sRounds > 0 && sTotalNet < 0});

  // ---------- Rounds ----------
  let pct = function(v){ return sRounds > 0 ? fmtNum(v / sRounds * 100) + ' % of all games' : '—'; };
  answers.push({group: 'Rounds', field: 'Winning rounds', value: String(sWin), note: pct(sWin)});
  answers.push({group: 'Rounds', field: 'Losing rounds',  value: String(sLoss), note: pct(sLoss)});
  answers.push({group: 'Rounds', field: 'Even round',     value: String(sTie), note: pct(sTie)});

  return answers;
}

function renderWinnerAnswers(){

  // 'Report dropdowns' go to the suggestions strip (columns), the rest (stats) to the analysis card (rows)
  let $list   = $('#ReportAnswers');
  let $stats  = $('#ReportStats');
  if(!$list.length && !$stats.length){ return; } // panels are not present (e.g. index2.html)
  $list.empty();
  $stats.empty();

  let answers = computeWinnerAnswers();
  let currentGroup = '';
  let $cols = null;

  for(let i = 0; i < answers.length; i++){
    let a = answers[i];
    if(a.group === 'Report dropdowns'){
      // horizontal strip: one column per dropdown answer
      if(!$list.length){ continue; }
      if(!$cols){ $cols = $('<div class="row ra-cols"></div>'); $list.append($cols); }
      $cols.append(
        '<div class="col ra-col">' +
          '<div class="ra-col-head"><span class="ra-col-field">' + a.field + '</span></div>' +
          '<div class="ra-col-value' + (a.neg ? ' neg-val' : '') + '">' + a.value + '</div>' +
          (a.why ? '<div class="ra-why">' + a.why + '</div>' : '') +
        '</div>'
      );
      continue;
    }
    if(!$stats.length){ continue; }
    if(a.group !== currentGroup){
      currentGroup = a.group;
      $stats.append('<div class="ra-group-row">' + currentGroup + '</div>');
    }
    // stats card is analysis-only: no copy button
    $stats.append(
      '<div class="ra-row">' +
        '<span class="ra-field">' + a.field + '</span>' +
        '<span class="ra-value' + (a.neg ? ' neg-val' : '') + '">' + a.value + (a.note ? ' <span class="text-muted ra-note">(' + a.note + ')</span>' : '') + (a.why ? '<span class="ra-why">' + a.why + '</span>' : '') + '</span>' +
      '</div>'
    );
  }
}

$(document).off('click', '.ra-copy').on('click', '.ra-copy', function(){
  let i = parseInt($(this).data('i'), 10);
  let text = lastWinnerAnswers[i] ? lastWinnerAnswers[i].value : '';
  let btn = $(this);

  function done(){
    btn.find('i').attr('class', 'bi bi-check');
    setTimeout(function(){ btn.find('i').attr('class', 'bi bi-clipboard'); }, 1200);
  }
  function needManual(){
    // clipboard is blocked (embedded Tableau browser): the analyst selects the value with the mouse and presses Ctrl+C
    btn.find('i').attr('class', 'bi bi-exclamation-triangle');
    btn.attr('title', 'Clipboard is blocked — select the value with the mouse and press Ctrl+C');
    setTimeout(function(){ btn.find('i').attr('class', 'bi bi-clipboard'); }, 2500);
  }

  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done, function(){ fallbackCopy(); });
  }else{
    fallbackCopy();
  }

  function fallbackCopy(){
    let ok = false, ta = null;
    try{
      ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try{ ta.setSelectionRange(0, text.length); }catch(err2){}
      ok = document.execCommand('copy');
    }catch(e){ ok = false; }
    try{ if(ta){ document.body.removeChild(ta); } }catch(err3){}
    if(ok){ done(); } else { needManual(); }
  }
});

renderWinnerAnswers();

// Global game scope: re-run the whole dashboard on the selected game.
$(document).off('change.dashgame', '#dash-game-filter').on('change.dashgame', '#dash-game-filter', function(){
  DashGameFilter = $(this).val() || '__all';
  drawChartJS();
});

// ================== END WINNER REPORT SUGGESTIONS ===================

// chart mode must be declared BEFORE the first renderBetChart() call below
// (let-variables in the temporal dead zone throw on typeof access)
let ChartMode = 'bet';
let betChart = null;

// chart canvas always fits its card (no scroll); bars get thinner with many rounds
function chartCanvasHTML(){
  return '<canvas id="bar-chart" style="height:168px;"></canvas>';
}

  $("#bar-chart").remove();

  $(".roulette-container").append(chartCanvasHTML());
  $(".roulette-container2").append('<canvas id="bar-chart2" style="height: 80px;" ></canvas>');

  renderBetChart();

function renderBetChart(){
  let showNet = (typeof ChartMode !== 'undefined') && ChartMode === 'net';
  let chartLabel = showNet ? 'Net Amount (' + moneySym() + ')' : 'Bet Amount (' + moneySym() + ')';
  let chartData = RoundArry.map(function(a){ return showNet ? rNetM(a) : rBetM(a); });
  if(document.getElementById('chart-title')){
    document.getElementById('chart-title').textContent = showNet ? 'Net Amount Chart' : 'Bet Amount Chart';
  }

if(typeof Chart === 'undefined'){
  $(".roulette-container").html('<p class="text-muted" style="padding:20px;">Chart failed: Chart.js library did not load (check network / CDN access).</p>');
  return;
}
if(betChart){ try{ betChart.destroy(); }catch(e){} betChart = null; }
try{
betChart = new Chart(document.getElementById("bar-chart"), {
    type: 'bar',
    data: {
        labels: RoundArry.map(a => a.RoundId),
        datasets: [
            {
                barPercentage: 0.9,
                categoryPercentage: 1,
                label: chartLabel,
                backgroundColor: RoundArry.map(a => a.TotalRoundNet > 0 ? themeVar('--chart-win', '#81F495') : themeVar('--chart-loss', '#F07D88')), // Green if positive, Red if negative
                data: chartData
            }
        ]
    },
    options: {
        onClick: function(evt, elements){
          if(!elements || !elements.length){ chartTipHide(); return; }
          let r = RoundArry[elements[0].index];
          if(!r){ return; }
          let native = (evt && evt.native) || {};
          if(native.stopPropagation){ native.stopPropagation(); } // keep the document click-away handler from closing it instantly
          chartTipPinned = r.RoundId;
          chartTipShow(native.clientX || 0, native.clientY || 0, r);
        },
        onHover: function(evt, elements){
          if(chartTipPinned){ return; } // pinned tip stays until click elsewhere
          if(!elements || !elements.length){ chartTipHide(); return; }
          let r = RoundArry[elements[0].index];
          if(!r){ return; }
          let native = (evt && evt.native) || {};
          chartTipShow(native.clientX || 0, native.clientY || 0, r);
        },
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                display: false,
                grid: { display: false }
            },
            y: {
                display: false,
                grid: { display: false }
            }
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                enabled: false, // single tooltip policy: only our DOM popup (copyable) shows, on bar click
                callbacks: {
                    title: function (tooltipItems) {

                        return `Round Stats`; // Custom title
                    },
                    label: function (tooltipItem) {
                        let index = tooltipItem.dataIndex;
                        let roundId = RoundArry[index].RoundId;
                        let totalBet = fmtNum(rBetM(RoundArry[index]));
                        let totalNet = fmtNum(rNetM(RoundArry[index]));

                        return [
                            `Round ID: ${roundId}`,
                            `Bet Amount: €${totalBet}`,
                            `Net Amount: €${totalNet}` // This appears only on hover
                        ];
                    }
                }
            }
        }
    }
});
} catch(err){
  $(".roulette-container").html('<p class="text-muted" style="padding:20px;">Chart failed: ' + String((err && err.message) || err) + '</p>');
}
} // end renderBetChart

// Bet / Net chart mode toggler (ChartMode declared above, before first render)
function setChartMode(mode){
  ChartMode = (mode === 'net') ? 'net' : 'bet';
  let isNet = ChartMode === 'net';
  $('.ct-opt').removeClass('ct-active');
  $('.ct-opt[data-chart="' + ChartMode + '"]').addClass('ct-active');
  $('.ct-switch').toggleClass('ct-on', isNet).toggleClass('ct-off', !isNet)
    .attr('aria-checked', isNet ? 'true' : 'false');
  chartTipHide();
  $('#bar-chart').remove();
  $('.roulette-container').append(chartCanvasHTML());
  renderBetChart();
}
$(document).off('click.chartmode', '.ct-opt').on('click.chartmode', '.ct-opt', function(){
  setChartMode($(this).data('chart'));
});
$(document).off('click.chartmode-sw', '.ct-switch').on('click.chartmode-sw', '.ct-switch', function(){
  setChartMode(ChartMode === 'net' ? 'bet' : 'net');
});

// Click a chart bar -> fixed DOM tooltip with a selectable Round ID
// (canvas tooltips cannot be selected; same copy pattern as the break heat-map:
// select with the mouse, right-click -> Copy — Tableau blocks the clipboard API).
function chartTipEnsure(){
  if(!$chartTip || !$chartTip.length){
    $chartTip = $('<div class="gap-tip chart-tip" id="chart-tip"></div>');
    $('body').append($chartTip);
  }
  return $chartTip;
}
function chartTipShow(clientX, clientY, round){
  let tip = chartTipEnsure();
  if(chartTipFor !== round.RoundId){
    tip.html(
      '<div class="gap-tip-ids">Round <span class="gap-copy" data-round="' + String(round.RoundId).replace(/"/g, '&quot;') + '">' + round.RoundId + '</span></div>' +
      '<div class="gap-tip-meta">Bet ' + moneySym() + fmtNum(rBetM(round)) + ' &middot; Net ' + moneySym() + fmtNum(rNetM(round)) + '</div>'
    );
    chartTipFor = round.RoundId;
  }
  tip.addClass('show');
  let w = tip[0].offsetWidth, h = tip[0].offsetHeight;
  let vw = document.documentElement.clientWidth;
  let left = clientX + 12, top = clientY - h - 12;
  if(left + w > vw - 8){ left = clientX - w - 12; }
  if(left < 8){ left = 8; }
  if(top < 8){ top = clientY + 16; }
  tip.css({left: (left + (window.pageXOffset || 0)) + 'px', top: (top + (window.pageYOffset || 0)) + 'px'});
}
function chartTipHide(){
  if($chartTip){ $chartTip.removeClass('show'); }
  chartTipPinned = null;
  chartTipFor = null;
}
$(document).off('click.charttip-out').on('click.charttip-out', function(e){
  if($(e.target).closest('#chart-tip').length){ return; }
  chartTipHide();
});
  loadOverlay(false); // pipeline done: render is complete, remove the loading blur











     

     



      

    
     



     
   });


  
 }




 





