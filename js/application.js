
let unregisterFilterEventListener = null;
let unregisterMarkSelectionEventListener = null;
let worksheet = null;
let worksheetName = null;
let categoryColumnNumber = null;
let valueColumnNumber = null;





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

   

   worksheet.getSummaryDataAsync().then(function (sumdata) {

     // --- No player selected: show placeholder instead of the dashboard ---
     if (!sumdata.data || sumdata.data.length === 0) {
       $('#dashboard-content').hide();
       $('#empty-state').css('display', 'flex');
       return;
     }
     $('#empty-state').hide();
     $('#dashboard-content').show();

     $(".Break-Heat-Map").empty();
     if ($.fn.DataTable.isDataTable('.table-DealerTop')) { $('.table-DealerTop').DataTable().clear().destroy(); }
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
           let OppRoundsCount = 0;
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
  $('.margin-bar').css('width', Margin.toFixed(2) + "%");




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
      RoundTime: worksheetData[indexStart][RoundTime].formattedValue

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
  let ids = '';
  if(from){ ids += '<button type="button" class="gap-copy" data-round="' + from + '">' + from + '</button>'; }
  if(to){ ids += ' <span class="gap-arrow">→</span> <button type="button" class="gap-copy" data-round="' + to + '">' + to + '</button>'; }
  tip.html(
    '<div class="gap-tip-ids">' + ids + '</div>' +
    '<div class="gap-tip-meta">' + meta + '</div>' +
    '<div class="gap-tip-hint">click a round id to copy · click the square to fix</div>'
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
    e.stopPropagation();
    let txt = $(this).attr('data-round') || '';
    let $btn = $(this);
    function done(){
      $btn.addClass('copied');
      setTimeout(function(){ $btn.removeClass('copied'); }, 1000);
    }
    // clipboard is blocked (e.g. embedded Tableau browser):
    // swap the button for a pre-selected field so the analyst can press Ctrl+C
    function manualCopy(){
      let $input = $('<input class="gap-manual" readonly="readonly" value="' + txt.replace(/"/g, '&quot;') + '">');
      $btn.replaceWith($input);
      $input.focus();
      try{ $input[0].setSelectionRange(0, txt.length); }catch(err){}
      $('#gap-tip .gap-tip-hint').text('clipboard is blocked — press Ctrl+C, then click elsewhere');
    }
    function fallback(){
      let ok = false, ta = null;
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
        try{ ta.setSelectionRange(0, txt.length); }catch(err2){}
        ok = document.execCommand('copy');
      }catch(err){ ok = false; }
      try{ if(ta){ document.body.removeChild(ta); } }catch(err3){}
      if(ok){ done(); } else { manualCopy(); }
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(done, fallback);
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
  let cadence = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : 1.5; // default: one round per 1.5 min
  if(cadence <= 0){ cadence = 1.5; }

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


function BetProgression (){

  let TotalBet;

  for (let i = 0; i < RoundArry.length; i++ ){

    TotalBet += RoundArry[i].TotalRoundBet
    let cur = i;
    let next;
    let nextn;

    if(i == RoundArry.length - 1){

      next =  RoundArry.length -1
      nextn  = RoundArry.length -2

    }else{
      next = i + 1
      nextn = i + 2
    }

    if (RoundArry[cur].TotalRoundBet == RoundArry[next].TotalRoundBet){
      same += 1; //Flat
    }else if(RoundArry[cur].TotalRoundBet < RoundArry[next].TotalRoundBet && RoundArry[cur].TotalRoundNet > 0){
      up += 1; // Positive
    }else if (RoundArry[cur].TotalRoundNet <= 0 && RoundArry[cur].TotalRoundBet * 2 <= RoundArry[next].TotalRoundBet){
    
      if(RoundArry[next].TotalRoundNet <= 0 && RoundArry[next].TotalRoundBet * 2 <= RoundArry[nextn].TotalRoundBet){
        martingeil += 1; // Martingale
      }else{
        negativ += 1; // Negative
      }
        
      }
    
    else{
      chaotic += 1; // chaotic
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

  for(x = 0; x < RoundArry.length; x++){
    RoundTop(x)
    let element = DealerArry.find(e => e.DealerName === RoundArry[x].DealerName);
if (element ) {
  element.RoundCount += 1;
}
  }

  for(i = 0; i < DealerArry.length; i++){

    $(".DealerTop").append(`
    <tr>
      <td>` + DealerArry[i].DealerName + `</td>
      <td>` + DealerArry[i].TotalBet.toFixed(2) + `</td>
      <td` + negClass(DealerArry[i].TotalNet) + `>` + DealerArry[i].TotalNet.toFixed(2) + `</td>
      <td>`+ DealerArry[i].RoundCount +` </td>
      <td` + negClass(DealerArry[i].TotalNet) + `>`+ (DealerArry[i].TotalNet.toFixed(2) /  DealerArry[i].TotalBet.toFixed(2) * 100).toFixed(2) +` </td>
      </tr>
      `
    )



  }

  $('.table-DealerTop').DataTable()
  $('.table-roundTop').DataTable()

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

  let $list = $('.findings-list');
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
  let samePct   = pct(same, rounds);
  let negPct    = pct(negativ + martingeil, rounds);
  let upPct     = pct(up, rounds);
  let chaosPct  = pct(chaotic, rounds);

  if(rounds >= 5 && maxRound && avgBet > 0 && maxRound.TotalRoundBet >= 3 * avgBet){
    add('warning', '<b>Bet ramp:</b> sudden sharp bet increase up to ' + eur(maxRound.TotalRoundBet) +
        ' (' + (maxRound.TotalRoundBet / avgBet).toFixed(1) + '× the average, round ' + maxRound.RoundId +
        ') — may indicate advantage play.');
  }
  if(rounds >= 15 && chaosPct >= 60){
    add('warning', '<b>Erratic strategy:</b> bet sizing looks random in ' + chaosPct.toFixed(0) +
        '% of rounds — could indicate testing, scripting or manipulation.');
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
}

generateFindings();

// ========================= END KEY FINDINGS =========================

// ==================== WINNER REPORT SUGGESTIONS =====================
// Picks the exact dropdown options from the Winner Report form and
// computes the numeric report fields, so the analyst can copy them 1:1.

let lastWinnerAnswers = [];

// ---- Opposite betting (silent check, only on games where it can occur) ----
// Applicable only if the session contains bet positions that belong to a known
// opposing pair (e.g. Banker/Player, Red/Black). Exact position match — side
// bets like "Banker Bonus" / "Player Bonus" do NOT count as opposite betting.
let OppApplicable = false;
const OPP_PAIRS = [['banker','player'], ['red','black'], ['even','odd'], ['high','low'], ['1-18','19-36'], ['manque','passe']];

function analyzeOppositeBetting(){
  OppRoundsCount = 0;
  OppApplicable = false;

  let roundPos = {};
  let positionSet = {};
  for(let i = 0; i < worksheetData.length; i++){
    let rid = worksheetData[i][RoundID].formattedValue;
    let pos  = worksheetData[i][BetPosition].formattedValue.trim().toLowerCase();
    if(!roundPos[rid]){ roundPos[rid] = []; }
    roundPos[rid].push(pos);
    positionSet[pos] = true;
  }

  // run only for games where opposite betting is structurally possible
  // (session must contain at least one side of a known opposing pair)
  for(let p = 0; p < OPP_PAIRS.length; p++){
    if(positionSet[OPP_PAIRS[p][0]] || positionSet[OPP_PAIRS[p][1]]){ OppApplicable = true; break; }
  }
  if(!OppApplicable){ return; }

  for(let rid in roundPos){
    for(let p = 0; p < OPP_PAIRS.length; p++){
      if(roundPos[rid].indexOf(OPP_PAIRS[p][0]) !== -1 && roundPos[rid].indexOf(OPP_PAIRS[p][1]) !== -1){
        OppRoundsCount++;
        break;
      }
    }
  }
}

function computeWinnerAnswers(){

  let rounds  = RoundArry.length;
  let answers = [];
  lastWinnerAnswers = answers;

  let p = function(v){ return rounds > 0 ? v / rounds * 100 : 0; };
  function eur(v){
    return '€' + Math.abs(v).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  }

  // ---------- Betting progression (exact report options) ----------
  let samePct  = p(same);
  let negPct   = p(negativ + martingeil);
  let upPct2   = p(up);
  let chaosPct = p(chaotic);

  let prog;
  if(rounds <= 1){ prog = 'Other one'; }
  else if(samePct >= 70){ prog = 'Flat wagers'; }
  else if(samePct >= 50){ prog = 'Mainly flat wagers'; }
  else if(martingeil >= 2 && negPct >= 50){ prog = 'Martingale betting system'; }
  else if(negPct >= 70){ prog = 'Negative progression'; }
  else if(negPct >= 50){ prog = 'Mainly negative betting progression'; }
  else if(negPct >= 30 && samePct >= 30){ prog = 'Negative progression, however at some passages flat'; }
  else if(upPct2 >= 85){ prog = 'Positive progression'; }
  else if(upPct2 >= 60){ prog = 'Progressive betting'; }
  else if(chaosPct >= 85){ prog = 'Chaotic'; }
  else if(chaosPct >= 60 && samePct >= 20 && negPct >= 20){ prog = 'Chaotic, however at some passages flat wagers and at some passages negative progressions'; }
  else if(chaosPct >= 60 && samePct >= 20){ prog = 'Chaotic, however at some passages flat wagers'; }
  else if(chaosPct >= 60 && negPct >= 20){ prog = 'Chaotic, at some passages negative progression is selected'; }
  else if(chaosPct >= 50){ prog = 'Mainly chaotic'; }
  else{ prog = 'Chaotic wagers, regardless to previous game outcome'; }

  // Bet ramp => "Ramping ( Card counter )" only for a clear late spike
  let progWhy;
  if(rounds <= 1){ progWhy = 'only 1 round in the session'; }
  else{
    progWhy = 'flat ' + samePct.toFixed(0) + '% · negative ' + negPct.toFixed(0) + '% · positive ' + upPct2.toFixed(0) + '% · chaotic ' + chaosPct.toFixed(0) + '% of ' + rounds + ' rounds';
  }
  if(rounds >= 10 && avgBetSafe() > 0){
    let maxI = 0;
    for(let i = 0; i < rounds; i++){ if(RoundArry[i].TotalRoundBet > RoundArry[maxI].TotalRoundBet){ maxI = i; } }
    if(RoundArry[maxI].TotalRoundBet >= 4 * avgBetSafe() && maxI > rounds / 2 && prog.indexOf('Chaotic') === 0){
      prog = 'Ramping ( Card counter )';
      progWhy = 'max round bet ' + eur(RoundArry[maxI].TotalRoundBet) + ' is ' + (RoundArry[maxI].TotalRoundBet / avgBetSafe()).toFixed(1) + '× the average (' + eur(avgBetSafe()) + '), round ' + RoundArry[maxI].RoundId + ' in the 2nd half of the session';
    }
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

  // ---------- Signs of opposite betting (only for games where it applies) ----------
  analyzeOppositeBetting();
  if(OppApplicable){
    let oppYes = OppRoundsCount > 0;
    answers.push({group: 'Report dropdowns', field: 'Signs of opposite betting?',
      value: oppYes ? 'Yes' : 'No',
      why: oppYes
        ? OppRoundsCount + ' round(s) with opposing bets on both sides (exact position match)'
        : 'no same-round opposing bets by this player in ' + rounds + ' rounds; cross-account check (IP report) still required'});
  }

  // ---------- Wager statistics ----------
  let maxWager = 0, minWager = null;
  let winNets = [];
  for(let i = 0; i < rounds; i++){
    let b = RoundArry[i].TotalRoundBet;
    if(b > maxWager){ maxWager = b; }
    if(minWager === null || b < minWager){ minWager = b; }
    if(RoundArry[i].TotalRoundNet > 0){ winNets.push(RoundArry[i].TotalRoundNet); }
  }
  if(minWager === null){ minWager = 0; }

  // "In how many rounds" column of the report
  let maxWagerRounds = 0, minWagerRounds = 0;
  for(let i = 0; i < rounds; i++){
    if(RoundArry[i].TotalRoundBet === maxWager){ maxWagerRounds++; }
    if(RoundArry[i].TotalRoundBet === minWager){ minWagerRounds++; }
  }

  answers.push({group: 'Wager statistics', field: 'Maximum round wager', value: eur(maxWager), note: 'in ' + maxWagerRounds + (maxWagerRounds === 1 ? ' round' : ' rounds')});
  answers.push({group: 'Wager statistics', field: 'Minimum round wager', value: eur(minWager), note: 'in ' + minWagerRounds + (minWagerRounds === 1 ? ' round' : ' rounds')});
  answers.push({group: 'Wager statistics', field: 'Average round wager', value: eur(avgBetSafe())});

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
                value: (rounds > 0 && TotalNet >= 0 ? '+' : (rounds > 0 ? '-' : '')) + eur(rounds > 0 ? TotalNet / rounds : 0),
                neg: rounds > 0 && TotalNet < 0});

  // ---------- Rounds ----------
  let pct = function(v){ return rounds > 0 ? (v / rounds * 100).toFixed(2) + ' % of all games' : '—'; };
  answers.push({group: 'Rounds', field: 'Winning rounds', value: String(WinRoundCnt), note: pct(WinRoundCnt)});
  answers.push({group: 'Rounds', field: 'Losing rounds',  value: String(LossRoundCnt), note: pct(LossRoundCnt)});
  answers.push({group: 'Rounds', field: 'Even round',     value: String(TieRoundCnt), note: pct(TieRoundCnt)});

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
          '<div class="ra-col-head"><span class="ra-col-field">' + a.field + '</span>' +
          '<button type="button" class="ra-copy" data-i="' + i + '" title="Copy"><i class="bi bi-clipboard"></i></button></div>' +
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

  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done, function(){ fallbackCopy(); });
  }else{
    fallbackCopy();
  }

  function fallbackCopy(){
    let ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try{ document.execCommand('copy'); done(); }catch(e){}
    document.body.removeChild(ta);
  }
});

renderWinnerAnswers();

// ================== END WINNER REPORT SUGGESTIONS ===================

  $("#bar-chart").remove();

  $(".roulette-container").append('<canvas id="bar-chart" style="height: 168px;" ></canvas>');
  $(".roulette-container2").append('<canvas id="bar-chart2" style="height: 80px;" ></canvas>');

new Chart(document.getElementById("bar-chart"), {
    type: 'bar',
    data: {
        labels: RoundArry.map(a => a.RoundId),
        datasets: [
            {
                barPercentage: 0.9,
                categoryPercentage: 1,
                label: "Bet Amount (€)",
                backgroundColor: RoundArry.map(a => a.TotalRoundNet > 0 ? "#81F495" : "#F07D88"), // Green if positive, Red if negative
                data: RoundArry.map(a => a.TotalRoundBet) // Bars represent TotalRoundBet
            }
        ]
    },
    options: {
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











     

     



      

    
     



     
   });


  
 }




 






