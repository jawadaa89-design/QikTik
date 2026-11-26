/** Inline pull-to-refresh for SSR staff boards (pickup/alerts live HTML). */
export const MOBILE_PULL_REFRESH_SCRIPT = `<style>
#qiktik-ptr{position:fixed;top:0;left:0;right:0;z-index:2147482000;display:none;justify-content:center;pointer-events:none;padding-top:max(8px,env(safe-area-inset-top))}
#qiktik-ptr i{width:36px;height:36px;border-radius:999px;border:2px solid rgba(196,163,90,.35);border-top-color:#c4a35a;background:rgba(12,16,14,.72);box-shadow:0 8px 24px rgba(0,0,0,.35)}
#qiktik-ptr.spin i{animation:qiktik-ptr-spin .7s linear infinite}
@keyframes qiktik-ptr-spin{to{transform:rotate(360deg)}}
</style>
<div id="qiktik-ptr" aria-hidden="true"><i></i></div>
<script>
(function(){
  if(!window.matchMedia||!window.matchMedia("(pointer: coarse)").matches) return;
  var TH=72,MAX=120,startY=0,pulling=false,pull=0,busy=false;
  var el=document.getElementById("qiktik-ptr");
  var ring=el&&el.querySelector("i");
  function top(){return window.scrollY||document.documentElement.scrollTop||document.body.scrollTop||0;}
  function paint(){
    if(!el||!ring) return;
    if(pull<=4&&!busy){el.style.display="none";return;}
    el.style.display="flex";
    el.style.opacity=String(busy?1:0.35+Math.min(1,pull/TH)*0.65);
    el.style.transform="translateY("+Math.max(0,pull-28)+"px)";
    if(!busy) ring.style.transform="rotate("+(Math.min(1,pull/TH)*270)+"deg)";
    el.classList.toggle("spin",busy);
  }
  document.addEventListener("touchstart",function(e){
    if(busy) return;
    if(top()>1){pulling=false;return;}
    startY=e.touches[0].clientY;pulling=true;
  },{passive:true});
  document.addEventListener("touchmove",function(e){
    if(!pulling||busy) return;
    if(top()>1){pulling=false;pull=0;paint();return;}
    var d=e.touches[0].clientY-startY;
    if(d<=0){pull=0;paint();return;}
    pull=Math.min(MAX,d*0.45);
    paint();
    if(pull>8&&e.cancelable) e.preventDefault();
  },{passive:false});
  function end(){
    if(!pulling) return;
    pulling=false;
    if(pull>=TH&&!busy){
      busy=true;pull=TH;paint();
      setTimeout(function(){location.reload();},180);
      return;
    }
    pull=0;paint();
  }
  document.addEventListener("touchend",end,{passive:true});
  document.addEventListener("touchcancel",end,{passive:true});
})();
</script>`;
