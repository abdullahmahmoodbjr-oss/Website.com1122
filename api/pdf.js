const {json,requireUser,getSheetRows,getUserPlan,planAllows,driveClient}=require("./_lib");
module.exports=async function(req,res){
  const user=await requireUser(req,res);if(!user)return;
  if(req.method!=="GET")return json(res,405,{error:"Method not allowed"});
  const pdfId=String(req.query?.pdfId||"");if(!pdfId)return json(res,400,{error:"Missing pdfId"});
  const rows=await getSheetRows("PDFs");const p=rows.find(x=>x.pdfId===pdfId);
  if(!p)return json(res,404,{error:"PDF not found"});
  const plan=(await getUserPlan(user)).plan;const required=(p.requiredPlan||"free").toLowerCase();
  if(!planAllows(plan,required))return json(res,403,{error:"This PDF requires the "+required+" plan."});
  const drive=await driveClient();if(!drive)return json(res,503,{error:"Google Drive is not configured."});
  try{
    const meta=await drive.files.get({fileId:p.fileId,fields:"id,name,mimeType,capabilities(canDownload)"});
    if(meta.data.capabilities&&!meta.data.capabilities.canDownload)return json(res,403,{error:"This file cannot be downloaded through the Drive API."});
    res.statusCode=200;res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Disposition","inline; filename*=UTF-8''"+encodeURIComponent(meta.data.name||p.title+".pdf"));res.setHeader("Cache-Control","private, no-store");
    const file=await drive.files.get({fileId:p.fileId,alt:"media"},{responseType:"stream"});file.data.on("error",e=>{console.error(e);try{res.end()}catch{}});file.data.pipe(res);
  }catch(e){console.error(e);json(res,404,{error:"Drive file could not be opened."})}
};
