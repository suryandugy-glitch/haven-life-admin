const tasks=[
 {name:'Renew car insurance',meta:'Due in 8 days · Insurance',tag:'Important',urgent:true},
 {name:'Schedule a dental check-up',meta:'This week · Health',tag:'This week'},
 {name:'Review your Netflix plan',meta:'Renews 19 Jul · Subscription',tag:'Quick win'},
 {name:'Book AC service',meta:'Before monsoon season · Home',tag:'Home'},
 {name:'Update emergency contacts',meta:'No due date · Personal',tag:'Personal',done:true},
 {name:'File electricity receipt',meta:'Completed · Documents',tag:'Done',done:true},
];
const timeline=[['TODAY','Pay electricity bill','₹1,860 · Auto-pay'],['16 JUL','Dental check-up','11:30 AM · Dr. Mehta'],['19 JUL','Netflix renewal','₹649 · Subscription'],['20 JUL','Car insurance','Review & renew','urgent']];
const bills=[['⚡','Tata Power','Due today','₹1,860'],['N','Netflix','19 Jul · Auto-pay','₹649'],['◉','JioFiber','23 Jul · Auto-pay','₹999'],['⌂','Apartment maintenance','01 Aug','₹6,500']];
const docs=[['⌑','Car insurance','Policy #IC-7429 · Expires 20 Jul 2026','Renewal due soon'],['▤','Phone warranty','iPhone 15 · Valid until 14 Sep 2026','Protected'],['⌂','Rental agreement','Bangalore apartment · Ends 31 Mar 2027','Saved'],['✚','Health insurance','Policy #H-2281 · Renews 10 Jan 2027','Protected'],['▤','Vehicle RC','KA 01 MN 4821 · Updated 12 Jun 2026','Saved'],['⌑','Passport copy','Expires 14 Nov 2030','Saved']];
const home=[['❄','Air conditioner','Last serviced 10 months ago','Book a service'],['◉','Car — Honda City','Insurance renewal in 8 days','Review insurance'],['▣','Water purifier','Filter change due in August','Set reminder'],['▤','iPhone 15','Warranty valid for 64 more days','View warranty'],['⌂','Apartment','Maintenance due 01 Aug','View payment'],['⌁','Gas connection','Annual inspection in November','Set reminder']];
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function render(){
 $('#timeline').innerHTML=timeline.map(x=>`<div class="timeline-item ${x[4]||''}"><div class="timeline-date">${x[0]}</div><div class="timeline-line"></div><div class="timeline-content"><strong>${x[1]}</strong><span>${x[2]}</span></div></div>`).join('');
 $('#nudgeList').innerHTML=tasks.slice(0,3).map((t,i)=>`<div class="nudge"><div class="nudge-icon">${['⌑','✚','◉'][i]}</div><div><strong>${t.name}</strong><span>${t.meta}</span></div><button class="complete-nudge" data-i="${i}">✓</button></div>`).join('');
 $('#allTasks').innerHTML=tasks.map((t,i)=>`<div class="task-row ${t.done?'done':''}"><input class="task-check" data-i="${i}" type="checkbox" ${t.done?'checked':''}><div class="task-info"><strong>${t.name}</strong><span>${t.meta}</span></div><span class="tag ${t.urgent?'urgent':''}">${t.tag}</span></div>`).join('');
 $('#billsList').innerHTML=bills.map(b=>`<div class="bill-row"><div class="bill-logo">${b[0]}</div><div class="bill-info"><strong>${b[1]}</strong><span>${b[2]}</span></div><div class="bill-amount"><strong>${b[3]}</strong><span>Upcoming</span></div></div>`).join('');
 $('#documentGrid').innerHTML=docs.map(d=>`<article class="document-card"><div class="big-doc-icon">${d[0]}</div><h3>${d[1]}</h3><p>${d[2]}</p><span class="status">● ${d[3]}</span></article>`).join('');
 $('#homeGrid').innerHTML=home.map(h=>`<article class="home-item"><div class="home-symbol">${h[0]}</div><h3>${h[1]}</h3><p>${h[2]}</p><span class="service">${h[3]}</span></article>`).join('');
 $('#taskBadge').textContent=tasks.filter(t=>!t.done).length;
 $('#doneCount').textContent=tasks.filter(t=>t.done).length+2;
 $$('.task-check').forEach(c=>c.onchange=e=>{tasks[e.target.dataset.i].done=e.target.checked;render();toast(e.target.checked?'Nice — marked complete.':'Moved back to your list.');});
 $$('.complete-nudge').forEach(b=>b.onclick=()=>{tasks[b.dataset.i].done=true;render();toast('Marked complete — nicely done.');});
}
function openPage(id){$$('.page').forEach(p=>p.classList.toggle('active-page',p.id===id));$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===id));window.scrollTo(0,0);$('.sidebar').classList.remove('open')}
$$('.nav-item').forEach(n=>n.onclick=e=>{e.preventDefault();openPage(n.dataset.page)});$$('[data-go]').forEach(b=>b.onclick=()=>openPage(b.dataset.go));
const modal=$('#modalBackdrop');function openModal(title){$('#modalTitle').textContent=title;modal.classList.add('show');$('#entryName').focus()}function closeModal(){modal.classList.remove('show')}$('#addBtn').onclick=()=>openModal('Add something');$('#newTaskBtn').onclick=()=>openModal('New task');$('#newBillBtn').onclick=()=>openModal('Add a bill');$('#uploadBtn').onclick=()=>openModal('Add a document');$('#newItemBtn').onclick=()=>openModal('Add an item');$('#focusTaskBtn').onclick=()=>{openPage('tasks');toast('Your insurance reminder is already waiting.');};$('.close-modal').onclick=closeModal;modal.onclick=e=>{if(e.target===modal)closeModal()};$('#entryForm').onsubmit=e=>{e.preventDefault();tasks.unshift({name:$('#entryName').value,meta:$('#entryDate').value+' · Personal',tag:'New'});render();closeModal();openPage('tasks');e.target.reset();toast('Saved to your Haven.');};
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}
$('.mobile-menu').onclick=()=>$('.sidebar').classList.toggle('open');$('#searchBtn').onclick=()=>{openModal('Find anything');$('#entryName').placeholder='Try “insurance” or “dentist”'};$('#notifyBtn').onclick=()=>toast('You have 3 things that need attention.');$('#settingsBtn').onclick=()=>toast('Settings are coming next.');
const now=new Date();$('#todayDate').textContent=now.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'});$('#greeting').textContent=(now.getHours()<12?'Good morning':now.getHours()<18?'Good afternoon':'Good evening')+', Surya';render();
