(()=>{
'use strict';
const API='/api/messages';
const device=()=>localStorage.getItem('chat_device_id')||'';
const username=()=>window.settings?.username||localStorage.getItem('chat_username')||'User';
const channel=()=>window.CHANNEL||'general';
const css=document.createElement('style');
css.textContent=`.msgctx{position:fixed;z-index:50000;min-width:170px;background:var(--panel,#20242b);color:var(--text,#fff);border:1px solid #fff2;border-radius:9px;box-shadow:0 12px 40px #0009;padding:5px;display:none}.msgctx.show{display:block}.msgctx button{display:block;width:100%;border:0;background:none;color:inherit;text-align:left;padding:10px 12px;border-radius:6px;cursor:pointer;font:inherit}.msgctx button:hover{background:#fff1}.msgctx .danger{color:#ff7777}.msgedit{position:fixed;z-index:50001;left:50%;top:50%;transform:translate(-50%,-50%);width:min(520px,calc(100vw - 30px));background:var(--panel,#20242b);color:var(--text,#fff);border:1px solid #fff2;border-radius:12px;box-shadow:0 20px 70px #000b;padding:16px;display:none}.msgedit.show{display:block}.msgedit textarea{width:100%;box-sizing:border-box;min-height:110px;resize:vertical;background:#0003;color:inherit;border:1px solid #fff2;border-radius:8px;padding:10px;font:inherit}.msgedit-actions{display:flex;gap:8px;margin-top:10px}.msgedit-actions button{flex:1;padding:9px;border-radius:8px;border:1px solid #fff2;background:#fff1;color:inherit;cursor:pointer}.msgedit-actions .save{font-weight:700}`;
document.head.appendChild(css);
const menu=document.createElement('div');menu.className='msgctx';menu.innerHTML='<button id="mce">✏️ Edit message</button><button id="mcd" class="danger">🗑️ Delete message</button>';document.body.appendChild(menu);
const edit=document.createElement('div');edit.className='msgedit';edit.innerHTML='<b>Edit message</b><textarea id="mct"></textarea><div class="msgedit-actions"><button id="mcc">Cancel</button><button id="mcs" class="save">Save</button></div>';document.body.appendChild(edit);
const text=edit.querySelector('#mct');let target=null;
function closeMenu(){menu.classList.remove('show');target=null}
function getId(el){let n=el;while(n&&n!==document.body){if(n.dataset?.id&&/^game_/.test(n.dataset.id)===false)return n.dataset.id;n=n.parentElement}return null}
function getMessage(el,id){if(window.currentMessages?.length)return window.currentMessages.find(m=>String(m.id)===String(id))||null;const raw=el?.dataset?.message;try{return raw?JSON.parse(raw):null}catch{return null}}
async function request(method,body){const r=await fetch(API,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||'Request failed');return d}
async function reload(){if(typeof window.loadMessages==='function'){try{await window.loadMessages();return}catch{}}location.reload()}
menu.querySelector('#mce').onclick=()=>{const t=target;if(!t){closeMenu();return}const id=getId(t);if(!id){closeMenu();return}const msg=getMessage(t,id);const old=msg?.message??t.querySelector?.('.message-text,.message-content,.message-body')?.textContent??'';text.value=old;edit.dataset.id=id;edit.classList.add('show');menu.classList.remove('show')};
menu.querySelector('#mcd').onclick=async()=>{const t=target,id=t&&getId(t);closeMenu();if(!id)return;if(!confirm('Delete this message?'))return;try{await request('DELETE',{id,device_id:device(),channel:channel()});await reload()}catch(e){alert(e.message||'Could not delete message.')}};
edit.querySelector('#mcc').onclick=()=>edit.classList.remove('show');
edit.querySelector('#mcs').onclick=async()=>{const id=edit.dataset.id,v=text.value.trim();if(!id)return;if(!v){alert('Message cannot be empty.');return}try{await request('PATCH',{id,device_id:device(),message:v,channel:channel()});edit.classList.remove('show');await reload()}catch(e){alert(e.message||'Could not edit message.')}};
document.addEventListener('contextmenu',e=>{const el=e.target.closest?.('[data-id]');if(!el||!document.getElementById('messages')?.contains(el))return;const id=getId(el);if(!id)return;e.preventDefault();target=el;menu.style.left=Math.min(e.clientX,innerWidth-190)+'px';menu.style.top=Math.min(e.clientY,innerHeight-105)+'px';menu.classList.add('show')});
document.addEventListener('click',e=>{if(!menu.contains(e.target))closeMenu();if(edit.classList.contains('show')&&!edit.contains(e.target)&&e.target!==menu){} });
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();edit.classList.remove('show')}});
})();