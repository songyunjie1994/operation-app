export const RECHARGE_URL='https://songyunjie1994.github.io/traffic-manager/';
export function loadRecharge(frame,status,{reload=false,isActive=()=>true}={}){
 if(frame.dataset.loaded&&!reload)return;
 frame.dataset.status='正在打开充值端…';status.textContent=frame.dataset.status;frame.setAttribute('aria-busy','true');
 frame.onload=()=>{
  frame.setAttribute('aria-busy','false');
  try{
   const w=frame.contentWindow,doc=frame.contentDocument;
   if(typeof w.switchView!=='function')throw Error('unavailable');
   w.switchView('campaigns');
   if(!doc.getElementById('ops-recharge-embed-style')){const style=doc.createElement('style');style.id='ops-recharge-embed-style';style.textContent='#sidebar{display:none!important}.app-shell{grid-template-columns:minmax(0,1fr)!important}.main-content{margin-left:0!important;min-width:0!important;width:100%!important}.sidebar-toggle,#sidebarOverlay{display:none!important}';doc.head.appendChild(style);}
   frame.dataset.status='已打开原充值端，编辑权限沿用原页面。';
  }catch{frame.dataset.status='页面已打开；如未显示充值内容，可点右上方“新窗口打开”进入原充值端。';}
  if(isActive())status.textContent=frame.dataset.status;
 };
 frame.dataset.loaded='true';frame.src=RECHARGE_URL;
}
