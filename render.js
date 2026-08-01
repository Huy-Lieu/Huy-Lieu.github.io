/* ============================================================
   render.js — reads data.js and paints the pages.
   You should never need to edit this file.
   (To change content, edit data.js instead.)
   ============================================================ */

/* ---------- helpers ---------- */
function esc(s){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function fmtDate(iso){
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
}
function daysSince(iso){
  const t0 = new Date(iso + "T00:00:00").getTime();
  return Math.max(1, Math.floor((Date.now() - t0) / 86400000) + 1);
}
const TAG_COLORS = {
  learning: "#f2a65a",
  life:     "#7ee2a8",
  career:   "#82b4ff",
  website:  "#c9a0ff"
};
function tagChip(t){
  const c = TAG_COLORS[t] || "#9aa6bd";
  return '<span class="tagchip" style="color:'+c+';border-color:'+c+'55;background:'+c+'14">'+esc(t)+'</span>';
}

/* ---------- stats ---------- */
function roadmapStats(){
  let done = 0, total = 0;
  SITE_DATA.roadmap.forEach(p => p.items.forEach(i => { total++; if (i.done) done++; }));
  return { done, total, pct: total ? Math.round(done/total*100) : 0 };
}
function renderStats(el){
  const s = roadmapStats();
  el.innerHTML =
    '<div class="statline"><span class="n">'+SITE_DATA.entries.length+'</span><span class="l">entries logged</span></div>'+
    '<div class="statline"><span class="n">'+daysSince(SITE_DATA.startedDate)+'</span><span class="l">days on the road</span></div>'+
    '<div class="statline"><span class="n">'+s.pct+'%</span><span class="l">roadmap complete</span></div>';
}

/* ---------- currently learning ---------- */
function renderCurrent(el){
  const c = SITE_DATA.currentlyLearning;
  el.innerHTML =
    '<div class="cl-topic">'+esc(c.topic)+'</div>'+
    '<div class="cl-meta">since '+fmtDate(c.since)+' · '+esc(c.why)+'</div>'+
    (c.note ? '<div class="cl-note">'+esc(c.note)+'</div>' : '');
}

/* ---------- roadmap ---------- */
function renderRoadmap(el){
  const s = roadmapStats();
  let html =
    '<div class="progress"><div class="progress-label">overall progress · '+s.done+'/'+s.total+'</div>'+
    '<div class="progress-bar"><i style="width:'+s.pct+'%"></i></div></div>';
  SITE_DATA.roadmap.forEach(p => {
    const pd = p.items.filter(i => i.done).length;
    html += '<div class="phase"><h3>'+esc(p.phase)+
            '<span class="phase-count">'+pd+'/'+p.items.length+'</span></h3><ul>';
    p.items.forEach(i => {
      html += '<li class="'+(i.done?'done':'')+'"><span class="box">'+(i.done?'✓':'')+'</span>'+esc(i.name)+'</li>';
    });
    html += '</ul></div>';
  });
  el.innerHTML = html;
}

/* ---------- entries ---------- */
function entryHTML(e){
  const tags = (e.tags||[]).map(tagChip).join(" ");
  return '<article class="entry">'+
    '<div class="entry-head"><span class="entry-date">'+fmtDate(e.date)+'</span>'+
    (e.mood ? '<span class="entry-mood">'+e.mood+'</span>' : '')+
    '<span class="entry-tags">'+tags+'</span></div>'+
    '<p class="entry-text">'+esc(e.text)+'</p></article>';
}
function renderLatest(el, count){
  el.innerHTML = SITE_DATA.entries.slice(0, count).map(entryHTML).join("");
}
function renderAllEntries(el){
  el.innerHTML = SITE_DATA.entries.map(entryHTML).join("");
}
/* ---------- posts list (posts page) ---------- */
function renderPosts(el){
  el.innerHTML = SITE_DATA.posts.map(function(p){
    const tags = (p.tags||[]).map(tagChip).join(" ");
    return '<a class="postcard" href="'+esc(p.file)+'">'+
      '<div class="postcard-head"><span class="entry-date">'+fmtDate(p.date)+'</span>'+
      '<span class="entry-tags">'+tags+'</span></div>'+
      '<h3>'+esc(p.title)+'</h3>'+
      '<p>'+esc(p.summary)+'</p></a>';
  }).join("");
}

/* tag filter (notes page) */
function renderTagFilters(el, listEl){
  const tags = new Set();
  SITE_DATA.entries.forEach(e => (e.tags||[]).forEach(t => tags.add(t)));
  let html = '<button class="fchip active" data-tag="*">all</button>';
  tags.forEach(t => { html += '<button class="fchip" data-tag="'+esc(t)+'">'+esc(t)+'</button>'; });
  el.innerHTML = html;
  el.addEventListener("click", ev => {
    const b = ev.target.closest(".fchip"); if (!b) return;
    el.querySelectorAll(".fchip").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    const tag = b.dataset.tag;
    const filtered = tag === "*" ? SITE_DATA.entries
      : SITE_DATA.entries.filter(e => (e.tags||[]).includes(tag));
    listEl.innerHTML = filtered.map(entryHTML).join("");
  });
}
