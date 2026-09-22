const {json,requireUser,getUserPlan,isAdmin,upsertSheetRow}=require("./_lib");
module.exports=async function(req,res){
  if(req.method!=="GET")return json(res,405,{error:"Method not allowed"});
  const user=await requireUser(req,res);if(!user)return;
  const p=await getUserPlan(user);
  if(!p.row){
    try{await upsertSheetRow("Users",{uid:user.uid,email:user.email||"",name:user.name||"",plan:"free",planExpiresAt:"",createdAt:new Date().toISOString()},"uid")}catch(e){}
  }
  json(res,200,{uid:user.uid,email:user.email||"",name:user.name||"",plan:p.plan,expiresAt:p.expiresAt,admin:isAdmin(user.email)});
};
