const state={token:localStorage.nixiToken||'',view:'home',data:null,authPage:'welcome'};
const FIN_KEY='nixiFinancialStateV1';
function getFinancialCache(){try{return JSON.parse(localStorage.getItem(FIN_KEY)||'null')}catch{return null}}
function saveFinancialCache(data){if(!data?.user)return; const u=data.user; const old=getFinancialCache()||{}; localStorage.setItem(FIN_KEY,JSON.stringify({userId:u.id,email:u.email,balance:Number(u.balance||0),ngnBalance:Number(u.ngnBalance||0),level:u.level,totalTaps:u.totalTaps,convertedAPX:Number(old.convertedAPX||0),updatedAt:Date.now()}))}
function clearFinancialCache(){localStorage.removeItem(FIN_KEY)}
function reconcileFinancialState(data){
  if(!data?.user)return data;
  const c=getFinancialCache(); if(!c || c.userId!==data.user.id)return data;
  const serverAPX=Number(data.user.balance||0), serverNGN=Number(data.user.ngnBalance||0);
  const cachedAPX=Number(c.balance||0), cachedNGN=Number(c.ngnBalance||0), converted=Number(c.convertedAPX||0);
  if(converted>0 && serverAPX>cachedAPX && serverNGN<cachedNGN){
    data.user.balance=Math.max(0,serverAPX-converted);
    data.user.ngnBalance=Math.max(serverNGN,cachedNGN);
  }
  return data;
}

