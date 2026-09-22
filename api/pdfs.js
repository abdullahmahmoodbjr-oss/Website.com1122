const {json,requireUser,getSheetRows,planAllows,getUserPlan}=require("./_lib");
module.exports=async function(req,res){
  if(req.method!=="GET")return json(res,405,{error:"Method not allowed"});
  const user=await requireUser(req,res);if(!user)return;
  const p=await getUserPlan(user);
  const rows=await getSheetRows("PDFs");
  const pdfs=rows.filter(r=>r.pdfId&&r.title).map(r=>({pdfId:r.pdfId,title:r.title,requiredPlan:(r.requiredPlan||"free").toLowerCase(),description:r.description||"",locked:!planAllows(p.plan,(r.requiredPlan||"free").toLowerCase())}));
  json(res,200,{pdfs});
};
