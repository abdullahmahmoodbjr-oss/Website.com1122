let auth=null,provider=null,currentUser=null,currentPlan="free",tests=[],currentTest=null,currentIndex=0,answers=[],remainingSec=0,timerId=null,submitting=false;

const $=id=>document.getElementById(id);
const rank={free:0,plus:1,pro:2};
const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove("show"),2600)}
function allowed(required){return (rank[currentPlan]??0)>=(rank[String(required||"free").toLowerCase()]??0)}
async function api(path,opts={}){
  const o={...opts,headers:{...(opts.headers||{})}};
  if(opts.body&&!o.headers["Content-Type"])o.headers["Content-Type"]="application/json";
  if(currentUser){o.headers.Authorization="Bearer "+await currentUser.getIdToken()}
  const r=await fetch(path,o);let d={};try{d=await r.json()}catch{}
  if(!r.ok)throw new Error(d.error||"Request failed");return d;
}
function showView(name){
  if(["results","pdfs"].includes(name)&&!currentUser){toast("Sign in first");return}
  document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));
  const v=$(name);if(!v)return;
  v.classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  if(name==="tests")loadTests();if(name==="results")loadResults();if(name==="pdfs")loadPdfs();if(name==="admin")loadAdmin();
}
window.showView=showView;

async function initFirebase(){
  try{
    const cfg=await fetch("/api/config").then(r=>r.json());
    if(!cfg.configured){toast("Add Firebase configuration in Vercel to enable sign-in.");return}
    const f=window.__firebase;const app=f.initializeApp(cfg.firebase);auth=f.getAuth(app);provider=new f.GoogleAuthProvider();
    try{await f.getRedirectResult(auth)}catch(e){console.warn(e)}
    f.onAuthStateChanged(auth,async user=>{
      currentUser=user;$("loginBtn").classList.toggle("hidden",!!user);$("logoutBtn").classList.toggle("hidden",!user);
      if(!user){currentPlan="free";$("planBadge").textContent="Free";$("planBadge").className="badge neutral";$("authStatus").textContent="Not signed in";$("authStatus").className="badge neutral";$("adminNav").classList.add("hidden");$("userName").textContent="Guest";$("userEmail").textContent="No account connected";$("avatar").textContent="?";return}
      $("avatar").textContent=(user.displayName||user.email||"?").slice(0,1).toUpperCase();$("userName").textContent=user.displayName||"Student";$("userEmail").textContent=user.email||"";$("authStatus").textContent="Signed in";$("authStatus").className="badge plus";
      try{const me=await api("/api/me");currentPlan=me.plan||"free";setPlanBadge();$("adminNav").classList.toggle("hidden",!me.admin)}catch(e){toast(e.message)}
      const p=new URLSearchParams(location.search);if(p.get("payment")==="success"){$("paymentNotice").textContent="Payment completed. Your plan is activated after Stripe webhook verification.";$("paymentNotice").classList.remove("hidden");history.replaceState({},document.title,location.pathname)}
    });
  }catch(e){toast(e.message)}
}
function setPlanBadge(){$("planBadge").textContent=currentPlan[0].toUpperCase()+currentPlan.slice(1);$("planBadge").className="badge "+(currentPlan==="pro"?"pro":currentPlan==="plus"?"plus":"neutral")}
async function login(){if(!auth){toast("Firebase is not ready");return}await window.__firebase.signInWithRedirect(auth,provider)}
async function logout(){await window.__firebase.signOut(auth);showView("home");toast("Signed out")}
window.login=login;window.logout=logout;

async function loadTests(){
  const box=$("testGrid");box.innerHTML="<div class='card'>Loading tests…</div>";
  try{tests=(await api("/api/tests")).tests||[];if(!tests.length){box.innerHTML="<div class='card'>No tests are configured yet.</div>";return}
    box.innerHTML=tests.map(t=>"<article class='card test-card'><div class='meta'><span class='badge "+(t.requiredPlan==="pro"?"pro":t.requiredPlan==="plus"?"plus":"neutral")+"'>"+escapeHtml(t.requiredPlan)+"</span><span class='muted'>"+Number(t.timeMinutes||0)+" min</span></div><h3>"+escapeHtml(t.title)+"</h3><p class='muted'>"+escapeHtml(t.subject||"NMDCAT")+"</p><p class='muted'>"+t.questions.length+" questions</p><button class='btn primary' onclick=\"startTest('"+escapeHtml(t.testId)+"')\">Start test</button></article>").join("");
  }catch(e){box.innerHTML="<div class='card'>"+escapeHtml(e.message)+"</div>"}
}
window.loadTests=loadTests;