const $=s=>document.querySelector(s); const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
async function api(path,opts={}){opts.headers={...(opts.headers||{}),...(state.token?{Authorization:'Bearer '+state.token}:{})}; if(opts.body&&typeof opts.body!=='string'){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(opts.body)} const r=await fetch(path,opts); const d=await r.json(); if(!r.ok)throw new Error(d.error||'Request failed'); return d;}
function render(){ if(!state.data)return renderAuth(); const d=state.data; const u=d.user; const views={home:home,tap:tap,convert:convert,withdraw:withdrawPage,upgrade:upgrade,me:me}; $('#app').innerHTML=`<div class="shell"><div class="top"><div class="brand">NIXI<span>.</span></div></div>${views[state.view](d)}<nav class="bottom">${[['home','⌂','Home'],['tap','ϟ','Tap'],['upgrade','↗','Upgrade'],['me','♙','Me']].map(([v,i,t])=>{const statusClass=v==='me'?(u.activated?'status-green':'status-red'):'';return `<button class="nav ${state.view===v?'active':''} ${statusClass}" onclick="go('${v}')"><span class="ico">${i}</span><small>${t}</small></button>`}).join('')}</nav></div><div id="modal" class="modal"></div>`;}
function home(d){const u=d.user, lv=d.level; return `<div class="welcome"><div class="avatar profileStatus ${u.activated?'green':'red'}">${esc(u.username[0]?.toUpperCase()||'N')}</div><div><small>Welcome back</small><h2>@${esc(u.username)}</h2></div></div><section class="card balance"><div class="label">APX Balance</div><div class="balanceNum">${u.balance.toLocaleString()} <span style="font-size:20px;color:#74c9ff">APX</span></div><div class="balanceRow"><span>NGN NAIRA</span><b>₦${u.ngnBalance.toLocaleString()}</b></div><p class="muted" style="text-align:center">Convert your APX to ₦ Naira before you can withdraw.</p><div class="actions"><button class="btn primary" onclick="withdraw()">↓ Withdraw</button><button class="btn" onclick="openConvert()">⇄ Convert</button></div></section><div class="stats"><div class="stat"><div class="label">Tap power</div><div class="v">+${lv.perTap.toLocaleString()}</div></div><div class="stat"><div class="label">Level</div><div class="v">${lv.level}</div></div><div class="stat"><div class="label">Total taps</div><div class="v">${u.totalTaps}</div></div></div>${u.activated?`<section class="card activate activated"><div class="icon">✓</div><div><b style="font-size:21px">Activated</b><div class="muted">Your account is active and ready.</div></div><b style="margin-left:auto">✓</b></section>`:`<section class="card activate pending" onclick="activation()"><div class="icon">✓</div><div><b style="font-size:21px">Activate</b><div class="muted">Account not activated — tap to activate</div></div><b style="margin-left:auto">→</b></section>`}<section class="card history"><h3>↶ Transaction history</h3>${d.transactions.slice(0,8).map(txrow).join('')||'<div class="muted">No transactions yet.</div>'}</section>`}
function txrow(t){const labels={bonus:'Bonus',tap:'Tap',conversion:'Conversion',withdrawal:'Withdrawal',upgrade:'Upgrade'};return `<div class="tx"><div><b>${esc(labels[t.type]||t.type)}</b><br><small>${t.type==='bonus'?'Welcome bonus':(t.meta?.label||'')}${t.meta?.level?` • Lv.${t.meta.level}`:''}<br>${new Date(t.createdAt).toLocaleString()}</small></div><div class="${t.amount>=0?'plus':'minus'}">${t.amount>=0?'+':''}${t.amount.toLocaleString()}</div></div>`}
function tap(d){const u=d.user,lv=d.level; const now=Date.now(), since=now-lv.hours*3600e3; const used=d.transactions.filter(t=>t.type==='tap'&&new Date(t.createdAt).getTime()>=since).length; return `<div class="card" style="text-align:center;padding-top:30px"><div class="label">Tap to earn</div><div class="balanceNum">${u.balance.toLocaleString()} APX</div><div class="muted">+${lv.perTap.toLocaleString()} APX per tap • Level ${lv.level} • ${lv.taps} taps / ${lv.hours}h</div><div class="pill" style="display:inline-block;margin:20px">Taps left: ${Math.max(0,lv.taps-used)}/${lv.taps}</div><button class="tapButton" onclick="doTap()">ϟ</button><div class="grid2" style="margin-top:25px">${d.levels.slice(0,3).map(x=>`<div class="level ${x.level===lv.level?'current':''}"><b>Lv. ${x.level}</b><div>${x.perTap.toLocaleString()} APX/tap</div><small>${x.taps} × / ${x.hours}h</small></div>`).join('')}</div></div>`}
function convert(d){
  const u=d.user;
  const feeRate=d.conversionFee||0;
  const amount=Math.min(Number(window.convertAmount||0),u.balance);
  const fee=amount*feeRate;
  const receive=amount-fee;
  const pct=(amount/u.balance*100)||0;
  const history=d.transactions.filter(t=>t.type==='conversion').slice(0,8);
  return `<div class="convertPage">
    <div class="pageHead"><button class="backBtn" onclick="go('home')">←</button><div><h1>Convert</h1><p>APX → NGN Naira · ${(feeRate*100).toFixed(2)}% fee</p></div></div>
    <section class="card convertBalance"><div><div class="label">AVAILABLE APX</div><div class="convertAvailable">${u.balance.toLocaleString()}</div><div class="muted">NGN Balance</div></div><div class="convertIcon">⇄</div><div class="convertNgn">₦${u.ngnBalance.toLocaleString()}</div></section>
    <section class="card convertBox"><div class="label">AMOUNT TO CONVERT (APX)</div><input id="convertAmount" class="convertInput" type="number" min="0" max="${u.balance}" value="${amount||''}" placeholder="0" oninput="setConvertAmount(this.value)">
      <div class="percentRow">${[25,50,75].map(x=>`<button onclick="setConvertPercent(${x})">${x}%</button>`).join('')}<button onclick="setConvertMax()">Max</button></div>
      <div class="calcRow"><span>You convert</span><b>${amount.toLocaleString()} APX</b></div>
      <div class="calcRow muted"><span>Fee (${(feeRate*100).toFixed(2)}%)</span><b>-${fee.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} APX</b></div>
      <div class="calcRow receive"><span>You receive</span><b>₦${receive.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</b></div>
    </section>
    <button class="btn primary convertNow" onclick="submitConversion()" ${amount<=0?'disabled':''}>Convert now</button>
    <section class="conversionHistory"><h2>↶ Conversion history</h2>${history.length?history.map(t=>`<div class="conversionItem"><div><b>APX → ₦ Naira</b><small>Converted ${Number(t.amount<0?-t.amount:t.amount).toLocaleString()} APX → ₦${Number(t.meta?.receive||0).toLocaleString(undefined,{maximumFractionDigits:2})}<br>${new Date(t.createdAt).toLocaleString()}</small></div><strong>${t.amount.toLocaleString()}</strong></div>`).join(''):'<div class="card emptyHistory">No conversions yet.</div>'}<p class="flatFee">Flat ${(feeRate*100).toFixed(2)}% conversion fee.</p></section>
  </div>`;
}
function setConvertAmount(v){ window.convertAmount=Math.max(0,Math.min(Number(v)||0,state.data.user.balance)); updateConvertPreview(); }
function updateConvertPreview(){ const d=state.data,u=d.user,a=Number(window.convertAmount||0),r=d.conversionFee||0,fee=a*r,receive=a-fee; const nodes=document.querySelectorAll('.convertBox .calcRow'); if(nodes.length>=3){nodes[0].querySelector('b').textContent=a.toLocaleString()+' APX';nodes[1].querySelector('b').textContent='-'+fee.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})+' APX';nodes[2].querySelector('b').textContent='₦'+receive.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});} const btn=document.querySelector('.convertNow');if(btn)btn.disabled=a<=0; } 
function setConvertPercent(p){ window.convertAmount=Math.floor(state.data.user.balance*p/100); render(); }
function setConvertMax(){ window.convertAmount=state.data.user.balance; render(); }
async function submitConversion(){
  const amount=Number(window.convertAmount||0); if(amount<=0)return;
  try{
    state.data=await api('/api/convert',{method:'POST',body:{amount}});
    const c=getFinancialCache()||{}; c.userId=state.data.user.id; c.email=state.data.user.email;
    c.balance=Number(state.data.user.balance||0); c.ngnBalance=Number(state.data.user.ngnBalance||0);
    c.level=state.data.user.level; c.totalTaps=state.data.user.totalTaps;
    c.convertedAPX=Number(c.convertedAPX||0)+amount; c.updatedAt=Date.now();
    localStorage.setItem(FIN_KEY,JSON.stringify(c)); window.convertAmount=0; state.view='convert'; render();
  }catch(e){alert(e.message)}
}
function upgrade(d){
  const pending=d.pendingUpgrade;
  const cards=d.levels.filter(x=>x.level>=1).map(x=>{
    const current=x.level===d.user.level;
    const higher=x.level>d.user.level;
    const pendingThis=pending&&pending.toLevel===x.level;
    let action='';
    if(current) action='<button class="btn" disabled>Current level</button>';
    else if(pendingThis) action='<button class="btn upgradePending" disabled>Upgrade pending review</button>';
    else if(higher) action=`<button class="btn primary" onclick="upgradeTo(${x.level})">Upgrade to ${esc(x.name)} — ₦${x.fee.toLocaleString()}</button>`;
    else action='<button class="btn" disabled>Level already passed</button>';
    return `<section class="level upgradeLevel level-${x.level} ${current?'current':''}">
      <div class="levelTop"><div><small class="muted">LEVEL ${x.level}</small><h3>${esc(x.name)}</h3></div><div><small class="muted">FEE</small><h3>₦${x.fee.toLocaleString()}</h3></div></div>
      <div class="upgradeQuote">“${esc(['Start strong','Break past the starter ceiling','Power up your earning journey','Elite tier — for the relentless','The apex predator of Nixi'][x.level-1])}”</div>
      <div class="chips"><div class="chip"><small>Per tap</small><b>${x.perTap.toLocaleString()} APX</b></div><div class="chip"><small>Window</small><b>${x.taps} taps every ${x.hours} hours</b></div><div class="chip"><small>Potential</small><b>${(x.perTap*x.taps).toLocaleString()} APX/window</b></div></div>
      <ul class="perks">${x.perks.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>${action}
    </section>`;
  }).join('');
  return `<div class="upgradeHead"><div class="label">BOOST</div><h1>Upgrade tap power</h1><p class="muted">Current level: ${d.user.level} • APX balance: ${d.user.balance.toLocaleString()} APX</p>${pending?`<div class="notice upgradePendingNotice">Upgrade to Level ${pending.toLevel} • ${esc(d.levels.find(x=>x.level===pending.toLevel)?.name||'Upgrade')} is awaiting admin receipt verification.</div>`:''}</div><div class="currentLevel card"><div class="currentLevelIcon">↗</div><div><small>YOU ARE ON</small><h2>Level ${d.level.level} • ${esc(d.level.name)}</h2></div></div><div class="sectionLabel">TIERS & BENEFITS</div>${cards}<div style="height:90px"></div>`;
}
function me(d){const u=d.user;return `<div style="text-align:center;margin-top:15px"><div class="avatar profileStatus ${u.activated?'green':'red'}" style="margin:auto;width:110px;height:110px;font-size:44px">${esc(u.username[0]?.toUpperCase()||'N')}</div><h1>@${esc(u.username)}</h1><div class="muted">${esc(u.email)}</div><div class="notice accountStatus ${u.activated?'green':'red'}">Account status: ${u.activated?'Activated':'Not activated'}</div></div><div class="grid2"><div class="stat"><div class="label">Balance</div><div class="v">₦${u.balance.toLocaleString()}</div></div><div class="stat"><div class="label">Level</div><div class="v">Lv. ${u.level}</div></div><div class="stat"><div class="label">Total taps</div><div class="v">${u.totalTaps}</div></div><div class="stat"><div class="label">Joined</div><div class="v">${new Date(u.joinedAt).toLocaleDateString()}</div></div></div><section class="card"><div class="tx"><div>Username</div><b>${esc(u.username)}</b></div><div class="tx"><div>Email</div><b>${esc(u.email)}</b></div></section><button class="btn danger" style="width:100%" onclick="logout()">↪ Sign out</button>`}
function renderAuth(){ if(state.authPage==='welcome'){return renderWelcome();} $('#app').innerHTML=`<div class="shell"><div class="auth"><div class="authLogoWrap"><img class="authLogo" src="/nixi-logo.jpg" alt="Nixi logo"><div class="authBrand">NIXI</div></div><section class="card"><h1 id="authTitle">Create account</h1><p class="muted">Get started with your Nixi account. A ₦155,000 APX welcome bonus is added to every new account.</p><div class="field" id="userField"><label>USERNAME</label><input id="username" placeholder="Abel"></div><div class="field"><label>EMAIL</label><input id="email" type="email" placeholder="you@example.com"></div><div class="field"><label>PASSWORD</label><input id="password" type="password" placeholder="••••••••"></div><div id="authMsg"></div><button class="btn primary" style="width:100%" onclick="submitAuth()" id="authBtn">Sign Up</button><button class="link" style="width:100%;margin-top:15px" onclick="toggleAuth()" id="switchBtn">Already have an account? Log in</button></section></div></div>`; if(typeof window.loginMode!=='boolean')window.loginMode=false;}
function renderWelcome(){ $('#app').innerHTML=`<div class="shell welcomeShell"><div class="welcomePage"><img class="welcomeLogo" src="/nixi-logo.jpg" alt="Nixi logo"><p class="welcomeEyebrow">THE NIXI ECONOMY</p><h1>Welcome<br>to <span>Nixi</span></h1><p class="welcomeText">Tap. Earn. Convert. Withdraw.<br>Start your Nixi journey today.</p><div class="welcomeFeatures"><div class="welcomeFeature"><div class="featureIcon">✦</div><span>Bonus</span></div><div class="welcomeFeature"><div class="featureIcon">ϟ</div><span>Tap to earn</span></div><div class="welcomeFeature"><div class="featureIcon">▣</div><span>Withdraw</span></div></div><div class="welcomeButtons"><button class="btn primary" onclick="openAuth('register')">Sign Up <span class="arrow">→</span></button><button class="welcomeLogin" onclick="openAuth('login')">I already have an account</button></div></div></div>`; }
function openAuth(mode){state.authPage='form';window.loginMode=mode==='login';renderAuth();if(window.loginMode){$('#authTitle').textContent='Welcome back';$('#userField').style.display='none';$('#authBtn').textContent='Log In';$('#switchBtn').textContent='Create an account';}}
function toggleAuth(){window.loginMode=!window.loginMode; $('#authTitle').textContent=window.loginMode?'Welcome back':'Create account';$('#userField').style.display=window.loginMode?'none':'block';$('#authBtn').textContent=window.loginMode?'Log In':'Sign Up';$('#switchBtn').textContent=window.loginMode?'Create an account':'Already have an account? Log in';}
async function submitAuth(){try{const b={email:$('#email').value,password:$('#password').value};if(!window.loginMode)b.username=$('#username').value;const d=await api(window.loginMode?'/api/auth/login':'/api/auth/register',{method:'POST',body:b});state.token=d.token;localStorage.nixiToken=d.token;state.data=d;saveFinancialCache(d);render();}catch(e){$('#authMsg').innerHTML=`<div class="error">${esc(e.message)}</div>`}}
async function refresh(){try{state.data=reconcileFinancialState(await api('/api/me'));saveFinancialCache(state.data);render()}catch{state.token='';localStorage.removeItem('nixiToken');clearFinancialCache();state.authPage='welcome';renderAuth()}}
function go(v){state.view=v;render()}
function withdraw(){
  window.withdrawForm=window.withdrawForm||{accountName:'',accountNumber:'',bank:'',amount:0};
  state.view='withdraw';
  render();
}
function withdrawPage(d){
  const u=d.user, f=window.withdrawForm||{accountName:'',accountNumber:'',bank:'',amount:0};
  const amount=Math.max(0,Math.min(Number(f.amount)||0,u.ngnBalance));
  f.amount=amount;
  return `<div class="withdrawPage">
    <div class="pageHead"><button class="backBtn" onclick="go('home')">←</button><div><h1>Withdraw</h1><p>Withdraw your available NGN balance</p></div></div>
    <section class="card withdrawBalance"><div class="label">WITHDRAWABLE BALANCE (NGN)</div><div class="withdrawAvailable">₦${u.ngnBalance.toLocaleString(undefined,{maximumFractionDigits:2})}</div><p class="withdrawHint">Only your Naira balance can be withdrawn. Convert APX to NGN first.</p></section>
    ${!u.activated?`<div class="notice withdrawActivationNotice">Your account is not activated. Activation is required before any withdrawal.</div>`:''}
    <section class="card withdrawForm">
      <div class="field"><label>ACCOUNT NAME</label><input id="withdrawAccountName" value="${esc(f.accountName)}" placeholder="e.g. John Doe" oninput="withdrawSet('accountName',this.value)"></div>
      <div class="field"><label>ACCOUNT NUMBER</label><input id="withdrawAccountNumber" value="${esc(f.accountNumber)}" inputmode="numeric" maxlength="10" placeholder="10-digit NUBAN" oninput="withdrawSet('accountNumber',this.value)"></div>
      <div class="field"><label>SELECT BANK</label><button type="button" class="bankSelect" onclick="openBankPicker()"><span>${esc(f.bank||'Choose your bank')}</span><b>⌄</b></button></div>
      <div class="field"><label>AMOUNT (MIN ₦50,000)</label><input id="withdrawAmount" class="amountInput" type="number" min="0" value="${amount||0}" placeholder="0" oninput="withdrawSetAmount(this.value)"></div>
      <div class="withdrawQuick"><button onclick="setWithdrawAmount(50000)">50,000</button><button onclick="setWithdrawAmount(100000)">100,000</button><button onclick="setWithdrawAmount(500000)">500,000</button><button onclick="setWithdrawMax()">Max</button></div>
      <button class="btn primary withdrawSubmit" onclick="submitWithdrawal()">↓ Withdraw</button>
    </section>
    <div style="height:90px"></div>
  </div>`;
}
function withdrawSet(k,v){ window.withdrawForm=window.withdrawForm||{}; window.withdrawForm[k]=v; }
function withdrawSetAmount(v){ withdrawSet('amount',Math.max(0,Math.min(Number(v)||0,state.data.user.ngnBalance))); }
function setWithdrawAmount(v){ withdrawSetAmount(v); render(); }
function setWithdrawMax(){ withdrawSetAmount(state.data.user.ngnBalance); render(); }
function openBankPicker(){
  const banks=state.data.banks||[];
  modal(`<div class="bankPicker"><h2 class="paymentTitle">Select bank</h2><input class="bankSearch" id="bankSearch" placeholder="⌕  Search banks" oninput="filterBanks(this.value)"><div id="bankList" class="bankList">${banks.map(b=>`<button type="button" class="bankOption" data-bank="${esc(b)}" onclick="chooseBank(this.dataset.bank)">${esc(b)}</button>`).join('')}</div></div>`,'bankPickerSheet');
}
function filterBanks(q){
  const query=String(q||'').toLowerCase(); const banks=state.data.banks||[];
  const el=$('#bankList'); if(!el)return;
  el.innerHTML=banks.filter(b=>b.toLowerCase().includes(query)).map(b=>`<button type="button" class="bankOption" data-bank="${esc(b)}" onclick="chooseBank(this.dataset.bank)">${esc(b)}</button>`).join('')||'<div class="muted bankEmpty">No banks found.</div>';
}
function chooseBank(bank){ withdrawSet('bank',bank); $('#modal').classList.remove('show'); $('#modal').className='modal'; render(); }
async function submitWithdrawal(){
  const f=window.withdrawForm||{}; const u=state.data.user; const amount=Number(f.amount)||0;
  if(!u.activated){ activation(); return; }
  if(!f.accountName?.trim() || !/^\d{10}$/.test(String(f.accountNumber||'')) || !f.bank){ return alert('Please enter your account name, 10-digit account number, and select your bank.'); }
  if(amount<50000) return alert('Minimum withdrawal is ₦50,000.');
  if(amount>u.ngnBalance) return alert('Withdrawal amount cannot exceed your available balance.');
  try{
    state.data=await api('/api/withdraw',{method:'POST',body:{accountName:f.accountName.trim(),accountNumber:String(f.accountNumber),bank:f.bank,amount}}); saveFinancialCache(state.data);
    window.withdrawForm={accountName:'',accountNumber:'',bank:'',amount:0};
    alert('Withdrawal request submitted for admin review.');
    state.view='home'; render();
  }catch(e){alert(e.message)}
}
function openConvert(){window.convertAmount=0;state.view='convert';render()}
async function doTap(){try{state.data=await api('/api/tap',{method:'POST'});saveFinancialCache(state.data);render();}catch(e){alert(e.message)}}
async function upgradeTo(level){
  const target=state.data.levels.find(x=>x.level===level);
  if(!target || target.level<=state.data.user.level)return;
  if(state.data.pendingUpgrade)return alert('You already have an upgrade awaiting admin verification.');
  showUpgradeWarning(target);
}
function continueUpgrade(level){ const target=state.data.levels.find(x=>x.level===Number(level)); if(target)showUpgradePayment(target); }
function showUpgradeWarning(target){
  modal(`
    <div class="activationIcon warningIcon">⚠</div>
    <h2 class="activationTitle">Warning notice ⚠️</h2>
    <div class="activationBody warningText">
      <p>⚠️ Due to a temporary technical issue, <b>OPay payments are currently unavailable.</b></p>
      <p>Please do not make payments with OPay until further notice.</p>
      <p>You can continue with the available bank-account payment option below.</p>
    </div>
    <button class="btn primary activationAction" onclick="continueUpgrade(${target.level})">CONTINUE</button>
  `,'activationSheet upgradeWarningSheet');
}
function modal(html, cls=''){
  $('#modal').className='modal '+(cls?'activationOverlay':'');
  $('#modal').innerHTML=`<div class="sheet ${cls}"><button class="close" onclick="$('#modal').classList.remove('show');$('#modal').className='modal'">×</button>${html}</div>`;
  $('#modal').classList.add('show');
}
function activation(){
  const a=state.data.activationAccount;
  const fee=state.data.activationFee;
  modal(`
    <div class="activationIcon shieldIcon">♢</div>
    <h2 class="activationTitle">Account Activation<br>Required</h2>
    <div class="activationBody">
      <p>Dear User,</p>
      <p>To access all platform features, including withdrawals, your account must first be activated. Account activation enables us to verify your account and complete the setup process.</p>
      <div class="activationFee">Fee ₦${fee.toLocaleString()}</div>
    </div>
    <button class="btn primary activationAction" onclick="showActivationWarning()">PROCEED</button>
  `,'activationSheet');
}
function showActivationWarning(){
  modal(`
    <div class="activationIcon warningIcon">⚠</div>
    <h2 class="activationTitle">Warning notice ⚠️</h2>
    <div class="activationBody warningText">
      <p>⚠️ Due to a temporary technical issue, OPay payments are currently unavailable. Please do not make payments with OPay account until further notice.</p>
    </div>
    <button class="btn primary activationAction" onclick="showActivationPayment()">CONTINUE</button>
  `,'activationSheet');
}
function showActivationPayment(){
  const a=state.data.activationAccount;
  modal(`
    <h2 class="paymentTitle">Activation Payment</h2>
    <div class="paymentBox videoPaymentBox">
      <div><span>AMOUNT</span><b>₦${state.data.activationFee.toLocaleString()}</b></div>
      <div><span>ACCOUNT</span><b>${esc(a.accountNumber)}<br><small>(${esc(a.bankName)})</small></b><button class="copyBtn" onclick="copyActivationAccount()" aria-label="Copy account">▣</button></div>
      <div><span>APIX-HOLDER</span><b>${esc(a.holder)}</b></div>
    </div>
    <p class="paymentInstructions">Only make the exact amount for activation of your profile. Upload your receipt and let it be verified here. Once your account is activated proceed to withdraw your money immediately.</p>
    <input id="receiptFile" class="receiptInput" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onchange="showReceiptPreview()">
    <label class="receiptDrop" for="receiptFile" id="receiptDrop">
      <span class="uploadIcon">⇧</span>
      <b id="receiptLabel">Tap to upload receipt</b>
      <small id="receiptSub">Select photo from your gallery</small>
      <div id="receiptPreview"></div>
    </label>
    <button class="btn primary activationAction" onclick="submitActivation()">Verify</button>
  `,'activationSheet paymentSheet');
}
async function copyActivationAccount(){
  const n=state.data.activationAccount.accountNumber;
  try{await navigator.clipboard.writeText(n); alert('Account number copied.');}catch{alert(n)}
}
function showReceiptPreview(){
  const f=$('#receiptFile')?.files[0];
  const label=$('#receiptLabel'), sub=$('#receiptSub'), preview=$('#receiptPreview');
  if(!f){label.textContent='Tap to upload receipt';sub.textContent='Select photo from your gallery';preview.innerHTML='';return;}
  label.textContent=f.name;
  sub.textContent=`${(f.size/1024/1024).toFixed(2)} MB • Tap to change`;
  if(f.type.startsWith('image/')){
    const reader=new FileReader();
    reader.onload=()=>preview.innerHTML=`<img src="${reader.result}" class="receiptThumb" alt="Receipt preview">`;
    reader.readAsDataURL(f);
  } else preview.innerHTML='<div class="receiptPdf">PDF receipt selected</div>';
}
async function submitActivation(){
  const f=$('#receiptFile')?.files[0];
  if(!f){
    showActivationPayment();
    setTimeout(()=>{const box=document.querySelector('.activationSheet'); if(box){box.insertAdjacentHTML('afterbegin','<div class="uploadError">! &nbsp; Please upload your receipt first</div>');}},0);
    return;
  }
  if(f.size>5*1024*1024)return alert('Receipt must be 5MB or smaller.');
  const reader=new FileReader();
  reader.onload=async()=>{
    try{
      await api('/api/activation',{method:'POST',body:{receiptName:f.name,receiptData:reader.result}});
      await refresh();
      showUnderReview('activation');
    }catch(e){alert(e.message)}
  };
  reader.readAsDataURL(f);
}

