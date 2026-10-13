let D=null;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
async function api(p,o={}){o.headers={'x-admin-key':$('#key').value,...(o.headers||{})};if(o.body){o.headers['Content-Type']='application/json';o.body=JSON.stringify(o.body)}const r=await fetch(p,o),d=await r.json();if(!r.ok)throw Error(d.error||'failed');return d}
async function loadAdmin(){try{D=await api('/api/admin/summary');render()}catch(e){$('#admin').innerHTML='<div class="error">'+esc(e.message)+'</div>'}}
function user(id){return D.users.find(x=>x.id===id)?.username||id}
function render(){
  const pendingA=D.activations.filter(x=>x.status==='pending');
  const pendingU=(D.upgrades||[]).filter(x=>x.status==='pending');
  const pendingW=D.withdrawals.filter(x=>x.status==='pending');
  const activatedUsers=D.users.filter(x=>x.activated===true).length;
  const upgradedUserIds=new Set((D.upgrades||[]).filter(x=>x.status==='approved').map(x=>x.userId));
  D.users.filter(x=>Number(x.level)>1).forEach(x=>upgradedUserIds.add(x.id));
  const upgradedUsers=upgradedUserIds.size;
  const activations=pendingA.length?pendingA.map(x=>`<div class="tx"><div><b>${esc(user(x.userId))}</b><br><small>₦${Number(x.fee).toLocaleString()} • ${esc(x.receiptName||'receipt')}</small><br><small>${x.createdAt}</small></div><div><button class="btn" onclick="viewReceipt('${x.id}','activation')">View receipt</button> <button class="btn primary" onclick="review('activation','${x.id}','approved')">Approve</button> <button class="btn danger" onclick="review('activation','${x.id}','rejected')">Reject</button></div></div>`).join(''):'<p class="muted">No pending activations.</p>';
  const upgrades=pendingU.length?pendingU.map(x=>`<div class="tx upgradeReview"><div><b>${esc(user(x.userId))}</b><br><small>Level ${x.fromLevel} → Level ${x.toLevel} • ${esc(x.levelName)}</small><br><small>₦${Number(x.fee).toLocaleString()} • ${esc(x.receiptName||'receipt')}</small><br><small>${x.createdAt}</small></div><div><button class="btn" onclick="viewReceipt('${x.id}','upgrade')">View receipt</button> <button class="btn primary" onclick="review('upgrade','${x.id}','approved')">Approve upgrade</button> <button class="btn danger" onclick="review('upgrade','${x.id}','rejected')">Reject</button></div></div>`).join(''):'<p class="muted">No pending upgrade receipts.</p>';
  const withdrawals=pendingW.length?pendingW.map(x=>`<div class="tx"><div><b>${esc(user(x.userId))}</b><br><small>₦${x.amount.toLocaleString()} • ${esc(x.bank||'')} • ${esc(x.accountNumber||'')}</small><br><small>${esc(x.accountName||'')}</small></div><div><button class="btn primary" onclick="review('withdrawal','${x.id}','approved')">Approve</button> <button class="btn danger" onclick="review('withdrawal','${x.id}','rejected')">Reject</button></div></div>`).join(''):'<p class="muted">No pending withdrawals.</p>';
  const users=D.users.map(u=>`<div class="tx"><div><b>${esc(u.username)}</b><br><small>${esc(u.email)} • Lv.${u.level} • ${u.activated?'Activated':'Not activated'}</small></div><div>APX ${u.balance.toLocaleString()}<br>NGN ₦${u.ngnBalance.toLocaleString()}</div></div>`).join('')||'<p class="muted">No users yet.</p>';
  const ua=D.settings.upgradeAccounts||{};
  $('#admin').innerHTML=`
  <div class="stats"><div class="stat"><div class="label">Total users</div><div class="v">${D.users.length}</div></div><div class="stat"><div class="label">Activated users</div><div class="v">${activatedUsers}</div></div><div class="stat"><div class="label">Users upgraded</div><div class="v">${upgradedUsers}</div></div><div class="stat"><div class="label">Transactions</div><div class="v">${D.transactions.length}</div></div><div class="stat"><div class="label">Pending activation</div><div class="v">${pendingA.length}</div></div><div class="stat"><div class="label">Pending upgrades</div><div class="v">${pendingU.length}</div></div></div>
  <section class="card"><h2>User statistics</h2><div class="stats"><div class="stat"><div class="label">Total registered</div><div class="v">${D.users.length}</div></div><div class="stat"><div class="label">Activated</div><div class="v">${activatedUsers}</div></div><div class="stat"><div class="label">Upgraded</div><div class="v">${upgradedUsers}</div></div></div><p class="muted">These totals update automatically from the current user and approval records.</p></section>
  <section class="card"><h2>Upgrade receipt reviews</h2><p class="muted">Users upload receipts here. Approving an upgrade immediately moves the user to the requested level and activates the new tap power.</p>${upgrades}</section>
  <section class="card"><h2>Activation reviews</h2>${activations}</section>
  <section class="card"><h2>Withdrawal reviews</h2>${withdrawals}</section>
  <section class="card"><h2>Users</h2>${users}</section>
  <section class="card"><h2>Upgrade payment accounts</h2><p class="muted">Set the payment account shown for each upgrade level. Level 1 does not require payment.</p>
    ${[2,3,4,5].map(lv=>{const a=ua[String(lv)]||{};return `<div class="adminLevelBox"><h3>Level ${lv} — ${esc(D.settings.levelNames?.[String(lv)]||({2:'Silver',3:'Gold',4:'Mamba',5:'Alpha-Apix'}[lv]))}</h3><div class="grid2"><div class="field"><label>BANK NAME</label><input id="upg${lv}bank" value="${esc(a.bankName||'')}"></div><div class="field"><label>ACCOUNT NUMBER</label><input id="upg${lv}acct" value="${esc(a.accountNumber||'')}"></div></div><div class="field"><label>ACCOUNT HOLDER</label><input id="upg${lv}holder" value="${esc(a.accountHolder||'')}"></div></div>`}).join('')}
    <button class="btn primary" onclick="saveSettings()">Save upgrade accounts & settings</button>
  </section>
  <section class="card"><h2>Activation payment account</h2><div class="grid2"><div class="field"><label>BANK NAME</label><input id="actbank" value="${esc(D.settings.activationBankName||'')}"></div><div class="field"><label>ACCOUNT NUMBER</label><input id="actacct" value="${esc(D.settings.activationAccountNumber||'')}"></div></div><div class="field"><label>ACCOUNT HOLDER</label><input id="actholder" value="${esc(D.settings.activationAccountHolder||'')}"></div><div class="grid2"><div class="field"><label>ACTIVATION FEE</label><input id="actfee" type="number" value="${D.settings.activationFee}"></div><div class="field"><label>CONVERSION FEE (DECIMAL)</label><input id="fee" type="number" step="0.001" value="${D.settings.conversionFee}"></div></div><button class="btn primary" onclick="saveSettings()">Save all settings</button></section>`;
}
async function review(kind,id,status){if(!confirm(status==='approved'?'Approve this request?':'Reject this request?'))return;await api('/api/admin/review',{method:'POST',body:{kind,id,status}});await loadAdmin()}
async function saveSettings(){
  const upgradeAccounts={};
  for(const lv of [2,3,4,5]) upgradeAccounts[String(lv)]={bankName:$('#upg'+lv+'bank').value,accountNumber:$('#upg'+lv+'acct').value,accountHolder:$('#upg'+lv+'holder').value};
  D=await api('/api/admin/settings',{method:'POST',body:{conversionFee:Number($('#fee').value),activationFee:Number($('#actfee').value),activationBankName:$('#actbank').value,activationAccountNumber:$('#actacct').value,activationAccountHolder:$('#actholder').value,upgradeAccounts}});await loadAdmin()
}
async function viewReceipt(id,kind='activation'){try{const r=await fetch('/api/admin/'+(kind==='upgrade'?'upgrade-receipt':'receipt')+'?id='+encodeURIComponent(id),{headers:{'x-admin-key':$('#key').value}});if(!r.ok)throw Error('Could not load receipt');const blob=await r.blob();const url=URL.createObjectURL(blob);window.open(url,'_blank')}catch(e){alert(e.message)}}
