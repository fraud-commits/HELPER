
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

// Watchdog: if Tableau never answers with data (blocked extension, missing
// sheet, unset filters), say so instead of leaving eternal zeros/dashes.
let booted = false;
// chart click-tooltip element (declared here: chartTipHide() runs at refresh
// top, long before the chart section below — late `let` would throw TDZ).
let $chartTip = null;
setTimeout(function(){
  if(!booted){
    showExtError('Tableau did not return data in 15s. Check: 1) the fraud sheet is on this dashboard, 2) Player Id / Timestamp parameters are set, 3) the extension was re-added from the current .trex — then Reload.');
  }
}, 15000);





$(document).ready(function () {
   tableau.extensions.initializeAsync().then(function () {
      // Draw the chart when initialising the dashboard.
      getSettings();
      drawChartJS();
      // Set up the Settings Event Listener.
      unregisterSettingsEventListener = tableau.extensions.settings.addEventListener(tableau.TableauEventType.SettingsChanged, (settingsEvent) => {
         // On settings change.
      getSettings();
       drawChartJS();
      });
   }, function () { console.log('Error while Initializing: ' +err.toString()); });
});









function getSettings() {
   // Once the settings change populate global variables from the settings.

   const worksheets = tableau.extensions.dashboardContent.dashboard.worksheets;

   var worksheet = worksheets.find(function (sheet) {
     return sheet.name === "fraud";
   });

   if(!worksheet){ fail("Worksheet 'fraud' is not on this dashboard — add the sheet and Reload the extension."); }

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

   const worksheets = tableau.extensions.dashboardContent.dashboard.worksheets;

   var worksheet = worksheets.find(function (sheet) {
     return sheet.name === "fraud";
   });

   if(!worksheet){ fail("Worksheet 'fraud' is not on this dashboard — add the sheet and Reload the extension."); }

   

   worksheet.getSummaryDataAsync().then(function (sumdata) {
     booted = true;

     // --- No player selected: show placeholder instead of the dashboard ---
     if (!sumdata.data || sumdata.data.length === 0) {
       $('#dashboard-content').hide();
       $('#empty-state').css('display', 'flex');
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
     chartTipHide();
     if ($.fn.DataTable.isDataTable('.table-dealer')) { $('.table-dealer').DataTable().clear().destroy(); }
     if ($.fn.DataTable.isDataTable('.table-table'))  { $('.table-table').DataTable().clear().destroy(); }
     if ($.fn.DataTable.isDataTable('.table-game'))   { $('.table-game').DataTable().clear().destroy(); }
     if ($.fn.DataTable.isDataTable('.table-roundTop')) { $('.table-roundTop').DataTable().clear().destroy(); }
     if ($.fn.DataTable.isDataTable('.table-bettop'))   { $('.table-bettop').DataTable().clear().destroy(); }

     const RoundTime = 0,
           UserId = 5,
           UserName= 6,
           CompanyCode = 1;
           RoundID = 2,
           GameType = 4,
           BetPosition = 7,
           DealerName = 3,
           TableName = 6,
           BetEUR = 8,
           NetEUR = 9;

           let RoundSkipp = 0;
           let ShortBreak = 0;
           let LongBreak = 0;
           let SequentialGame = 0;

           let indexStart,
               indexNext;
          
           let TotalBet = 0;
           let TotalNet = 0;

           let RoundArry= [];
           let RoundArry2= [];
           let RatioArry= [];

            let totaltest = 0;
            var worksheetData = sumdata.data;
     
            let DealerArry =[];
            let BetPositionArry =[];
            let TableArry = [];

            let up = 0,
            down = 0,
            same = 0,
            negativ = 0,
            martingeil = 0,
            chaotic = 0;

            SideBetArry = ["Banker Bonus", "Banker Pair", "Phoenix Pair", "Player Bonus","Player Pair", "Small","Super 6"];
            


            



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
   TotalBet += worksheetData[indexStart][BetEUR].value;
   TotalNet += worksheetData[indexStart][NetEUR].value;

  }

  let Margin = TotalNet / TotalBet * 100;
    console.log("Margin : " + Margin)

  // helpers: red color for negative values
  function negClass(v){ return (typeof v === 'number' && v < 0) ? ' class="neg-val"' : ''; }
  function negWrap(v, txt){
    return (typeof v === 'number' && v < 0) ? '<span class="neg-val">' + txt + '</span>' : txt;
  }

  $('.Totalbet').text("€ " + TotalBet.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }));
  $('.Totalnet').text("€ " + TotalNet.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })).toggleClass('neg-val', TotalNet < 0);
  $('.Margin').text(Margin.toFixed(2) + "%").toggleClass('neg-val', Margin < 0);
  // session margin: dark brand green when positive, red when negative;
  // diverging bar from the centre zero (±100% scale clamped, 100% = half the track)
  let mClamped = Math.max(-100, Math.min(100, Margin));
  let mBar = $('.margin-bar').toggleClass('bar-pos', Margin >= 0).toggleClass('bar-neg', Margin < 0);
  if(mClamped >= 0){ mBar.css({left: '50%', width: (mClamped / 2) + '%'}); }
  else{ mBar.css({left: (50 + mClamped / 2) + '%', width: (-mClamped / 2) + '%'}); }
  $('.session-dot').toggleClass('dot-pos', Margin >= 0).toggleClass('dot-neg', Margin < 0);




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
  let index3 = BetPositionArry.findIndex(object => object.BetPosition === worksheetData[indexStart][BetPosition].formattedValue);
  let index4 = TableArry.findIndex(object => object.TableName === worksheetData[indexStart][TableName].formattedValue);

  if (index === -1) {

    RoundArry.push({
      RoundId: worksheetData[indexStart][RoundID].formattedValue,
      TotalRoundBet: 0,
      TotalRoundNet:0,
      DealerName: worksheetData[indexStart][DealerName].formattedValue,
      TableName: worksheetData[indexStart][TableName].formattedValue,
      Margin: 0,
      RoundTime: worksheetData[indexStart][RoundTime].formattedValue,
      GameType: worksheetData[indexStart][GameType].formattedValue

    })
  }
  
  if (index2 === -1) {
    DealerArry.push({
      DealerName: worksheetData[indexStart][DealerName].formattedValue,
      TotalBet: 0,
      TotalNet:0,
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
      BetPosition: worksheetData[indexStart][BetPosition].formattedValue,
      TotalBet: 0,
      TotalNet:0,
      RoundCount :0,


    })
  }

  if (index4 === -1) {
    TableArry.push({
      TableName: worksheetData[indexStart][TableName].formattedValue,
      TotalBet: 0,
      TotalNet: 0,
      RoundCount: 0
    })
  }



  let element = RoundArry.find(e => e.RoundId === worksheetData[indexStart][RoundID].formattedValue);
  if (element) {
    element.TotalRoundBet += worksheetData[indexStart][BetEUR].value;
    element.TotalRoundNet += worksheetData[indexStart][NetEUR].value;
}

