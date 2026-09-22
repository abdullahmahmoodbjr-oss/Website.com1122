const Stripe=require("stripe");const {json,requireUser,getUserPlan}=require("./_lib");
module.exports=async function(req,res){
  if(req.method!=="POST")return json(res,405,{error:"Method not allowed"});
  const user=await requireUser(req,res);if(!user)return;
  const plan=String(req.body?.plan||"").toLowerCase();
  const priceId=plan==="plus"?process.env.STRIPE_PLUS_PRICE_ID:plan==="pro"?process.env.STRIPE_PRO_PRICE_ID:null;
  if(!priceId||!process.env.STRIPE_SECRET_KEY)return json(res,503,{error:"Stripe is not configured for this plan yet."});
  const existing=(await getUserPlan(user)).plan;if(plan==="plus"&&existing==="pro")return json(res,400,{error:"Your Pro plan already includes Plus access."});
  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
  try{
    const session=await stripe.checkout.sessions.create({
      mode:"subscription",line_items:[{price:priceId,quantity:1}],customer_email:user.email,
      success_url:process.env.STRIPE_SUCCESS_URL||"https://example.com/?payment=success",
      cancel_url:process.env.STRIPE_CANCEL_URL||"https://example.com/?payment=cancelled",
      metadata:{uid:user.uid,email:user.email||"",plan},
      subscription_data:{metadata:{uid:user.uid,email:user.email||"",plan}}
    });
    json(res,200,{url:session.url});
  }catch(e){json(res,500,{error:e.message||"Could not create checkout session"})}
};
