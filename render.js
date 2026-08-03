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

/* ---------- auto-discover unregistered .md files (the "drawer") ----------
   Any .md dropped into posts/ manually becomes readable from the site,
   even before it's registered. Underscore-prefixed files = drafts, hidden. */
function discoverUnfiled(el){
  function slugOf(name){ return name.replace(/\.md$/i,""); }
  function pretty(slug){
    return slug.replace(/[-_]+/g," ").replace(/\b\w/g,function(c){return c.toUpperCase();});
  }
  fetch("https://api.github.com/repos/Huy-Lieu/Huy-Lieu.github.io/contents/posts?ref=main")
    .then(function(r){ if(!r.ok) throw new Error("api"); return r.json(); })
    .then(function(files){
      const registered = SITE_DATA.posts.map(function(p){
        const m = String(p.file).match(/p=([a-z0-9_\-]+)/i);
        return m ? m[1].toLowerCase() : null;
      });
      const unfiled = files.filter(function(f){
        if(!/\.md$/i.test(f.name)) return false;
        const slug = slugOf(f.name);
        if(slug.charAt(0)==="_") return false;
        return registered.indexOf(slug.toLowerCase())<0;
      });
      if(!unfiled.length){ el.innerHTML=""; return; }
      el.innerHTML =
        '<div class="unfiled-label">in the drawer — readable now · shelve them properly via studio → manage → import</div>'+
        unfiled.map(function(f){
          const slug = slugOf(f.name);
          return '<a class="postcard unfiled" href="post.html?p='+encodeURIComponent(slug)+'">'+
            '<div class="postcard-head"><span class="entry-date">unfiled</span></div>'+
            '<h3>'+esc(pretty(slug))+'</h3>'+
            '<p>dropped straight into posts/'+esc(f.name)+' — no date or summary until it\'s registered</p></a>';
        }).join("");
    })
    .catch(function(){ /* API hiccup/rate limit: the curated shelf still shows */ });
}

/* ---------- notebook filters: search + tags + moods (notes page) ---------- */
function renderFilters(el, listEl){
  const state = { tag:"*", mood:"*", q:"" };
  const tags = [], moods = [];
  SITE_DATA.entries.forEach(e => {
    (e.tags||[]).forEach(t => { if (tags.indexOf(t)<0) tags.push(t); });
    if (e.mood && moods.indexOf(e.mood)<0) moods.push(e.mood);
  });
  el.innerHTML =
    '<input class="fsearch" type="text" placeholder="search the logbook…">'+
    '<div class="frow" id="frowTag"><button class="fchip active" data-tag="*">all</button>'+
    tags.map(t => '<button class="fchip" data-tag="'+esc(t)+'">'+esc(t)+'</button>').join("")+'</div>'+
    (moods.length ?
      '<div class="frow frow-mood" id="frowMood"><button class="fchip active" data-mood="*">all moods</button>'+
      moods.map(m => '<button class="fchip" data-mood="'+esc(m)+'">'+m+'</button>').join("")+'</div>' : "")+
    '<div class="fcount"></div>';
  const countEl = el.querySelector(".fcount");
  function apply(){
    const f = SITE_DATA.entries.filter(e => {
      if (state.tag!=="*" && (e.tags||[]).indexOf(state.tag)<0) return false;
      if (state.mood!=="*" && e.mood!==state.mood) return false;
      if (state.q && String(e.text).toLowerCase().indexOf(state.q)<0) return false;
      return true;
    });
    listEl.innerHTML = f.length ? f.map(entryHTML).join("")
      : '<div class="count-line">no pages match — loosen the filters</div>';
    countEl.textContent = (f.length===SITE_DATA.entries.length) ? ""
      : "showing "+f.length+" of "+SITE_DATA.entries.length+" pages";
  }
  el.querySelector(".fsearch").addEventListener("input", function(){
    state.q = this.value.trim().toLowerCase(); apply();
  });
  el.querySelector("#frowTag").addEventListener("click", function(ev){
    const b = ev.target.closest(".fchip"); if (!b) return;
    this.querySelectorAll(".fchip").forEach(x => x.classList.remove("active"));
    b.classList.add("active"); state.tag = b.dataset.tag; apply();
  });
  const moodRow = el.querySelector("#frowMood");
  if (moodRow) moodRow.addEventListener("click", function(ev){
    const b = ev.target.closest(".fchip"); if (!b) return;
    moodRow.querySelectorAll(".fchip").forEach(x => x.classList.remove("active"));
    b.classList.add("active"); state.mood = b.dataset.mood; apply();
  });
}
