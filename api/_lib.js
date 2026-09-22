const { google } = require("googleapis");
const admin = require("firebase-admin");
const { Resend } = require("resend");

const PLAN_RANK = { free: 0, plus: 1, pro: 2 };

function json(res, status, data){
  res.status(status).setHeader("Content-Type","application/json");
  res.end(JSON.stringify(data));
}
function base64Json(value){
  return JSON.parse(Buffer.from(value,"base64").toString("utf8"));
}
function firebaseApp(){
  if(admin.apps.length) return admin.app();
  const projectId=process.env.FIREBASE_PROJECT_ID;
  const clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey=(process.env.FIREBASE_PRIVATE_KEY||"").replace(/\\n/g,"\n");
  if(!projectId||!clientEmail||!privateKey) return null;
  return admin.initializeApp({credential:admin.credential.cert({projectId,clientEmail,privateKey})});
}
async function requireUser(req,res){
  const header=req.headers.authorization||"";
  const token=header.startsWith("Bearer ")?header.slice(7):null;
  const app=firebaseApp();
  if(!token||!app) return null, json(res,401,{error:"Authentication is not configured."});
  try{return await admin.auth().verifyIdToken(token)}catch(e){json(res,401,{error:"Authentication failed."});return null;}
}
function googleAuth(){
  if(!process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64) return null;
  const credentials=base64Json(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64);
  return new google.auth.GoogleAuth({credentials,scopes:[
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly"
  ]});
}
async function sheetsClient(){
  const auth=googleAuth(); return auth?google.sheets({version:"v4",auth}):null;
}
async function driveClient(){
  const auth=googleAuth(); return auth?google.drive({version:"v3",auth}):null;
}
async function getSheetRows(tab){
  const sheets=await sheetsClient();
  if(!sheets||!process.env.GOOGLE_SHEET_ID) return [];
  const out=await sheets.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:tab+"!A:Z"});
  const rows=out.data.values||[];
  if(!rows.length)return [];
  const headers=rows[0];
  return rows.slice(1).map((row,i)=>({rowNumber:i+2,...Object.fromEntries(headers.map((h,j)=>[h,row[j]??""]))}));
}
async function upsertSheetRow(tab, row, keyField){
  const sheets=await sheetsClient();
  if(!sheets||!process.env.GOOGLE_SHEET_ID) throw new Error("Google Sheets is not configured.");
  const rows=await getSheetRows(tab); const headers=Object.keys(row);
  const match=rows.find(x=>String(x[keyField]||"")===String(row[keyField]||""));
  const values=headers.map(h=>row[h]??"");
  if(match){
    await sheets.spreadsheets.values.update({
      spreadsheetId:process.env.GOOGLE_SHEET_ID,
      range:tab+"!A"+match.rowNumber,
      valueInputOption:"USER_ENTERED",
      requestBody:{values:[values]}
    });
  }else{
    await sheets.spreadsheets.values.append({
      spreadsheetId:process.env.GOOGLE_SHEET_ID,
      range:tab+"!A:Z",
      valueInputOption:"USER_ENTERED",
      insertDataOption:"INSERT_ROWS",
      requestBody:{values:[values]}
    });
  }
}
async function appendSheet(tab, values){
  const sheets=await sheetsClient();
  if(!sheets||!process.env.GOOGLE_SHEET_ID) throw new Error("Google Sheets is not configured.");
  await sheets.spreadsheets.values.append({
    spreadsheetId:process.env.GOOGLE_SHEET_ID,
    range:tab+"!A:Z",
    valueInputOption:"USER_ENTERED",
    insertDataOption:"INSERT_ROWS",
    requestBody:{values:[values]}
  });
}
async function getUserPlan(decoded){
  const email=decoded.email||"";
  const rows=await getSheetRows("Users");
  const found=rows.find(r=>r.uid===decoded.uid||String(r.email).toLowerCase()===email.toLowerCase());
  if(!found) return {plan:"free",expiresAt:null,row:null};
  let plan=String(found.plan||"free").toLowerCase();
  const expires=found.planExpiresAt?new Date(found.planExpiresAt):null;
  if(expires&&!Number.isNaN(expires.getTime())&&expires.getTime()<Date.now()) plan="free";
  return {plan:PLAN_RANK[plan]!==undefined?plan:"free",expiresAt:found.planExpiresAt||null,row:found};
}
function isAdmin(email){
  return String(process.env.ADMIN_EMAILS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean).includes(String(email||"").toLowerCase());
}
async function sendMail({to,subject,html}){
  if(!process.env.RESEND_API_KEY||!process.env.FROM_EMAIL) return false;
  const resend=new Resend(process.env.RESEND_API_KEY);
  const {error}=await resend.emails.send({from:process.env.FROM_EMAIL,to,subject,html});
  if(error) throw error;
  return true;
}
function planAllows(userPlan,requiredPlan){
  return PLAN_RANK[userPlan||"free"]>=PLAN_RANK[requiredPlan||"free"];
}
module.exports={json,requireUser,getSheetRows,upsertSheetRow,appendSheet,getUserPlan,isAdmin,sendMail,planAllows,PLAN_RANK,driveClient,sheetsClient,googleAuth};
