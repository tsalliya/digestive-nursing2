/* Single-browser prototype. No network, no real authentication. */
(() => {
 'use strict';
 const DB='digestive-learning-test-v1';
 const request=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
 async function open(){const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{r.result.createObjectStore('students',{keyPath:'number'});r.result.createObjectStore('sessions',{keyPath:'id'});r.result.createObjectStore('attempts',{keyPath:'id'})};return request(r)}
 async function all(store){const db=await open();try{return await request(db.transaction(store).objectStore(store).getAll())}finally{db.close()}}
 async function put(store,value){const db=await open();try{await new Promise((ok,no)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=ok;tx.onerror=()=>no(tx.error);tx.onabort=()=>no(tx.error)})}finally{db.close()}}
 async function clear(){const db=await open();try{await new Promise((ok,no)=>{const tx=db.transaction(['students','sessions','attempts'],'readwrite');for(const s of ['students','sessions','attempts'])tx.objectStore(s).clear();tx.oncomplete=ok;tx.onerror=()=>no(tx.error)})}finally{db.close()}}
 const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e};
 const csvCell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'"+'$&').replaceAll('"','""')+'"';
 const download=(rows,name)=>{const a=document.createElement('a');const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)};
 window.LocalLearning={all,put,clear,download};
 if(document.body.dataset.learningAdmin)return;
 const panel=document.createElement('section');panel.id='learning-panel';
 panel.innerHTML='<h2>學習紀錄測試</h2><p>單機測試版：僅保存在此瀏覽器，不會上傳。請使用虛構學號與姓名。切換瀏覽器、裝置或清除網站資料後，紀錄不會保留。此版沒有教師身分驗證。</p><form id="learner-form"><label>測試學號 <input id="learner-number" maxlength="40" required autocomplete="off"></label> <label>測試姓名 <input id="learner-name" maxlength="80" required autocomplete="off"></label><button>開始記錄本次學習</button></form><p id="learning-state" role="status">尚未開始；教材仍可自由閱讀。</p><button id="learning-end" class="secondary" hidden>結束本次記錄</button><a href="admin.html">查看此瀏覽器的學習成果</a>';
 document.querySelector('header').after(panel);
 let session=null,active=0,lastTick=performance.now(),lastAction=performance.now(),saving=false;
 const state=document.getElementById('learning-state');
 for(const event of ['pointerdown','keydown','scroll','touchstart'])document.addEventListener(event,()=>lastAction=performance.now(),{passive:true});
 async function flush(){if(!session||saving)return;saving=true;const copy={...session,seconds:Math.floor(active),updated:new Date().toISOString()};try{await put('sessions',copy);state.textContent='正在記錄：'+session.number+'｜有效閱讀 '+Math.floor(active)+' 秒（已儲存）';return true}catch(e){state.textContent='儲存失敗，請保持頁面開啟並重試：'+e.message;return false}finally{saving=false}}
 setInterval(()=>{const now=performance.now(),delta=Math.min((now-lastTick)/1000,2);lastTick=now;if(session&&document.visibilityState==='visible'&&document.hasFocus()&&now-lastAction<60000)active+=delta},1000);
 setInterval(flush,10000);
 document.addEventListener('visibilitychange',flush);window.addEventListener('pagehide',flush);
 document.getElementById('learner-form').onsubmit=async e=>{e.preventDefault();if(session){state.textContent='請先結束本次記錄，再切換學生。';return}const number=document.getElementById('learner-number').value.trim(),name=document.getElementById('learner-name').value.trim();if(!number||!name)return;try{const old=(await all('students')).find(s=>s.number===number);if(old&&old.name!==name){state.textContent='此學號已有不同姓名，請確認或使用另一個測試學號。';return}await put('students',{number,name});session={id:crypto.randomUUID(),number,started:new Date().toISOString(),seconds:0};active=0;lastAction=lastTick=performance.now();await flush();document.getElementById('learning-end').hidden=false;document.querySelectorAll('#learner-form input,#learner-form button').forEach(e=>e.disabled=true)}catch(err){state.textContent='無法開始記錄：'+err.message}};
 document.getElementById('learning-end').onclick=async()=>{if(!await flush())return;session=null;active=0;state.textContent='本次記錄已結束。';document.getElementById('learning-end').hidden=true;document.querySelectorAll('#learner-form input,#learner-form button').forEach(e=>e.disabled=false)};
 const grade=document.getElementById('grade'),original=grade.onclick;
 grade.onclick=function(e){original.call(this,e);if(!session){state.textContent='測驗已批閱，但未開始學習記錄，因此沒有存入測試資料庫。';return}const payload=JSON.parse(document.getElementById('payload').textContent),quiz=payload.data.quiz;const answers=quiz.map(q=>{const checked=document.querySelector('input[name="'+q.id+'"]:checked');return {id:q.id,selected:checked?Number(checked.value):null,correct:q.correct}});const attempt={id:crypto.randomUUID(),number:session.number,session:session.id,submitted:new Date().toISOString(),score:answers.filter(a=>a.selected===a.correct).length,max:quiz.length,answers};put('attempts',attempt).then(()=>{state.textContent='本次測驗已存入此瀏覽器：'+attempt.score+' / '+attempt.max}).catch(err=>state.textContent='測驗儲存失敗：'+err.message)};
})();

