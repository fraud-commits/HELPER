
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  $('.Totalbet').text("€ " + TotalBet.toLocaleString('en-US', {
    minimumFractionDigits: 2
  }));
  $('.Totalnet').text("€ " + TotalNet.toLocaleString('en-US', {
    minimumFractionDigits: 2
  }));
  $('.Margin').text(Margin.toFixed(2) + "%");
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

function BreakCounter(){

  // console.log("start index " + indexStart)
//   console.log("end index "+ indexNext)

  //console.log(worksheetData[0][UserId])

  for(i = 0; i < RoundArry.length; i++){

    let indexStart = i;
    let indexNext = 0;
      
    if(i == RoundArry.length - 1){

      indexNext =  RoundArry.length -1


    }else{
      indexNext = i + 1
    }
    
    var startTime=moment(RoundArry[indexStart].RoundTime, "DD-MM-YYYY HH:mm:ss a");
    var endTime=moment(RoundArry[indexNext].RoundTime, "DD-MM-YYYY HH:mm:ss a");
    var duration = moment.duration(endTime.diff(startTime));
    var hours = parseInt(duration.asHours());
    var minutes = parseInt(duration.asMinutes())-hours*60;

 
 //    console.log((hours + ' hour and '+ minutes+' minutes.'))
       
   //    var result = endTime.diff(startTime, 'hours') + " Hrs and " +     
   //                     endTime.diff(startTime, 'minutes') + " Mns";


 //SKIP
      if(hours == 0 && minutes > 2 && minutes <= 10 && RoundArry[indexStart].RoundId !== RoundArry[indexNext].RoundId){
        RoundSkipp += 1;
        $('.skipcnt').text("format");
        $('.break-Heat-Map').append('<div class="badge-sqr badge-skip-c"></div>')
 //SHORT        
      }else if(hours == 0 && minutes > 10 && minutes <= 30 &&  RoundArry[indexStart].RoundId !== RoundArry[indexNext].RoundId){
        ShortBreak += 1;
        $('.break-Heat-Map').append('<div class="badge-sqr badge-short-c"></div>')
 //LONG        
      }else if(hours >= 1 || minutes >= 31 &&  RoundArry[indexStart].RoundId !== RoundArry[indexNext].RoundId){
        LongBreak += 1;
        $('.break-Heat-Map').append('<div class="badge-sqr badge-long-c"></div>')
 // Sequential        
      }else if( RoundArry[indexStart].RoundId !== RoundArry[indexNext].RoundId || indexStart == 0){
        SequentialGame += 1;
        $('.break-Heat-Map').append('<div class="badge-sqr badge-sql-c"></div>')
      }
 
      
   $('.skipcnt').text(RoundSkipp);
  $('.shortcnt').text(ShortBreak);
  $('.longcnt').text(LongBreak);
  $('.seqcnt').text(SequentialGame);
 
  let indexID = i + 3
  let CurrentSqe = $(".badge-sqr")[indexID];



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
 }
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
      <td>` + DealerArry[i].TotalNet.toFixed(2) + `</td>
      <td>`+ DealerArry[i].RoundCount +` </td>
      <td>`+ (DealerArry[i].TotalNet.toFixed(2) /  DealerArry[i].TotalBet.toFixed(2) * 100).toFixed(2) +` </td>
      </tr>
      `
    )



  }

  $('.table-DealerTop').DataTable()
  $('.table-roundTop').DataTable()

}

function RoundTop(x){

  $(".RoundTop").append(`
  <tr>
    <td>` + RoundArry[x].RoundId + `</td>
    <td>` + RoundArry[x].TotalRoundBet.toFixed(2) + `</td>
    <td>` + RoundArry[x].TotalRoundNet.toFixed(2) + `</td>
    <td>`+ (RoundArry[x].TotalRoundNet.toFixed(2) /  RoundArry[x].TotalRoundBet.toFixed(2) * 100).toFixed(2)+` % </td>
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
                                                <td>` + BetPositionArry[i].TotalNet.toFixed(2) +`</td>
                                                <td>`+ (BetPositionArry[i].TotalNet.toFixed(2) /  BetPositionArry[i].TotalBet.toFixed(2) * 100).toFixed(2)+` % </td>
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
 // $('.table-bettop').DataTable()
 $('.table-bettop').DataTable({
  footerCallback: function (row, data, start, end, display) {
      var api = this.api();

      // Remove the formatting to get integer data for summation
      var intVal = function (i) {
          return typeof i === 'string' ? i.replace(/[\$,]/g, '') * 1 : typeof i === 'number' ? i : 0;
      };

      // Total over all pages
      total = api
          .column(2)
          .data()
          .reduce(function (a, b) {
              return intVal(a) + intVal(b);
          }, 0);

      // Total over this page
      pageTotal = api
          .column(2, { page: 'current' })
          .data()
          .reduce(function (a, b) {
              return intVal(a) + intVal(b);
          }, 0);

      // Update footer
      $(api.column(4).footer()).html(' € ' + pageTotal.toFixed(2) + ' ( € ' + total.toFixed(2) + ' Total)');

  },
});

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
  let skipPct = pct(RoundSkipp, rounds);
  if(skipPct >= 30){
    add('danger', '<b>Frequently skips game rounds:</b> ' + RoundSkipp + ' skip(s) (' + skipPct.toFixed(0) +
        '%) — possibly waiting for favorable conditions.');
  }else if(skipPct >= 15){
    add('warning', 'Player skips rounds: ' + RoundSkipp + ' skip(s), ' + skipPct.toFixed(0) + '% of the session.');
  }

  // ---- 5. Fragmented session (manual: "playing in short bursts with breaks
  //         between — may suggest strategic timing") ----
  let breaks = ShortBreak + LongBreak;
  if(breaks >= 3 && rounds < 30){
    add('warning', 'Session played in short bursts: ' + breaks + ' break(s) over ' + rounds +
        ' rounds — may suggest strategic timing.');
  }

  // ---- 6. Opposite betting (manual §9): opposing positions in one round ----
  let pairs = [['banker','player'], ['red','black'], ['even','odd'], ['high','low'], ['1-18','19-36'], ['manque','passe']];
  let roundPos = {};
  for(let i = 0; i < worksheetData.length; i++){
    let rid = worksheetData[i][RoundID].formattedValue;
    let pos = worksheetData[i][BetPosition].formattedValue.toLowerCase();
    if(!roundPos[rid]){ roundPos[rid] = []; }
    roundPos[rid].push(pos);
  }
  let oppRounds = 0;
  let oppPair = '';
  for(let rid in roundPos){
    for(let p = 0; p < pairs.length; p++){
      let hasA = roundPos[rid].some(pos => pos.indexOf(pairs[p][0]) !== -1);
      let hasB = roundPos[rid].some(pos => pos.indexOf(pairs[p][1]) !== -1);
      if(hasA && hasB){
        oppRounds++;
        oppPair = pairs[p][0].charAt(0).toUpperCase() + pairs[p][0].slice(1) + ' / ' +
                  pairs[p][1].charAt(0).toUpperCase() + pairs[p][1].slice(1);
        break;
      }
    }
  }
  if(oppRounds >= 5 || oppRounds >= rounds * 0.25 && oppRounds >= 2){
    add('danger', '<b>Opposite betting:</b> opposing positions (' + oppPair + ') in ' + oppRounds +
        ' round(s) — possible balance laundering / bonus abuse.');
  }else if(oppRounds >= 2){
    add('warning', 'Opposite betting: both sides (' + oppPair + ') covered in ' + oppRounds + ' round(s).');
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




 






