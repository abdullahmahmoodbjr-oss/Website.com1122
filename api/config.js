const {json}=require("./_lib");
module.exports=async function(req,res){
  json(res,200,{configured:!!process.env.FIREBASE_API_KEY,appName:process.env.APP_NAME||"NMDCAT Master",
    firebase:{
      apiKey:process.env.FIREBASE_API_KEY||"",authDomain:process.env.FIREBASE_AUTH_DOMAIN||"",
      projectId:process.env.FIREBASE_PROJECT_ID||"",storageBucket:process.env.FIREBASE_STORAGE_BUCKET||"",
      messagingSenderId:process.env.FIREBASE_MESSAGING_SENDER_ID||"",appId:process.env.FIREBASE_APP_ID||""
    }});
};
