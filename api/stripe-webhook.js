const Stripe=require("stripe");const {appendSheet,upsertSheetRow,sendMail}=require("./_lib");
module.exports.config={api:{bodyParser:false}};
function rawBody(req){return new Promise((resolve,reject)=>{const chunks=[];req.on("data",c=>chunks.push(c));req.on("end",()=>resolve(Buffer.concat(chunks)));req.on("error",reject)})}
module.exports=async function(req,res){
  if(req.method!=="POST")return res.status(405).end("Method not allowed");
  if(!process.env.STRIPE_SECRET_KEY||!process.env.STRIPE_WEBHOOK_SECRET)return res.status(503).end("Stripe webhook is not configured");
  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
  let event;try{event=stripe.webhooks.constructEvent(await rawBody(req),req.headers["stripe-signature"],process.env.STRIPE_WEBHOOK_SECRET)}catch(e){return res.status(400).end("Invalid signature")}
  try{
    if(event.type==="checkout.session.completed"){
      const session=event.data.object;const meta=session.metadata||{};const plan=meta.plan||"free";let expiresAt="";
      if(session.subscription){try{const sub=await stripe.subscriptions.retrieve(session.subscription);if(sub.current_period_end)expiresAt=new Date(sub.current_period_end*1000).toISOString()}catch(e){console.error(e)}}
      const row=[session.id,meta.uid||"",meta.email||session.customer_email||"",plan,"subscription",session.amount_total||"",session.currency||"",event.type,expiresAt,new Date().toISOString()];
      await appendSheet("Payments",row);
      if(meta.uid)await upsertSheetRow("Users",{uid:meta.uid,email:meta.email||session.customer_email||"",name:"",plan,planExpiresAt:expiresAt,createdAt:new Date().toISOString()},"uid");
      if(meta.email)try{await sendMail({to:meta.email,subject:"NMDCAT plan activated — "+plan.toUpperCase(),html:"<div style='font-family:Arial'><h2>Plan activated</h2><p>Your <b>"+plan.toUpperCase()+"</b> membership is now active.</p>"+(expiresAt?"<p>Current period ends: "+new Date(expiresAt).toLocaleString()+"</p>":"")+"<p>Thank you for using NMDCAT Master.</p></div>"})}catch(e){console.error(e)}
    }
    res.status(200).json({received:true});
  }catch(e){console.error(e);res.status(500).json({error:"Webhook processing failed"})}
};
