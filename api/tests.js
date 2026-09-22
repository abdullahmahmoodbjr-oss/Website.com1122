const {json,getSheetRows,requireUser,planAllows}=require("./_lib");
const demo=[{testId:"demo-biology",title:"Biology Rapid Revision",subject:"Biology",timeMinutes:10,requiredPlan:"free",isFree:true,questions:[
  {q:"Which cell type secretes antibodies?",options:["T helper cell","Plasma cell","Macrophage","Neutrophil"],answer:1,explanation:"Plasma cells are differentiated B cells that secrete antibodies."},
  {q:"Pepsin works best in which environment?",options:["Strongly acidic","Neutral","Strongly alkaline","Dry"],answer:0,explanation:"Pepsin functions in the acidic stomach."},
  {q:"The SI unit of frequency is:",options:["Joule","Newton","Hertz","Watt"],answer:2,explanation:"Frequency is measured in hertz (s^-1)."}
]}];
module.exports=async function(req,res){
  if(req.method!=="GET")return json(res,405,{error:"Method not allowed"});
  const user=await requireUser(req,res);if(!user)return;
  let rows=await getSheetRows("Tests");
  let tests=rows.map(r=>{let q=[];try{q=JSON.parse(r.questionsJson||"[]")}catch(e){}return {...r,questions:q,timeMinutes:Number(r.timeMinutes||45),requiredPlan:String(r.requiredPlan||"free").toLowerCase(),isFree:String(r.isFree)==="true"}}).filter(t=>t.testId&&t.questions.length);
  if(!tests.length)tests=demo;
  tests=tests.filter(t=>planAllows((user&&"free")||"free",t.requiredPlan)||t.requiredPlan!=="free");
  json(res,200,{tests});
};