let element2 = DealerArry.find(e => e.DealerName === worksheetData[indexStart][DealerName].formattedValue);
if (element2 ) {
  element2.TotalBet += worksheetData[indexStart][BetEUR].value;
  element2.TotalNet += worksheetData[indexStart][NetEUR].value;

}

// table statistics (per table id / game type)
let element4 = TableArry.find(e => e.TableName === worksheetData[indexStart][TableName].formattedValue);
if (element4) {
  element4.TotalBet += worksheetData[indexStart][BetEUR].value;
  element4.TotalNet += worksheetData[indexStart][NetEUR].value;
}

let element3 = BetPositionArry.find(e => e.BetPosition === worksheetData[indexStart][BetPosition].formattedValue);
let BetCategory;

if(SideBetArry.find(element => element === worksheetData[indexStart][BetPosition].formattedValue )){
  console.log("element found")
  BetCategory = "SideBet"
}else{
  BetCategory = "MainBet"
}
if (element3 ) {
  element3.TotalBet += worksheetData[indexStart][BetEUR].value;
  element3.TotalNet += worksheetData[indexStart][NetEUR].value;
  element3.RoundCount += 1;
  element3.Category = BetCategory;
 
}

}


console.log(BetPositionArry)
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////////////
// BREAK RULES (explicitly defined):
//   gap between two consecutive played rounds < 3 min   -> Sequential
//   3 min  <= gap < 10 min  -> SKIP  (player watched but did not bet, est. skipped rounds counted)
//   10 min <= gap < 30 min  -> SHORT BREAK
//   gap    >= 30 min        -> LONG BREAK
// Rounds are sorted by time first; timestamps that cannot be parsed are skipped.

const BREAK_RULES = { SKIP_MIN: 3, SKIP_MAX: 10, SHORT_MAX: 30 };
let EstSkippedRounds = 0; // estimated number of game rounds missed during skips

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

function parseRoundTime(t){
  let m = moment(t, ["DD-MM-YYYY HH:mm:ss a", "DD-MM-YYYY HH:mm:ss", "YYYY-MM-DD HH:mm:ss"], true);
  if(!m.isValid()){ m = moment(t); } // last resort: let moment guess the format
  return m.isValid() ? m : null;
}