function startTest(id){
  const t=tests.find(x=>x.testId===id);if(!t)return;if(!currentUser){toast("Sign in first");return}if(!allowed(t.requiredPlan)){toast("Upgrade required for this test");showView("plans");return}
  currentTest=t;currentIndex=0;answers=new Array(t.questions.length).fill(null);remainingSec=Number(t.timeMinutes||45)*60;submitting=false;
  $("runnerTitle").textContent=t.title;$("runnerSubject").textContent=t.subject||"NMDCAT";$("totalCount").textContent=t.questions.length;buildQuestionNav();showView("testRunner");renderQuestion();startTimer();
}
function startTimer(){clearInterval(timerId);updateTimer();timerId=setInterval(()=>{remainingSec--;updateTimer();if(remainingSec<=0){clearInterval(timerId);submitTest(true)}},1000)}
function updateTimer(){const m=Math.max(0,Math.floor(remainingSec/60));const s=Math.max(0,remainingSec%60);$("timer").textContent=String(m).padStart(2,"0")+":"+String(s).padStart(2,"0")}
function buildQuestionNav(){$("questionNav").innerHTML=currentTest.questions.map((_,i)=>"<button class='qdot' id='qd"+i+"' onclick='jumpQuestion("+i+")'>"+(i+1)+"</button>").join("")}
function renderQuestion(){
  const q=currentTest.questions[currentIndex];$("qNumber").textContent="Question "+(currentIndex+1);$("qProgress").textContent=(currentIndex+1)+" / "+currentTest.questions.length;$("questionText").textContent=q.q;
  $("options").innerHTML=q.options.map((o,i)=>"<label class='option "+(answers[currentIndex]===i?"selected":"")+"'><input type='radio' name='q' "+(answers[currentIndex]===i?"checked":"")+" onchange='chooseOption("+i+")'><span><b>"+String.fromCharCode(65+i)+".</b> "+escapeHtml(o)+"</span></label>").join("");
  document.querySelectorAll(".qdot").forEach((b,i)=>{b.classList.toggle("active",i===currentIndex);b.classList.toggle("answered",answers[i]!==null)});$("answeredCount").textContent=answers.filter(x=>x!==null).length;
}
function chooseOption(i){answers[currentIndex]=i;renderQuestion()}
function nextQuestion(){if(currentIndex<currentTest.questions.length-1){currentIndex++;renderQuestion()}}
function previousQuestion(){if(currentIndex>0){currentIndex--;renderQuestion()}}
function jumpQuestion(i){currentIndex=i;renderQuestion()}
Object.assign(window,{startTest,nextQuestion,previousQuestion,jumpQuestion,chooseOption});

async function submitTest(force=false){
  if(submitting)return;if(!force&&!confirm("Submit this test now?"))return;submitting=true;clearInterval(timerId);
  const spent=Number(currentTest.timeMinutes||0)*60-remainingSec;let score=0;
  currentTest.questions.forEach((q,i)=>{if(answers[i]===Number(q.answer))score++});
  try{const r=await api("/api/results",{method:"POST",body:JSON.stringify({testId:currentTest.testId,score,total:currentTest.questions.length,timeSpentSec:spent})});toast("Submitted: "+score+"/"+currentTest.questions.length);currentTest=null;showView("results");await loadResults();if(r.emailSent)toast("Result email sent")}catch(e){submitting=false;toast(e.message)}
}
window.submitTest=submitTest;

async function loadResults(){
  const box=$("resultsTable");box.innerHTML="<div>Loading…</div>";
  try{const rows=(await api("/api/results")).results||[];if(!rows.length){box.innerHTML="<div class='muted'>No results yet.</div>";return}
  box.innerHTML="<table><thead><tr><th>Date</th><th>Test</th><th>Score</th><th>%</th><th>Time</th></tr></thead><tbody>"+rows.map(r=>"<tr><td>"+escapeHtml(new Date(r.submittedAt).toLocaleString())+"</td><td>"+escapeHtml(r.testTitle||r.testId)+"</td><td>"+escapeHtml(r.score)+"/"+escapeHtml(r.total)+"</td><td>"+escapeHtml(r.percentage)+"%</td><td>"+Math.round(Number(r.timeSpentSec||0)/60)+" min</td></tr>").join("")+"</tbody></table>";
  }catch(e){box.innerHTML="<div>"+escapeHtml(e.message)+"</div>"}
}
window.loadResults=loadResults;

