const {json,requireUser,getSheetRows,appendSheet,sendMail,getUserPlan,planAllows}=require("./_lib");
module.exports=async function(req,res){
  const user=await requireUser(req,res);if(!user)return;
  if(req.method==="GET"){
    const rows=await getSheetRows("Results");
    const results=rows.filter(r=>r.uid===user.uid).sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt)).slice(0,200);
    return json(res,200,{results});
  }
  if(req.method==="POST"){
    const b=req.body||{};
    if(!b.testId||!Array.isArray(b.answers))return json(res,400,{error:"Invalid result data"});
    const tests=await getSheetRows("Tests");
    const t=tests.find(x=>x.testId===b.testId);
    if(!t)return json(res,404,{error:"Test not found"});
    let questions=[];try{questions=JSON.parse(t.questionsJson||"[]")}catch(e){}
    if(!questions.length)return json(res,400,{error:"Test has no questions"});
    const required=String(t.requiredPlan||"free").toLowerCase();
    const plan=(await getUserPlan(user)).plan;
    if(!planAllows(plan,required))return json(res,403,{error:"Your plan does not include this test."});
    if(b.answers.length!==questions.length)return json(res,400,{error:"Answer count does not match the test."});
    let score=0;questions.forEach((q,i)=>{if(Number(b.answers[i])===Number(q.answer))score++});
    const total=questions.length,pct=Math.round((score/total)*10000)/100;
    const spent=Math.max(0,Number(b.timeSpentSec||0));
    const row={uid:user.uid,email:user.email||"",name:user.name||"",testId:b.testId,testTitle:t.title||b.testId,score,total,percentage:pct,timeSpentSec:spent,submittedAt:new Date().toISOString()};
    await appendSheet("Results",Object.values(row));
    let emailSent=false;
    try{emailSent=await sendMail({to:user.email,subject:"NMDCAT result — "+row.testTitle,html:"<div style='font-family:Arial'><h2>"+row.testTitle+"</h2><p>Score: <b>"+row.score+"/"+row.total+"</b> ("+row.percentage+"%)</p><p>Time: "+Math.round(row.timeSpentSec/60)+" minutes</p><p>Your result has been saved in NMDCAT Master.</p></div>"})}catch(e){console.error(e)}
    return json(res,200,{result:row,emailSent});
  }
  return json(res,405,{error:"Method not allowed"});
};