function fmtGap(mins){
  if(mins >= 60){
    let h = Math.floor(mins / 60);
    let m = Math.round(mins - h * 60);
    return h + ' h ' + m + ' min';
  }
  return mins.toFixed(1) + ' min';
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
  if(from){ ids += idText(from); }
  if(to){ ids += ' <span class="gap-arrow">→</span> ' + idText(to); }
  tip.html(
    '<div class="gap-tip-ids">' + ids + '</div>' +
    '<div class="gap-tip-meta">' + meta + '</div>' +
    '<div class="gap-tip-hint">select the id with the mouse, right-click → Copy · click the square to fix</div>'
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

  // --- sort a copy of rounds by timestamp (data order is not guaranteed) ---
  let sorted = RoundArry.slice().map(function(r){
    return { r: r, t: parseRoundTime(r.RoundTime) };
  }).filter(function(o){ return o.t !== null; })
    .sort(function(a, b){ return a.t.valueOf() - b.t.valueOf(); });

  // --- typical round cadence = median gap of fast (sequential) intervals ---
  let gaps = [];
  for(let i = 1; i < sorted.length; i++){
    let g = sorted[i].t.diff(sorted[i-1].t, 'minutes', true);
    if(g >= 0 && g < BREAK_RULES.SKIP_MIN){ gaps.push(g); }
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

    if(gap < BREAK_RULES.SKIP_MIN){
      SequentialGame += 1;
      gapType = 'sequential'; gapClass = 'badge-sql-c';
    }else if(gap < BREAK_RULES.SKIP_MAX){
      // SKIP: player stayed but did not bet; estimate how many game rounds were missed
      RoundSkipp += 1;
      gapEst = Math.max(1, Math.round(gap / cadence) - 1);
      EstSkippedRounds += gapEst;
      gapType = 'SKIP'; gapClass = 'badge-skip-c';
    }else if(gap < BREAK_RULES.SHORT_MAX){
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

  let TotalBet;

  for (let i = 0; i < RoundArry.length; i++ ){

    TotalBet += RoundArry[i].TotalRoundBet
    let cur = i;
    let next;
    let nextn;

    if(i == RoundArry.length - 1){

      next =  RoundArry.length -1
      nextn  = RoundArry.length -1

    }else if(i == RoundArry.length - 2){

      next = i + 1
      nextn = i + 1

    }else{
      next = i + 1
      nextn = i + 2
    }

    // transition cur -> next (chronological order guaranteed above):
    // flat = same stake ±2% (10 vs 10.2 is flat, 10 vs 15 is not);
    // negative pattern = raise after a loss OR lower after a win;
    // positive pattern = raise after a win OR lower after a loss.
    // (chaotic is session-level — both systems mixed — not a transition label.)
    let curBet = RoundArry[cur].TotalRoundBet;
    let nextBet = RoundArry[next].TotalRoundBet;
    let curNet = RoundArry[cur].TotalRoundNet;
    if (Math.abs(nextBet - curBet) <= curBet * 0.02){
      same += 1; //Flat
    }else if(nextBet > curBet && curNet <= 0){
      // raise after a loss → negative pattern (any size, not just 2x);
      // back-to-back 2x+ raises after losses tracked as Martingale
      if(curBet * 2 <= nextBet && RoundArry[next].TotalRoundNet <= 0 &&
         RoundArry[next].TotalRoundBet * 2 <= RoundArry[nextn].TotalRoundBet){
        martingeil += 1; // Martingale
      }else{
        negativ += 1; // Negative
      }
    }else if(nextBet > curBet){
      up += 1; // raise after a win → positive pattern
    }else if(curNet > 0){
      negativ += 1; // lower after a win (back to base) → negative pattern
    }else{
      up += 1; // lower after a loss (cut) → positive pattern
    }

    /*
    
    if (RoundArry[cur].TotalRoundBet == RoundArry[next].TotalRoundBet){
      same += 1;
    }else if (RoundArry[cur].TotalRoundNet <= 0 && RoundArry[cur].TotalRoundBet * 2 <= RoundArry[next].TotalRoundBet){
    
    if(RoundArry[next].TotalRoundNet <= 0 && RoundArry[next].TotalRoundBet * 2 <= RoundArry[nextn].TotalRoundBet){
      martingeil += 1;
    }
      negativ += 1;
    }
    
    if(RoundArry[cur].TotalRoundBet < RoundArry[next].TotalRoundBet && RoundArry[cur].TotalRoundNet > 0){
      up += 1;
    }else{
      chaotic += 1;
    }

      */

    
    }


/*

let up = 0,
down = 0,
same = 0,
negativ = 0,
martingeil = 0;
chaotic
*/

let UpProcent = up / RoundArry.length * 100;
let DownProcent = down / RoundArry.length * 100;
let SameProcent = same / RoundArry.length * 100;
let NegativProcent = negativ / RoundArry.length * 100;
let MartingeilProcent = martingeil / RoundArry.length * 100;
let ChaoticProcent = chaotic / RoundArry.length * 100;

//console.log("Same " + SameProcent)


//console.log("UP " + UpProcent)
//console.log("Down " + DownProcent)
//console.log("Negativ " + NegativProcent)
//console.log("Martingeil " + MartingeilProcent)
//console.log("Chaotic " + ChaoticProcent)

let bettingprogression;

if(SameProcent  >= 70.00 ){
  console.log("Flat wager") // Flat wager
  bettingprogression = "Flat wager"
}else if (SameProcent  >= 69.00){
  console.log("Mainly flat wager") // Mainly flat wager
  bettingprogression = "Mainly flat wager"
}else if (SameProcent  >= 68.00 && UpProcent >= 32.00){
  console.log("Mainly flat wager at some passage possitive progression") // Mainly flat wager at some passage possitive progression
  bettingprogression ="Mainly flat wager at some passage possitive progression"
}else if (SameProcent  >= 30.00 && NegativProcent >= 70.00){
  console.log("Negative  progression, however at some passages flat") // Negative  progression, however at some passages flat
  bettingprogression = "Negative  progression, however at some passages flat"
}else if (UpProcent >= 85.00){
  console.log("Possitive progression") // Negative  progression, however at some passages flat
  bettingprogression = "Possitive progression"
}else if (DownProcent >= 85.00){
  console.log("Negative progression") // Negative  progression
  bettingprogression = "Negative progression"
}else if (DownProcent >= 50.00 && UpProcent >= 50.00){
  console.log("Chaotic wagers, regardless to previous game outcome") // Chaotic wagers, regardless to previous game outcome
  bettingprogression = "Chaotic wagers, regardless to previous game outcome"
}else if (ChaoticProcent >= 85.00){
  console.log("Chaotic") // Chaotic  progression
  bettingprogression = "Chaotic"
}else if (ChaoticProcent >= 20.00 && SameProcent >= 30.00){ 
  console.log("Chaotic, however at some pasage flat wager") // Chaotic  progression -----------GOOD
  bettingprogression = "Chaotic, however at some pasage flat wager"
}else if (ChaoticProcent >= 60.00 && SameProcent >= 20.00 && NegativProcent >= 20.00){
  console.log("Chaotic, however at some passage flat wager and at some passage negative progression") // Chaotic, however at some passage flat wager and at some passage negative progression
  bettingprogression = "Chaotic, however at some passage flat wager and at some passage negative progression"
}else if (ChaoticProcent >= 60.00 && NegativProcent >= 40.00){
  console.log("Chaotic, however at some passage fegative progression") // Chaotic, however at some passage fegative progression
  bettingprogression = "Chaotic, however at some passage fegative progression"
}else{
  console.log("Betting progression Chaotic")
  bettingprogression = "Betting progression Chaotic"
}

$(".bettingProgression").text(bettingprogression)

}



BetProgression ()





//console.log(same + " - Falt" )
//console.log(negativ + " - Negative" )
//console.log(martingeil + " - Matingeil")
//console.log(up + " - Positive")
//console.log(chaotic + " - Chaotic")



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



let WinProcent = WinRoundCnt / RoundArry.length * 100;
$('.WinProcent').text(WinProcent.toFixed(2) + "%");
$('.WinProcent-bar').css('width', WinProcent.toFixed(2) + "%");



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
      <td>` + DealerArry[i].TotalBet.toFixed(2) + `</td>
      <td` + negClass(DealerArry[i].TotalNet) + `>` + DealerArry[i].TotalNet.toFixed(2) + `</td>
      <td>`+ DealerArry[i].RoundCount +` </td>
      <td` + negClass(DealerArry[i].TotalNet) + `>`+ (DealerArry[i].TotalNet.toFixed(2) /  DealerArry[i].TotalBet.toFixed(2) * 100).toFixed(2) +` % </td>
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
      <td>` + TableArry[i].TotalBet.toFixed(2) + `</td>
      <td` + negClass(TableArry[i].TotalNet) + `>` + TableArry[i].TotalNet.toFixed(2) + `</td>
      <td>`+ TableArry[i].RoundCount +` </td>
      <td` + negClass(TableArry[i].TotalNet) + `>`+ (TableArry[i].TotalNet.toFixed(2) /  TableArry[i].TotalBet.toFixed(2) * 100).toFixed(2) +` % </td>
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
    el.TotalNet += RoundArry[i].TotalRoundNet;
    el.RoundCount += 1;
  }
  // default order: Net descending
  GameTypeArry.sort(function(a, b){ return b.TotalNet - a.TotalNet; });
  for(i = 0; i < GameTypeArry.length; i++){
    $(".GameTypeTop").append(`
    <tr>
      <td>` + GameTypeArry[i].GameType + `</td>
      <td>` + GameTypeArry[i].TotalBet.toFixed(2) + `</td>
      <td` + negClass(GameTypeArry[i].TotalNet) + `>` + GameTypeArry[i].TotalNet.toFixed(2) + `</td>
      <td>`+ GameTypeArry[i].RoundCount +` </td>
      <td` + negClass(GameTypeArry[i].TotalNet) + `>`+ (GameTypeArry[i].TotalNet.toFixed(2) /  GameTypeArry[i].TotalBet.toFixed(2) * 100).toFixed(2) +` % </td>
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
    <td>` + RoundArry[x].TotalRoundBet.toFixed(2) + `</td>
    <td` + negClass(RoundArry[x].TotalRoundNet) + `>` + RoundArry[x].TotalRoundNet.toFixed(2) + `</td>
    <td` + negClass(RoundArry[x].TotalRoundNet) + `>`+ (RoundArry[x].TotalRoundNet.toFixed(2) /  RoundArry[x].TotalRoundBet.toFixed(2) * 100).toFixed(2)+` % </td>
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
  
  for(i = 0; i < BetPositionArry.length ; i++){

  


    $(".BetPosTop").append(`
      <tr>
                                          <td>`+ BetPositionArry[i].BetPosition + `</td>
                                            <td>` + BetPositionArry[i].TotalBet.toFixed(2) +`</td>
                                                <td` + negClass(BetPositionArry[i].TotalNet) + `>` + BetPositionArry[i].TotalNet.toFixed(2) +`</td>
                                                <td` + negClass(BetPositionArry[i].TotalNet) + `>`+ (BetPositionArry[i].TotalNet.toFixed(2) /  BetPositionArry[i].TotalBet.toFixed(2) * 100).toFixed(2)+` % </td>
                                                <td>` + BetPositionArry[i].RoundCount +`</td>
                                                <td>
                                                    <div class="d-flex align-items-center">
                                                        <span class="badge badge-success badge-dot m-r-10"></span>
                                                        <span>` + BetPositionArry[i].Category + `</span>
                                                    </div>
                                                </td>
                                            </tr>
    `)
  }
 // Grand totals under each column of the Bet type statistics table
 let totalBetAll = 0, totalNetAll = 0, totalCountAll = 0;
 for(let i = 0; i < BetPositionArry.length; i++){
   totalBetAll  += BetPositionArry[i].TotalBet;
   totalNetAll  += BetPositionArry[i].TotalNet;
   totalCountAll += BetPositionArry[i].RoundCount;
 }
 let totalMarginAll = totalBetAll > 0 ? totalNetAll / totalBetAll * 100 : 0;

 $('.table-bettop .foot-bet').text(totalBetAll.toFixed(2));
 $('.table-bettop .foot-net').html(negWrap(totalNetAll, totalNetAll.toFixed(2)));
 $('.table-bettop .foot-margin').html(negWrap(totalNetAll, totalMarginAll.toFixed(2) + ' %'));
 $('.table-bettop .foot-count').text(totalCountAll);

 $('.table-bettop').DataTable();

}


BetPositionTop()

// ============================ KEY FINDINGS ============================
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
  let avgBet   = rounds  > 0 ? TotalBet / rounds : 0;
  let maxRound = null;

  for(let i = 0; i < rounds; i++){
    if(maxRound === null || RoundArry[i].TotalRoundBet > maxRound.TotalRoundBet){
      maxRound = RoundArry[i];
    }
  }

  function eur(v){
    return '€' + Math.abs(v).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  }
  function pct(part, total){
    return total > 0 ? part / total * 100 : 0;
  }
  function add(level, text){ findings.push({level: level, text: text}); }

  // ---- 1. Win rate vs theoretical expectation ----
  if(decided >= 20){
    if(effWin >= 55){
      add('danger', '<b>Abnormally high win rate:</b> ' + effWin.toFixed(1) + '% (' + WinRoundCnt +
          ' wins in ' + decided + ' decided rounds), expected is ~48-49%.');
    }else if(effWin <= 42){
      add('success', 'Win rate ' + effWin.toFixed(1) + '% is below expectation — no advantage play signs.');
    }else{
      add('success', 'Win rate ' + effWin.toFixed(1) + '% is within the expected range.');
    }
  }

  // ---- 2. Session result ----
  if(TotalNet > 0){
    let lvl = (effWin >= 55 && decided >= 20) ? 'danger' : 'warning';
    add(lvl, '<b>Player finished in profit:</b> +' + eur(TotalNet) + ' (margin +' + Margin.toFixed(2) + '%).');
  }

  // ---- 3. Betting strategy (manual §5.5: Flat / Negative & Martingale are
  //         normal; erratic play and Bet Ramps are red flags) ----
  // Note: chaotic is session-level (both staking systems mixed), not a transition bucket.
  let samePct   = pct(same, rounds);
  let negPct    = pct(negativ + martingeil, rounds);
  let upPct     = pct(up, rounds);

  if(rounds >= 5 && maxRound && avgBet > 0 && maxRound.TotalRoundBet >= 3 * avgBet){
    add('warning', '<b>Bet ramp:</b> sudden sharp bet increase up to ' + eur(maxRound.TotalRoundBet) +
        ' (' + (maxRound.TotalRoundBet / avgBet).toFixed(1) + '× the average, round ' + maxRound.RoundId +
        ') — may indicate advantage play.');
  }
  if(rounds >= 15 && negPct >= 20 && upPct >= 20){
    add('warning', '<b>Erratic strategy:</b> no consistent staking system — negative pattern in ' + negPct.toFixed(0) +
        '% and positive pattern in ' + upPct.toFixed(0) + '% of rounds — could indicate testing, scripting or manipulation.');
  }
  if(samePct >= 70){
    add('success', 'Flat betting throughout the session — consistent with normal play.');
  }
  if(negPct >= 30){
    add('info', 'Negative progression (Martingale-style raise after losses) in ' + negPct.toFixed(0) +
        '% of rounds — acceptable for roulette if other indicators are clean.');
  }
  if(upPct >= 50){
    add('info', 'Positive progression (raises after wins) in ' + upPct.toFixed(0) + '% of rounds.');
  }

  // ---- 4. Round skipping (manual: "frequently skips game rounds, possibly
  //         waiting for favorable conditions") ----
  // Skip share is based on ESTIMATED skipped game rounds, not only gap count.
  let skipShare = (RoundSkipp > 0) ? EstSkippedRounds / (rounds + EstSkippedRounds) * 100 : 0;
  if(skipShare >= 30){
    add('danger', '<b>Frequently skips game rounds:</b> est. ' + EstSkippedRounds + ' round(s) skipped in ' +
        RoundSkipp + ' gap(s) (' + skipShare.toFixed(0) + '%) — possibly waiting for favorable conditions.');
  }else if(skipShare >= 15){
    add('warning', 'Player skips rounds: est. ' + EstSkippedRounds + ' round(s) skipped (' + skipShare.toFixed(0) + '% of the session).');
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
          '<b>Dealer pattern:</b> player profits only with dealer ' + topNet.DealerName + ' (+' + eur(topNet.TotalNet) +
          '), losing with all other dealers — prioritize video review (possible predictability or collusion).');
    }
    // 7b. Single dealer coverage with profit
    let topCnt = DealerArry[0];
    for(let i = 1; i < DealerArry.length; i++){
      if(DealerArry[i].RoundCount > topCnt.RoundCount){ topCnt = DealerArry[i]; }
    }
    let share = pct(topCnt.RoundCount, rounds);
    if(share >= 50 && topCnt.TotalNet > 0 && DealerArry.length < 3){
      add('warning', '<b>Dealer concentration:</b> ' + share.toFixed(0) + '% of rounds with dealer ' +
          topCnt.DealerName + ', player net +' + eur(topCnt.TotalNet) + ' with them.');
    }
    // 7c. Frequent dealer switching (manual: "plays only 1-2 hands per dealer")
    if(rounds / DealerArry.length <= 2.5 && DealerArry.length >= 6){
      add('warning', '<b>Frequent dealer switching:</b> ' + DealerArry.length + ' dealers over ' + rounds +
          ' rounds (~' + (rounds / DealerArry.length).toFixed(1) + ' rounds each) — possible detection avoidance.');
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
      add('warning', '<b>Sharp margin swings between dealers:</b> ' + dMax.d.DealerName + ' (+' + dMax.m.toFixed(0) +
          '%) vs ' + dMin.d.DealerName + ' (' + dMin.m.toFixed(0) + '%) — statistical outlier per Dealer Report criteria.');
    }
  }

  // ---- 8. Sample size ----
  if(rounds < 15){
    add('info', 'Small sample: only ' + rounds + ' round(s) — conclusions are unreliable.');
  }

  // ---- Bot / automation verdict (set by analyzeBot, runs before) ----
  if(typeof BotFinding !== 'undefined' && BotFinding){ add(BotFinding.level, BotFinding.text); }

  // ---- Summary bullet (always first) ----
  let dangerCnt = findings.filter(f => f.level === 'danger').length;
  let warnCnt   = findings.filter(f => f.level === 'warning').length;
  if(dangerCnt > 0){
    findings.unshift({level: 'danger', text: '<b>' + dangerCnt + ' red flag(s) detected</b> — manual review recommended: check game logs, CCTV and dealer footage per Incident Response flow.'});
  }else if(warnCnt > 0){
    findings.unshift({level: 'warning', text: 'No direct fraud indicators, but ' + warnCnt + ' point(s) need attention.'});
  }else{
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
  let attCnt = 0, noteCnt = 0;
  for(let i = 0; i < findings.length; i++){
    if(findings[i].level === 'danger' || findings[i].level === 'warning'){ attCnt++; }
    else{ noteCnt++; }
  }
  let sumTxt = '';
  if(attCnt > 0){ sumTxt += attCnt + ' need attention'; }
  if(noteCnt > 0){ sumTxt += (sumTxt ? ' · ' : '') + noteCnt + ' note' + (noteCnt === 1 ? '' : 's'); }
  if(!sumTxt){ sumTxt = 'no findings'; }
  $('#findings-summary').text(sumTxt);
  $('#findings-card').addClass('collapsed');
  $('#findings-toggle i').attr('class', 'bi bi-chevron-down');
}

$(document).off('click.findings', '#findings-toggle').on('click.findings', '#findings-toggle', function(){
  let $card = $('#findings-card');
  $card.toggleClass('collapsed');
  let collapsed = $card.hasClass('collapsed');
  $(this).find('i').attr('class', collapsed ? 'bi bi-chevron-down' : 'bi bi-chevron-up');
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

  // ---- 2. Stake variance (max bet / average bet) ----
  let avgBet = 0, maxBet = 0;
  if(rounds > 0){ avgBet = TotalBet / rounds; }
  for(let i = 0; i < rounds; i++){ if(RoundArry[i].TotalRoundBet > maxBet){ maxBet = RoundArry[i].TotalRoundBet; } }
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

  if(rounds > 300){ sig++; notes.push('very long session: ' + rounds + ' rounds (> 300) — bots can play for hours without tiring'); }
  if(entropy < 2.5 && distinctTypes > 0){ sig++; notes.push('few repeating bets: only ' + distinctTypes + ' bet type(s) used (' + entropy.toFixed(2) + ' bits) — bots stick to the same pattern'); }
  // scripted play keeps the stake almost fixed; a human spreads it out
  if(betVar < 1.5 && avgBet > 0){ sig++; notes.push('stake almost never changes: max bet is only ' + (betVar > 0 ? betVar.toFixed(1) : '0') + '× the average'); }
  // very fast, steady cadence (well under the ~40 s table median)
  if(cadence > 0 && cadence < 0.8){ sig++; notes.push('plays very fast: median ' + (cadence * 60).toFixed(0) + ' s between rounds (normal is ~40 s) — bots do not hesitate'); }
  if(rounds > 100 && breakCnt === 0){ sig++; notes.push('no breaks at all in ' + rounds + ' rounds — a human usually pauses'); }

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
let FinGameFilter = '__all'; // game-type scope of the Financial analysis card ('__all' or a GameType)

function computeWinnerAnswers(){

  let rounds  = RoundArry.length;
  let answers = [];
  lastWinnerAnswers = answers;

  let p = function(v){ return rounds > 0 ? v / rounds * 100 : 0; };
  function eur(v){
    return '€' + Math.abs(v).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  }

  // ---------- Betting progression (exact report options) ----------
  // Per-transition buckets: flat (±2%) / negative pattern (raise after loss,
  // lower after win) / positive pattern (raise after win, lower after loss).
  // Chaotic is a session-level verdict — both systems mixed with no dominance —
  // never a catch-all transition bucket.
  let samePct  = p(same);
  let negPct   = p(negativ + martingeil);
  let upPct2   = p(up);

  let prog;
  if(rounds <= 1){ prog = 'Other one'; }
  else if(samePct >= 70){ prog = 'Flat wagers'; }
  else if(negPct >= 70){ prog = 'Negative progression'; }
  else if(martingeil >= 2 && negPct >= 50){ prog = 'Martingale betting system'; }
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
    progWhy = 'flat ' + samePct.toFixed(0) + '% · negative ' + negPct.toFixed(0) + '% · positive ' + upPct2.toFixed(0) + '% of ' + rounds + ' rounds';
  }
  function avgBetSafe(){ return rounds > 0 ? TotalBet / rounds : 0; }

  answers.push({group: 'Report dropdowns', field: 'Betting progression', value: prog, why: progWhy});

  // ---------- Bet continuity (exact report options) ----------
  // Skip share by ESTIMATED skipped game rounds (time-based), not just gap count
  let skipShare = (RoundSkipp > 0) ? EstSkippedRounds / (rounds + EstSkippedRounds) * 100 : 0;
  let cont;
  if(rounds == 1){ cont = 'Only one game round held'; }
  else if(rounds <= 4){ cont = 'Held only few game rounds'; }
  else if(rounds <= 10){ cont = RoundSkipp == 0 ? 'Short session, without skipping game rounds' : 'Short session, not many games in a row'; }
  else if(skipShare == 0){ cont = rounds >= 30 ? 'Plays many rounds in a row without skipping rounds' : 'Does not skip game rounds'; }
  else if(skipShare <= 5){ cont = rounds >= 30 ? 'Many sequential games, however, at some passages skips rounds' : 'Sequential games, however, skips rounds from time to time'; }
  else if(skipShare <= 15){ cont = 'Mainly sequential games, however at some passages skips rounds'; }
  else if(skipShare <= 40){ cont = 'Skips rounds time to time'; }
  else{ cont = 'Often skips rounds'; }
  let contWhy;
  if(rounds == 1){ contWhy = 'only 1 round in the session'; }
  else if(RoundSkipp == 0){ contWhy = rounds + ' played rounds, no skip gaps (3–10 min)'; }
  else{ contWhy = 'est. ' + EstSkippedRounds + ' skipped of ' + (rounds + EstSkippedRounds) + ' (' + skipShare.toFixed(0) + '%) in ' + RoundSkipp + ' skip gap(s)'; }
  answers.push({group: 'Report dropdowns', field: 'Bet continuity', value: cont, why: contWhy});

  // ---------- Breaks during analysis (exact report options) ----------
  let S = ShortBreak, L = LongBreak, T = S + L;
  let br;
  if(rounds == 1){ br = 'Only one game round held'; }
  else if(T == 0){ br = 'No breaks during the session'; }
  else if(T <= 2){ br = 'Few breaks during the session'; }
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

  // ---------- Wager statistics (scoped by the Game filter; dropdowns above stay global) ----------
  let scope = (typeof FinGameFilter === 'string' && FinGameFilter !== '__all')
    ? RoundArry.filter(function(r){ return (r.GameType || 'Unknown') === FinGameFilter; })
    : RoundArry;
  let sRounds = scope.length;
  let sTotalBet = 0, sTotalNet = 0, sWin = 0, sLoss = 0, sTie = 0;
  for(let si = 0; si < sRounds; si++){
    sTotalBet += scope[si].TotalRoundBet;
    sTotalNet += scope[si].TotalRoundNet;
    if(scope[si].TotalRoundNet > 0){ sWin++; }
    else if(scope[si].TotalRoundNet < 0){ sLoss++; }
    else{ sTie++; }
  }
  let sAvgBet = sRounds > 0 ? sTotalBet / sRounds : 0;

  let maxWager = 0, minWager = null;
  let winNets = [];
  for(let i = 0; i < sRounds; i++){
    let b = scope[i].TotalRoundBet;
    if(b > maxWager){ maxWager = b; }
    if(minWager === null || b < minWager){ minWager = b; }
    if(scope[i].TotalRoundNet > 0){ winNets.push(scope[i].TotalRoundNet); }
  }
  if(minWager === null){ minWager = 0; }

  // "In how many rounds" column of the report
  let maxWagerRounds = 0, minWagerRounds = 0;
  for(let i = 0; i < sRounds; i++){
    if(scope[i].TotalRoundBet === maxWager){ maxWagerRounds++; }
    if(scope[i].TotalRoundBet === minWager){ minWagerRounds++; }
  }

  answers.push({group: 'Wager statistics', field: 'Maximum round wager', value: eur(maxWager), note: 'in ' + maxWagerRounds + (maxWagerRounds === 1 ? ' round' : ' rounds')});
  answers.push({group: 'Wager statistics', field: 'Minimum round wager', value: eur(minWager), note: 'in ' + minWagerRounds + (minWagerRounds === 1 ? ' round' : ' rounds')});
  answers.push({group: 'Wager statistics', field: 'Average round wager', value: eur(sAvgBet)});

  // ---------- Winning statistics ----------
  let maxW = 0, minW = null, sumW = 0;
  for(let i = 0; i < winNets.length; i++){
    if(winNets[i] > maxW){ maxW = winNets[i]; }
    if(minW === null || winNets[i] < minW){ minW = winNets[i]; }
    sumW += winNets[i];
  }
  if(minW === null){ minW = 0; }

  let maxWCount = 0, minWCount = 0;
  for(let i = 0; i < winNets.length; i++){
    if(winNets[i] === maxW){ maxWCount++; }
    if(winNets[i] === minW){ minWCount++; }
  }

  answers.push({group: 'Winning statistics', field: 'Maximum round winning', value: eur(maxW), note: 'in ' + maxWCount + (maxWCount === 1 ? ' round' : ' rounds')});
  answers.push({group: 'Winning statistics', field: 'Minimum round winning', value: eur(minW), note: 'in ' + minWCount + (minWCount === 1 ? ' round' : ' rounds')});
  answers.push({group: 'Winning statistics', field: 'Average round winning', value: eur(winNets.length > 0 ? sumW / winNets.length : 0)});
  answers.push({group: 'Winning statistics', field: 'Average round result',
                value: (sRounds > 0 && sTotalNet >= 0 ? '+' : (sRounds > 0 ? '-' : '')) + eur(sRounds > 0 ? sTotalNet / sRounds : 0),
                neg: sRounds > 0 && sTotalNet < 0});

  // ---------- Rounds ----------
  let pct = function(v){ return sRounds > 0 ? (v / sRounds * 100).toFixed(2) + ' % of all games' : '—'; };
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

  // Game-type scope of the Financial analysis card (All + distinct game types)
  let $sel = $('#fin-game-filter');
  if($sel.length){
    let games = [];
    for(let gi = 0; gi < RoundArry.length; gi++){
      let g = RoundArry[gi].GameType || 'Unknown';
      if(games.indexOf(g) === -1){ games.push(g); }
    }
    games.sort();
    let html = '<option value="__all">All</option>';
    for(let gi = 0; gi < games.length; gi++){
      html += '<option value="' + games[gi].replace(/"/g, '&quot;') + '">' + games[gi] + '</option>';
    }
    $sel.html(html);
    if(games.indexOf(FinGameFilter) === -1){ FinGameFilter = '__all'; }
    $sel.val(FinGameFilter);
  }

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

$(document).off('change.fingame', '#fin-game-filter').on('change.fingame', '#fin-game-filter', function(){
  FinGameFilter = $(this).val() || '__all';
  renderWinnerAnswers();
});

// ================== END WINNER REPORT SUGGESTIONS ===================

// chart mode must be declared BEFORE the first renderBetChart() call below
// (let-variables in the temporal dead zone throw on typeof access)
let ChartMode = 'bet';
let betChart = null;

  $("#bar-chart").remove();

  $(".roulette-container").append('<canvas id="bar-chart" style="height: 168px;" ></canvas>');
  $(".roulette-container2").append('<canvas id="bar-chart2" style="height: 80px;" ></canvas>');

  renderBetChart();

function renderBetChart(){
  let showNet = (typeof ChartMode !== 'undefined') && ChartMode === 'net';
  let chartLabel = showNet ? 'Net Amount (€)' : 'Bet Amount (€)';
  let chartData = RoundArry.map(function(a){ return showNet ? a.TotalRoundNet : a.TotalRoundBet; });
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
                backgroundColor: RoundArry.map(a => a.TotalRoundNet > 0 ? "#81F495" : "#F07D88"), // Green if positive, Red if negative
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
                callbacks: {
                    title: function (tooltipItems) {

                        return `Round Stats`; // Custom title
                    },
                    label: function (tooltipItem) {
                        let index = tooltipItem.dataIndex;
                        let roundId = RoundArry[index].RoundId;
                        let totalBet = RoundArry[index].TotalRoundBet.toFixed(2);
                        let totalNet = RoundArry[index].TotalRoundNet.toFixed(2);

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
  $('.roulette-container').append('<canvas id="bar-chart" style="height: 168px;" ></canvas>');
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
  tip.html(
    '<div class="gap-tip-ids">Round <span class="gap-copy" data-round="' + String(round.RoundId).replace(/"/g, '&quot;') + '">' + round.RoundId + '</span></div>' +
    '<div class="gap-tip-meta">Bet &euro;' + round.TotalRoundBet.toFixed(2) + ' &middot; Net &euro;' + round.TotalRoundNet.toFixed(2) + '</div>' +
    '<div class="gap-tip-hint">select the id with the mouse, right-click &rarr; Copy &middot; click elsewhere to close</div>'
  );
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
}
$(document).off('click.charttip-out').on('click.charttip-out', function(e){
  if($(e.target).closest('#chart-tip').length){ return; }
  chartTipHide();
});











     

     



      

    
     



     
   });


  
 }




 