async function loadPdfs(){
  const box=$("pdfGrid");box.innerHTML="<div class='card'>Loading PDFs…</div>";
  try{const rows=(await api("/api/pdfs")).pdfs||[];if(!rows.length){box.innerHTML="<div class='card'>No PDFs configured yet.</div>";return}
    box.innerHTML=rows.map(p=>"<article class='card pdf-card'><div class='icon'>"+(p.locked?"🔒":"📄")+"</div><span class='badge "+(p.requiredPlan==="pro"?"pro":p.requiredPlan==="plus"?"plus":"neutral")+"'>"+escapeHtml(p.requiredPlan)+"</span><h3>"+escapeHtml(p.title)+"</h3><p class='muted'>"+escapeHtml(p.description||"Protected study file")+"</p><button class='btn "+(p.locked?"ghost":"primary")+"' "+(p.locked?"onclick=\"showView('plans')\"":"onclick=\"openPdf('"+escapeHtml(p.pdfId)+"')\"")+">"+(p.locked?"Upgrade to unlock":"Open PDF")+"</button></article>").join("");
  }catch(e){box.innerHTML="<div class='card'>"+escapeHtml(e.message)+"</div>"}
}
async function openPdf(pdfId){
  try{const token=await currentUser.getIdToken();const r=await fetch("/api/pdf?pdfId="+encodeURIComponent(pdfId),{headers:{Authorization:"Bearer "+token}});if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error||"Could not open PDF")}
  const blob=await r.blob(),url=URL.createObjectURL(blob);window.open(url,"_blank","noopener");setTimeout(()=>URL.revokeObjectURL(url),60000)}catch(e){toast(e.message)}
}
window.loadPdfs=loadPdfs;window.openPdf=openPdf;

async function checkout(plan){
  if(!currentUser){toast("Sign in first");return}
  try{const r=await api("/api/checkout",{method:"POST",body:JSON.stringify({plan})});if(r.url)location.href=r.url;else toast(r.message||"Checkout is not configured")}catch(e){toast(e.message)}
}
window.checkout=checkout;

async function loadAdmin(){
  const box=$("adminTables");box.innerHTML="<div class='card'>Loading…</div>";
  try{const d=await api("/api/admin");box.innerHTML="<article class='card'><h3>Recent tests</h3><pre class='muted'>"+escapeHtml(JSON.stringify(d.tests,null,2))+"</pre></article><article class='card'><h3>Recent PDFs</h3><pre class='muted'>"+escapeHtml(JSON.stringify(d.pdfs,null,2))+"</pre></article>"}catch(e){box.innerHTML="<div class='card'>"+escapeHtml(e.message)+"</div>"}
}
async function saveTest(e){
  e.preventDefault();try{JSON.parse($("testQuestions").value)}catch{toast("Invalid question JSON");return}
  try{await api("/api/admin",{method:"POST",body:JSON.stringify({action:"upsertTest",row:{testId:$("testId").value,title:$("testTitle").value,subject:$("testSubject").value,timeMinutes:$("testMinutes").value,requiredPlan:$("testPlan").value,isFree:$("testPlan").value==="free",questionsJson:$("testQuestions").value}})});toast("Test saved");loadAdmin();loadTests()}catch(e){toast(e.message)}
}
async function savePdf(e){
  e.preventDefault();try{await api("/api/admin",{method:"POST",body:JSON.stringify({action:"upsertPdf",row:{pdfId:$("pdfId").value,title:$("pdfTitle").value,fileId:$("pdfFileId").value,requiredPlan:$("pdfPlan").value,description:$("pdfDescription").value}})});toast("PDF saved");loadAdmin();loadPdfs()}catch(e){toast(e.message)}
}
Object.assign(window,{loadAdmin,saveTest,savePdf});

window.addEventListener("firebase-sdk-ready",()=>initFirebase());
document.addEventListener("DOMContentLoaded",()=>{if(window.__firebase)initFirebase()});
