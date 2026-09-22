const {json,requireUser,getSheetRows,isAdmin,upsertSheetRow}=require("./_lib");
module.exports=async function(req,res){
  const user=await requireUser(req,res);if(!user)return;
  if(!isAdmin(user.email))return json(res,403,{error:"Admin access required"});
  if(req.method==="GET"){
    const [tests,pdfs,users,payments]=await Promise.all([getSheetRows("Tests"),getSheetRows("PDFs"),getSheetRows("Users"),getSheetRows("Payments")]);
    return json(res,200,{tests:tests.slice(-50),pdfs:pdfs.slice(-50),users:users.slice(-50),payments:payments.slice(-50)});
  }
  if(req.method==="POST"){
    const {action,row}=req.body||{};
    if(!row)return json(res,400,{error:"Missing row"});
    if(action==="upsertTest"){
      const normalized={testId:row.testId,title:row.title,subject:row.subject||"",timeMinutes:row.timeMinutes||45,requiredPlan:row.requiredPlan||"free",isFree:String(row.isFree)==="true",questionsJson:row.questionsJson};
      await upsertSheetRow("Tests",normalized,"testId");return json(res,200,{ok:true});
    }
    if(action==="upsertPdf"){
      const normalized={pdfId:row.pdfId,title:row.title,fileId:row.fileId,requiredPlan:row.requiredPlan||"free",description:row.description||""};
      await upsertSheetRow("PDFs",normalized,"pdfId");return json(res,200,{ok:true});
    }
    return json(res,400,{error:"Unknown admin action"});
  }
  json(res,405,{error:"Method not allowed"});
};
