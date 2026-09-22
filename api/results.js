const {json,requireUser,getSheetRows,appendSheet,sendMail}=require("./_lib");
module.exports=async function(req,res){
  const user=await requireUser(req,res);if(!user)return;
  if(req.method==="GET"){
    const rows=await getSheetRows("Results");
    const results=rows.filter(r=>r.uid===user.uid).sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt)).slice(0,200);
    return json(res,200,{results});
  }
  if(req.method==="POST"){
    const b=req.body||{};
    if(!b.testId||typeof b.score!=="number"||typeof b.total!=="number")return json(res,400,{error:"Invalid result data"});
    const pct=b.total?Math.round((b.score/b.total)*10000)/100:0;
    const tests=await getSheetRows("Tests");const t=tests.find(x=>x.testId===b.testId);
    const row={uid:user.uid,email:user.email||"",name:user.name||"",testId:b.testId,testTitle:t?.title||b.testId,score:b.score,total:b.total,percentage:pct,timeSpentSec:Number(b.timeSpentSec||0),submittedAt:new Date().toISOString()};
    await appendSheet("Results",Object.values(row));
    let emailSent=false;
    try{emailSent=await sendMail({to:user.email,subject:"NMDCAT result — "+row.testTitle,html:"<div style='font-family:Arial'><h2>"+row.testTitle+"</h2><p>Score: <b>"+row.score+"/"+row.total+"</b> ("+row.percentage+"%)</p><p>Time: "+Math.round(row.timeSpentSec/60)+" minutes</p><p>Your result has been saved in NMDCAT Master.</p></div>"})}catch(e){console.error(e)}
    return json(res,200,{result:row,emailSent});
  }
  return json(res,405,{error:"Method not allowed"});
};