function showUpgradePayment(target){
  const a=(state.data.upgradeAccounts||{})[String(target.level)]||{};
  modal(`
    <h2 class="paymentTitle">Upgrade Payment</h2>
    <div class="paymentBox videoPaymentBox">
      <div><span>TIER</span><b>Level ${target.level} — ${esc(target.name)}</b></div>
      <div><span>AMOUNT</span><b>₦${target.fee.toLocaleString()}</b></div>
      <div><span>ACCOUNT</span><b>${esc(a.accountNumber||'Not configured')}<br><small>(${esc(a.bankName||'Bank not configured')})</small></b><button class="copyBtn" onclick="copyUpgradeAccount(${target.level})" aria-label="Copy account">▣</button></div>
      <div><span>ACCOUNT-HOLDER</span><b>${esc(a.accountHolder||'Not configured')}</b></div>
    </div>
    <p class="paymentInstructions">Only make the exact amount for this upgrade. Upload your receipt and let it be verified here. Once your upgrade is confirmed, your new tap power takes effect immediately.</p>
    <input id="upgradeReceiptFile" class="receiptInput" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onchange="showUpgradeReceiptPreview()">
    <label class="receiptDrop" for="upgradeReceiptFile" id="upgradeReceiptDrop">
      <span class="uploadIcon">⇧</span><b id="upgradeReceiptLabel">Tap to upload receipt</b><small id="upgradeReceiptSub">Select photo from your gallery</small><div id="upgradeReceiptPreview"></div>
    </label>
    <button class="btn primary activationAction" onclick="submitUpgrade(${target.level})">Verify</button>
  `,'activationSheet paymentSheet upgradePaymentSheet');
}
async function copyUpgradeAccount(level){
  const a=(state.data.upgradeAccounts||{})[String(level)]||{}; const n=a.accountNumber||'';
  try{await navigator.clipboard.writeText(n);alert('Account number copied.')}catch{alert(n)}
}
function showUpgradeReceiptPreview(){
  const f=$('#upgradeReceiptFile')?.files[0],label=$('#upgradeReceiptLabel'),sub=$('#upgradeReceiptSub'),preview=$('#upgradeReceiptPreview');
  if(!f){label.textContent='Tap to upload receipt';sub.textContent='Select photo from your gallery';preview.innerHTML='';return;}
  label.textContent=f.name;sub.textContent=`${(f.size/1024/1024).toFixed(2)} MB • Tap to change`;
  if(f.type.startsWith('image/')){const reader=new FileReader();reader.onload=()=>preview.innerHTML=`<img src="${reader.result}" class="receiptThumb" alt="Upgrade receipt preview">`;reader.readAsDataURL(f)}else preview.innerHTML='<div class="receiptPdf">PDF receipt selected</div>';
}
async function submitUpgrade(level){
  const f=$('#upgradeReceiptFile')?.files[0];
  if(!f){showUpgradePayment(state.data.levels.find(x=>x.level===level));setTimeout(()=>{const box=document.querySelector('.upgradePaymentSheet');if(box)box.insertAdjacentHTML('afterbegin','<div class="uploadError">! &nbsp; Please upload your receipt first</div>')},0);return;}
  if(f.size>5*1024*1024)return alert('Receipt must be 5MB or smaller.');
  const reader=new FileReader();reader.onload=async()=>{try{await api('/api/upgrade',{method:'POST',body:{level,receiptName:f.name,receiptData:reader.result}});state.view='upgrade';await refresh();showUnderReview('upgrade')}catch(e){alert(e.message)}};reader.readAsDataURL(f);
}
function showUnderReview(kind){
  const title='Under review';
  const message=kind==='upgrade'
    ? 'Your upgrade receipt has been submitted. You will get feedback within 5 minutes. Stay tuned.'
    : 'Your activation receipt has been submitted. You will get feedback within 5 minutes. Stay tuned.';
  modal(`
    <div class="reviewIcon" aria-hidden="true">◎</div>
    <h2 class="reviewTitle">${title}</h2>
    <p class="reviewMessage">${message}</p>
    <button class="btn primary reviewClose" onclick="$('#modal').classList.remove('show');$('#modal').className='modal'">Close</button>
  `,'underReviewSheet');
}
function logout(){state.token='';localStorage.removeItem('nixiToken');state.authPage='welcome';renderAuth()}
const style=document.createElement('style');style.textContent='.tapButton{width:290px;height:290px;border-radius:50%;border:1px solid #1ca8ff;background:radial-gradient(circle,#1ab1ff,#0868a8);color:#06121b;font-size:105px;box-shadow:0 0 0 12px rgba(20,151,255,.08),0 0 65px rgba(20,151,255,.38);margin:35px auto;display:block}.tapButton:active{transform:scale(.97)}.quick{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.quick button{border:1px solid #274252;background:#081016;color:#fff;border-radius:14px;padding:10px}.paymentBox{border:1px solid rgba(20,151,255,.55);border-radius:20px;padding:14px;background:#0a151d;margin:15px 0}.paymentBox>div{display:flex;justify-content:space-between;gap:14px;padding:10px 0;border-bottom:1px solid #1d3444}.paymentBox>div:last-child{border-bottom:0}.paymentBox span{color:#8ea3b5;font-size:12px}.paymentBox b{text-align:right}.paymentBox small{color:#8ea3b5;font-weight:400}@media(max-width:520px){.quick{grid-template-columns:repeat(2,1fr)}}';style.textContent += '.underReviewSheet{max-width:430px;text-align:center;padding:30px 22px 22px!important;border-color:rgba(20,151,255,.45);box-shadow:0 0 35px rgba(20,151,255,.18)}.reviewIcon{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;margin:0 auto 12px;color:#64c5ff;border:2px solid #168fe0;font-size:31px;box-shadow:0 0 20px rgba(20,151,255,.22)}.reviewTitle{font-size:23px;margin:8px 0 10px;color:#f3f8ff}.reviewMessage{color:#a9bdcb;font-size:14px;line-height:1.55;margin:0 auto 22px;max-width:300px}.reviewClose{width:100%;min-height:46px}';document.head.appendChild(style);
refresh();
