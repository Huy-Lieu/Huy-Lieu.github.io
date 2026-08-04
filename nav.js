/* ---------- mobile nav: hamburger dropdown (<=720px) ----------
   Shared by every page. Desktop never sees the button; on phones the
   link list becomes a full-width panel with thumb-sized rows. */
(function(){
  var btn=document.getElementById("navToggle");
  var links=document.querySelector(".nav-links");
  if(!btn||!links)return;
  function setOpen(open){
    links.classList.toggle("open",open);
    btn.textContent=open?"✕":"☰";
    btn.setAttribute("aria-expanded",open?"true":"false");
  }
  btn.addEventListener("click",function(e){
    e.stopPropagation();
    setOpen(!links.classList.contains("open"));
  });
  /* tap a link -> panel closes behind the navigation */
  links.addEventListener("click",function(e){
    if(e.target.closest("a"))setOpen(false);
  });
  /* tap anywhere else -> close */
  document.addEventListener("click",function(e){
    if(!e.target.closest("nav"))setOpen(false);
  });
  document.addEventListener("keydown",function(e){
    if(e.key==="Escape")setOpen(false);
  });
  /* widening the window past this page's breakpoint resets state —
     detected from the toggle's own visibility, not a hardcoded width */
  window.addEventListener("resize",function(){
    if(window.getComputedStyle(btn).display==="none")setOpen(false);
  });
})();
