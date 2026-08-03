/* ============================================================
   studio.js — the garage's writing UI.
   Publishes notes / posts / images via the GitHub Contents API.
   Token lives only in this browser's localStorage.
   ============================================================ */
(function(){
"use strict";

var REPO="Huy-Lieu/Huy-Lieu.github.io";
var BRANCH="main";
var API="https://api.github.com/repos/"+REPO+"/contents/";
var TOK_KEY="budaica_gh_token";

var MOODS=["💡","🧠","📡","🔧","⚡","🎯","🚀","📄","🌧️","😤","☕","🏁"];
var TAGS=["learning","life","career","website","SPI","UART","I2C","CAN","LIN","C","python","HIL","automotive"];
/* vocabulary the importer scans for when tagging a hand-dropped post */
var TAG_VOCAB=["SPI","UART","I2C","CAN","LIN","HIL","automotive","python"];
function deriveTags(text){
  var tags=["learning"];
  TAG_VOCAB.forEach(function(t){
    if(new RegExp("\\b"+t+"\\b","i").test(text)&&tags.indexOf(t)<0)tags.push(t);
  });
  return tags;
}
function tidySummary(para){
  var s=para.replace(/[*_`>]/g,"").replace(/\[([^\]]*)\]\([^)]*\)/g,"$1").trim();
  if(s.length<=170)return s||"—";
  s=s.slice(0,170);
  s=s.slice(0,s.lastIndexOf(" ")).replace(/[,;:\-—\s]+$/,"")+"…";
  return s;
}

var state={mood:"💡",nTags:["learning"],pTags:["learning"],slugTouched:false,writing:false};

/* ---------------- tiny helpers ---------------- */
function $(id){return document.getElementById(id);}
function tok(){return localStorage.getItem(TOK_KEY)||"";}
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function b64e(s){return btoa(unescape(encodeURIComponent(s)));}
function b64d(s){return decodeURIComponent(escape(atob(String(s).replace(/\n/g,""))));}
function pad(n){return (n<10?"0":"")+n;}
function today(){var d=new Date();return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());}
function jstr(s){return JSON.stringify(String(s));}
function taglistJs(arr){return '["'+arr.map(function(t){return t.replace(/"/g,'\\"');}).join('", "')+'"]';}
function status(msg,kind){var el=$("statusLine");el.textContent=msg;el.className="status "+(kind||"");}
function tstatus(msg,kind){var el=$("tokStatus");el.textContent=msg;el.className="status "+(kind||"");}
function slugify(s){return s.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");}
function cleanName(n){return n.toLowerCase().replace(/[^a-z0-9.\-_]+/g,"-").replace(/-+/g,"-");}
function debounce(fn,ms){var t;return function(){clearTimeout(t);var a=arguments,c=this;t=setTimeout(function(){fn.apply(c,a);},ms);};}

/* ---------------- GitHub API ---------------- */
function authH(){
  return {"Authorization":"Bearer "+tok(),"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};
}
function ghGet(path){
  return fetch(API+path+"?ref="+BRANCH,{headers:authH()}).then(function(r){
    if(r.status===404)return null;
    if(r.status===401)throw new Error("token rejected (401) — check setup");
    if(!r.ok)throw new Error("GitHub GET "+path+" -> "+r.status);
    return r.json();
  });
}
function ghPut(path,contentB64,sha,message){
  var body={message:message,content:contentB64,branch:BRANCH};
  if(sha)body.sha=sha;
  return fetch(API+path,{method:"PUT",headers:authH(),body:JSON.stringify(body)}).then(function(r){
    if(!r.ok){
      return r.json().then(function(j){throw new Error("GitHub PUT "+path+" -> "+r.status+" "+(j.message||""));});
    }
    return r.json();
  });
}
function getDataJs(){
  return ghGet("data.js").then(function(f){
    if(!f)throw new Error("data.js not found in repo?");
    return {text:b64d(f.content),sha:f.sha};
  });
}
function insertBlock(src,marker,block){
  var i=src.indexOf(marker);
  if(i<0)throw new Error("couldn't find `"+marker+"` in data.js — use the Copy button and paste manually");
  var at=i+marker.length;
  return src.slice(0,at)+"\n"+block+src.slice(at);
}

/* ---------------- 409-safe writes ----------------
   GitHub refuses a PUT/DELETE with 409 when the sha we hold is stale
   (its read cache lags a few seconds after any write, or two writes race).
   Cure: re-read the file fresh, redo the change, try again — up to 3x. */
function delay(ms){return new Promise(function(res){setTimeout(res,ms);});}
function putFileRetry(path,contentB64,msg,attempts){
  attempts=attempts||3;
  return ghGet(path).then(function(f){
    return ghPut(path,contentB64,f?f.sha:null,msg);
  }).catch(function(e){
    if(attempts>1&&/409/.test(e.message)){
      status("version moved — re-reading and retrying…","busy");
      return delay(1200).then(function(){return putFileRetry(path,contentB64,msg,attempts-1);});
    }
    throw e;
  });
}
function deleteFileRetry(path,msg,attempts){
  attempts=attempts||3;
  return ghGet(path).then(function(f){
    if(!f)return null;
    return ghDelete(path,f.sha,msg);
  }).catch(function(e){
    if(attempts>1&&/409/.test(e.message)){
      return delay(1200).then(function(){return deleteFileRetry(path,msg,attempts-1);});
    }
    throw e;
  });
}
/* data.js writer with fresh-read retry. mutate(text) -> newText, or null to skip the write. */
function writeDataJs(mutate,msg,attempts){
  attempts=attempts||3;
  return getDataJs().then(function(d){
    var next=mutate(d.text);
    if(next===null)return null;
    return ghPut("data.js",b64e(next),d.sha,msg);
  }).catch(function(e){
    if(attempts>1&&/409/.test(e.message)){
      status("data.js moved — re-reading and retrying…","busy");
      return delay(1200).then(function(){return writeDataJs(mutate,msg,attempts-1);});
    }
    throw e;
  });
}

/* ---------------- token setup ---------------- */
function refreshTokUi(){
  if(tok()){tstatus("token saved in this browser ✓ — you're ready to publish","ok");}
  else{tstatus("no token saved — publishing needs one","err");}
}
$("tokSave").addEventListener("click",function(){
  var v=$("tokIn").value.trim();
  if(!v){tstatus("paste the token first","err");return;}
  localStorage.setItem(TOK_KEY,v);
  $("tokIn").value="";
  tstatus("saved ✓ testing connection…","busy");
  ghGet("data.js").then(function(){tstatus("token works ✓ — you're ready to publish","ok");})
    .catch(function(e){tstatus(e.message,"err");});
});
$("tokTest").addEventListener("click",function(){
  if(!tok()){tstatus("no token saved","err");return;}
  tstatus("testing…","busy");
  ghGet("data.js").then(function(){tstatus("token works ✓","ok");})
    .catch(function(e){tstatus(e.message,"err");});
});
$("tokClear").addEventListener("click",function(){
  localStorage.removeItem(TOK_KEY);
  refreshTokUi();
});

/* ---------------- tabs ---------------- */
Array.prototype.forEach.call(document.querySelectorAll(".stab"),function(b){
  b.addEventListener("click",function(){
    document.querySelectorAll(".stab").forEach(function(x){x.classList.remove("on");});
    b.classList.add("on");
    $("tab-note").hidden=b.dataset.tab!=="note";
    $("tab-post").hidden=b.dataset.tab!=="post";
    $("tab-manage").hidden=b.dataset.tab!=="manage";
    status("","");
    if(b.dataset.tab==="manage"&&tok())loadManage();
  });
});

/* ---------------- chips (mood / tags) ---------------- */
function buildChips(el,items,selected,onPick,single){
  el.innerHTML="";
  items.forEach(function(it){
    var c=document.createElement("button");
    c.className="fchip"+(selected.indexOf(it)>-1?" active":"");
    c.textContent=it;
    c.addEventListener("click",function(){
      if(single){selected.length=0;selected.push(it);}
      else{
        var i=selected.indexOf(it);
        if(i>-1)selected.splice(i,1);else selected.push(it);
      }
      onPick();
    });
    el.appendChild(c);
  });
}
function renderMood(){buildChips($("moodRow"),MOODS,[state.mood],function(){state.mood=state.mood;renderMood();renderNotePreview();},true);}
function renderNTags(){buildChips($("nTagRow"),TAGS,state.nTags,function(){renderNTags();renderNotePreview();},false);}
function renderPTags(){buildChips($("pTagRow"),TAGS,state.pTags,function(){renderPTags();},false);}
function addCustom(inputEl,arr,render){
  var v=inputEl.value.trim();
  if(!v)return;
  if(arr.indexOf(v)<0)arr.push(v);
  if(TAGS.indexOf(v)<0)TAGS.push(v);
  inputEl.value="";
  render();
}

/* ---------------- NOTE ---------------- */
function noteBlock(){
  return "    {\n"+
    "      date: "+jstr($("nDate").value||today())+",\n"+
    "      mood: "+jstr(state.mood)+",\n"+
    "      tags: "+taglistJs(state.nTags)+",\n"+
    "      text: "+jstr($("nText").value.trim())+"\n"+
    "    },";
}
function renderNotePreview(){
  var d=$("nDate").value||today();
  var txt=$("nText").value.trim()||"<span style='opacity:.5'>your note appears here…</span>";
  var tags=state.nTags.map(function(t){return '<span class="tagchip" style="border-color:rgba(242,166,90,.4);color:var(--amber-soft)">'+esc(t)+"</span>";}).join("");
  $("nPreview").innerHTML=
    '<div class="entry-head"><span class="entry-date">'+esc(d)+'</span><span class="entry-mood">'+state.mood+'</span>'+
    '<span class="entry-tags">'+tags+'</span></div>'+
    '<div class="entry-text">'+($("nText").value.trim()?esc($("nText").value.trim()):txt)+"</div>";
}
$("nText").addEventListener("input",debounce(renderNotePreview,200));
$("nDate").addEventListener("change",renderNotePreview);
$("nTagAdd").addEventListener("click",function(){addCustom($("nTagCustom"),state.nTags,function(){renderNTags();renderNotePreview();});});

$("nPublish").addEventListener("click",function(){
  if(state.writing){status("one operation at a time — still writing…","err");return;}
  if(!tok()){status("add your token in setup first","err");return;}
  if(!$("nText").value.trim()){status("write something first","err");return;}
  var date=$("nDate").value||today();
  var block=noteBlock();
  var btn=this;
  state.writing=true;btn.disabled=true;
  status("publishing note…","busy");
  writeDataJs(function(text){return insertBlock(text,"entries: [",block);},"note "+date+" via studio")
  .then(function(){
    status("✓ note published — live on notes.html in ~1 minute","ok");
    $("nText").value="";
    renderNotePreview();
  }).catch(function(e){status(e.message,"err");})
  .then(function(){state.writing=false;btn.disabled=false;});
});
$("nCopy").addEventListener("click",function(){
  navigator.clipboard.writeText(noteBlock()).then(function(){
    status("block copied — paste it at the TOP of the entries list in data.js on GitHub","ok");
  });
});

/* ---------------- POST ---------------- */
function renderSlugEcho(){$("pSlugEcho").textContent=$("pSlug").value.trim()||"…";}
$("pTitle").addEventListener("input",function(){
  if(!state.slugTouched)$("pSlug").value=slugify($("pTitle").value);
  renderSlugEcho();
});
$("pSlug").addEventListener("input",function(){state.slugTouched=true;renderSlugEcho();});
$("pSlugRegen").addEventListener("click",function(){
  state.slugTouched=false;
  $("pSlug").value=slugify($("pTitle").value);
  renderSlugEcho();
});
$("pTagAdd").addEventListener("click",function(){addCustom($("pTagCustom"),state.pTags,renderPTags);});

/* editor helpers */
function ta(){return $("pBody");}
function insertAtCursor(text){
  var el=ta(),s=el.selectionStart,e=el.selectionEnd;
  el.value=el.value.slice(0,s)+text+el.value.slice(e);
  el.selectionStart=el.selectionEnd=s+text.length;
  el.focus();renderPostPreview();
}
function wrapSel(before,after,placeholder){
  var el=ta(),s=el.selectionStart,e=el.selectionEnd;
  var sel=el.value.slice(s,e)||placeholder||"text";
  el.value=el.value.slice(0,s)+before+sel+after+el.value.slice(e);
  el.selectionStart=s+before.length;
  el.selectionEnd=s+before.length+sel.length;
  el.focus();renderPostPreview();
}
function linePrefix(prefix){
  var el=ta(),s=el.selectionStart,e=el.selectionEnd;
  var start=el.value.lastIndexOf("\n",s-1)+1;
  var lines=el.value.slice(start,e).split("\n").map(function(l){return prefix+l;}).join("\n");
  el.value=el.value.slice(0,start)+lines+el.value.slice(e);
  el.selectionStart=el.selectionEnd=start+lines.length;
  el.focus();renderPostPreview();
}
/* list button: caret on any line -> marker appears there (even empty);
   multi-line selection -> convert each line (ordered lists get REAL numbers) */
function startList(marker,ordered){
  var el=ta(),s=el.selectionStart,e=el.selectionEnd;
  var start=el.value.lastIndexOf("\n",s-1)+1;
  if(s!==e){
    var n=0;
    var lines=el.value.slice(start,e).split("\n").map(function(l){
      if(!l.trim())return l;
      n++;
      return (ordered?n+". ":marker)+l;
    }).join("\n");
    el.value=el.value.slice(0,start)+lines+el.value.slice(e);
    el.selectionStart=el.selectionEnd=start+lines.length;
  }else{
    var line=el.value.slice(start,s);
    if(/^\s*(- |\d+\. )/.test(line)){el.focus();return;} /* already a list item */
    el.value=el.value.slice(0,start)+marker+el.value.slice(start);
    el.selectionStart=el.selectionEnd=s+marker.length;
  }
  el.focus();renderPostPreview();
}
/* Word-like list typing: Enter continues the list (real next number),
   Enter on an empty item leaves the list, Tab / Shift+Tab indents */
$("pBody").addEventListener("keydown",function(ev){
  var el=this;
  if(ev.key==="Enter"){
    if(el.selectionStart!==el.selectionEnd)return;
    var s=el.selectionStart;
    var start=el.value.lastIndexOf("\n",s-1)+1;
    var before=el.value.slice(start,s);
    var mb=before.match(/^(\s*)- (.*)$/);
    var mo=before.match(/^(\s*)(\d+)\. (.*)$/);
    var next,content;
    if(mb){next=mb[1]+"- ";content=mb[2];}
    else if(mo){next=mo[1]+(parseInt(mo[2],10)+1)+". ";content=mo[3];}
    else return;
    ev.preventDefault();
    if(content.trim()===""){
      /* empty item -> remove the marker line entirely, land on a blank line */
      el.value=el.value.slice(0,start)+el.value.slice(s);
      el.selectionStart=el.selectionEnd=start;
    }else{
      var ins="\n"+next;
      el.value=el.value.slice(0,s)+ins+el.value.slice(s);
      el.selectionStart=el.selectionEnd=s+ins.length;
    }
    renderPostPreview();
  }else if(ev.key==="Tab"){
    var st=el.value.lastIndexOf("\n",el.selectionStart-1)+1;
    if(!/^\s*(- |\d+\. )/.test(el.value.slice(st)))return;
    ev.preventDefault();
    if(ev.shiftKey){
      if(el.value.slice(st,st+2)==="  "){
        el.value=el.value.slice(0,st)+el.value.slice(st+2);
        el.selectionStart=el.selectionEnd=Math.max(st,el.selectionStart-2);
      }
    }else{
      el.value=el.value.slice(0,st)+"  "+el.value.slice(st);
      el.selectionStart=el.selectionEnd=el.selectionStart+2;
    }
    renderPostPreview();
  }
});

var ACTIONS={
  h2:function(){linePrefix("## ");},
  h3:function(){linePrefix("### ");},
  b:function(){wrapSel("**","**","the key point");},
  i:function(){wrapSel("*","*","aside");},
  code:function(){wrapSel("`","`","0xFF");},
  codeblock:function(){wrapSel("\n```c\n","\n```\n","// code here");},
  callout:function(){linePrefix("> ");},
  table:function(){insertAtCursor("\n| Col A | Col B | Col C |\n|-------|-------|-------|\n| a | b | c |\n");},
  ul:function(){startList("- ",false);},
  ol:function(){startList("1. ",true);},
  link:function(){wrapSel("[","](https://)","link text");},
  hr:function(){insertAtCursor("\n---\n");},
  img:function(){$("imgPicker").click();}
};
Array.prototype.forEach.call(document.querySelectorAll("#toolbar .tbtn"),function(b){
  b.addEventListener("click",function(){ACTIONS[b.dataset.a]();});
});

/* image upload */
function ensureUnique(name,n,cb){
  var cand=n===1?name:name.replace(/(\.[^.]+)$/,"-"+n+"$1");
  ghGet("posts/img/"+cand).then(function(ex){
    if(!ex)cb(cand);else ensureUnique(name,n+1,cb);
  }).catch(function(e){status(e.message,"err");});
}
$("imgPicker").addEventListener("change",function(){
  var files=Array.prototype.slice.call(this.files||[]);
  this.value="";
  if(!files.length)return;
  if(!tok()){status("add your token in setup first, then upload images","err");return;}
  var queue=files.slice(),done=[];
  status("uploading image 1/"+queue.length+"…","busy");
  (function next(){
    if(!queue.length){
      insertAtCursor(done.map(function(n){return "\n!["+n.replace(/\.[^.]+$/,"").replace(/[-_]+/g," ")+"](img/"+n+")\n";}).join(""));
      status("✓ "+done.length+" image(s) uploaded to posts/img/ and inserted — publish the post to ship them together","ok");
      return;
    }
    var f=queue.shift();
    var name=cleanName(f.name);
    ensureUnique(name,1,function(uName){
      var rd=new FileReader();
      rd.onload=function(){
        var b64=String(rd.result).split(",")[1];
        ghPut("posts/img/"+uName,b64,null,"img "+uName+" via studio").then(function(){
          done.push(uName);
          status("uploading image "+(done.length+1)+"/"+(done.length+queue.length)+"…","busy");
          next();
        }).catch(function(e){status(e.message,"err");});
      };
      rd.readAsDataURL(f);
    });
  })();
});

/* preview */
function fixUrl(u){
  if(!u||/^(https?:)?\/\//.test(u)||u.charAt(0)==="#"||u.indexOf("data:")===0)return u;
  return "posts/"+u;
}
var pRenderer=null;
if(window.marked){
  pRenderer=new marked.Renderer();
  pRenderer.image=function(href,title,text){
    var t=title?' title="'+title+'"':"";
    return '<img src="'+fixUrl(href)+'" alt="'+(text||"")+'"'+t+'>';
  };
  pRenderer.link=function(href,title,text){
    var t=title?' title="'+title+'"':"";
    var ext=/^https?:\/\//.test(href)?' target="_blank" rel="noopener"':"";
    return '<a href="'+fixUrl(href)+'"'+t+ext+'>'+text+'</a>';
  };
  marked.setOptions({gfm:true,breaks:false});
}
function renderPostPreview(){
  var body=$("pBody").value.trim();
  if(!window.marked){$("pPreview").textContent=body;return;}
  $("pPreview").innerHTML=body?marked.parse(body,{renderer:pRenderer}):"<span style='opacity:.5'>your post renders here as you write…</span>";
}
$("pBody").addEventListener("input",debounce(renderPostPreview,250));

function fullMd(){
  var title=$("pTitle").value.trim()||"Untitled";
  return "# "+title+"\n\n"+$("pBody").value.trim()+"\n";
}
function postBlock(slug,title,summary){
  return "    {\n"+
    "      date: "+jstr(today())+",\n"+
    "      title: "+jstr(title)+",\n"+
    "      file: "+jstr("post.html?p="+slug)+",\n"+
    "      summary: "+jstr(summary||"—")+",\n"+
    "      tags: "+taglistJs(state.pTags)+"\n"+
    "    },";
}

$("pPublish").addEventListener("click",function(){
  if(state.writing){status("one operation at a time — still writing…","err");return;}
  if(!tok()){status("add your token in setup first","err");return;}
  var title=$("pTitle").value.trim();
  var slug=$("pSlug").value.trim();
  var summary=$("pSummary").value.trim();
  var body=$("pBody").value.trim();
  if(!title||!body){status("title and body are required","err");return;}
  if(!slug){status("slug is required (it becomes the filename)","err");return;}
  if(!/^[a-z0-9_][a-z0-9-_]*$/.test(slug)){status("slug: lowercase letters, numbers, hyphens, underscore only","err");return;}
  var btn=this;
  state.writing=true;btn.disabled=true;
  status("checking posts/"+slug+".md…","busy");
  ghGet("posts/"+slug+".md").then(function(existing){
    if(existing&&!window.confirm("posts/"+slug+".md already exists — overwrite it?")){
      throw new Error("cancelled — nothing was written");
    }
    status("writing posts/"+slug+".md…","busy");
    return putFileRetry("posts/"+slug+".md",b64e(fullMd()),"post "+slug+" via studio");
  }).then(function(){
    status("registering in data.js…","busy");
    return writeDataJs(function(text){
      if(text.indexOf("post.html?p="+slug)>-1)return null; /* already registered */
      return insertBlock(text,"posts: [",postBlock(slug,title,summary));
    },"register post "+slug+" via studio");
  }).then(function(){
    status("✓ post published — posts.html updates in ~1 min · read it at post.html?p="+slug,"ok");
  }).catch(function(e){status(e.message,"err");})
  .then(function(){state.writing=false;btn.disabled=false;});
});
$("pCopy").addEventListener("click",function(){
  var slug=$("pSlug").value.trim()||"your-slug";
  var txt=fullMd()+"\n\n<!-- register in data.js posts array:\n"+postBlock(slug,$("pTitle").value.trim()||"Untitled",$("pSummary").value.trim())+"\n-->\n";
  navigator.clipboard.writeText(txt).then(function(){
    status("copied — create posts/"+slug+".md on GitHub, paste, then paste the block into data.js","ok");
  });
});

/* ---------------- MANAGE (load + delete) ---------------- */
function ghDelete(path,sha,message){
  return fetch(API+path,{method:"DELETE",headers:authH(),
    body:JSON.stringify({message:message,sha:sha,branch:BRANCH})}).then(function(r){
    if(!r.ok)return r.json().then(function(j){throw new Error("GitHub DELETE "+path+" -> "+r.status+" "+(j.message||""));});
  });
}
/* remove one { … }, object block (lines) around the first line containing anchor */
function removeBlock(src,anchor){
  var lines=src.split("\n");
  var i=-1;
  for(var k=0;k<lines.length;k++){if(lines[k].indexOf(anchor)>-1){i=k;break;}}
  if(i<0)throw new Error("couldn't find that entry in data.js — reload and try again");
  var top=i;
  while(top>0&&lines[top].trim()!=="{")top--;
  var bot=i;
  while(bot<lines.length-1&&lines[bot].trim().charAt(0)!=="}")bot++;
  lines.splice(top,bot-top+1);
  return lines.join("\n");
}
function manageRow(meta,text,delLabel){
  var row=document.createElement("div");row.className="mrow";
  row.innerHTML='<span class="md">'+esc(meta)+'</span><span class="mt">'+text+'</span>';
  var del=document.createElement("button");
  del.className="mdel";del.textContent=delLabel;
  row.appendChild(del);
  return {row:row,del:del};
}
function registeredSlugs(SD){
  return SD.posts.map(function(p){
    var m=String(p.file).match(/p=([a-z0-9_\-]+)/i);
    return m?m[1].toLowerCase():null;
  });
}
/* shelve a hand-dropped .md: title from its first # line, summary from its first paragraph */
function importPost(f,slug){
  if(state.writing){status("one operation at a time — still writing…","err");return;}
  state.writing=true;
  status("reading posts/"+f.name+"…","busy");
  ghGet("posts/"+f.name).then(function(ff){
    var md=b64d(ff.content);
    var title=slug.replace(/[-_]+/g," ").replace(/\b\w/g,function(c){return c.toUpperCase();});
    md.replace(/^#\s+(.+)$/m,function(_,t){title=t.trim();return "";});
    var para="";
    var lines=md.split("\n");
    for(var i=0;i<lines.length;i++){
      var l=lines[i].trim();
      if(!l||l.charAt(0)==="#"||l.indexOf("```")===0)continue;
      para=l;break;
    }
    var summary=tidySummary(para);
    var block="    {\n"+
      "      date: "+jstr(today())+",\n"+
      "      title: "+jstr(title)+",\n"+
      "      file: "+jstr("post.html?p="+slug)+",\n"+
      "      summary: "+jstr(summary)+",\n"+
      "      tags: "+taglistJs(deriveTags(title+"\n"+md))+"\n"+
      "    },";
    status("shelving "+slug+"…","busy");
    return writeDataJs(function(text){
      if(text.indexOf("post.html?p="+slug)>-1)return null;
      return insertBlock(text,"posts: [",block);
    },"import post "+slug+" via studio");
  }).then(function(){
    status("✓ "+slug+" is on the shelf — posts.html updates in ~1 min","ok");
    return delay(900).then(loadManage);
  }).catch(function(e){status(e.message,"err");})
  .then(function(){state.writing=false;});
}
function loadManage(){
  if(!tok()){status("add your token in setup first","err");return;}
  status("loading your content from GitHub…","busy");
  ghGet("data.js").then(function(f){
    var SD=new Function(b64d(f.content)+";return SITE_DATA;")();
    var nEl=$("mNotes"),pEl=$("mPosts");
    nEl.innerHTML="";pEl.innerHTML="";
    SD.entries.forEach(function(e){
      var r=manageRow(e.date,(e.mood?e.mood+" ":"")+esc(e.text),"✕ delete");
      r.del.addEventListener("click",function(){
        if(state.writing){status("one operation at a time — still writing…","err");return;}
        if(!window.confirm("Delete the note from "+e.date+"?\n\n"+e.text.slice(0,140)+(e.text.length>140?"…":"")))return;
        state.writing=true;
        status("deleting note…","busy");
        writeDataJs(function(text){return removeBlock(text,"text: "+jstr(e.text));},"delete note "+e.date+" via studio")
        .then(function(){
          status("✓ note deleted — refreshing list…","ok");
          return delay(900).then(loadManage);
        }).catch(function(err){status(err.message,"err");})
        .then(function(){state.writing=false;});
      });
      nEl.appendChild(r.row);
    });
    SD.posts.forEach(function(p){
      var m=String(p.file).match(/p=([a-z0-9_\-]+)/i);
      var slug=m?m[1]:null;
      var r=manageRow(p.date,esc(p.title)+(slug?' <span style="opacity:.5">· '+esc(slug)+'</span>':''),"✕ delete");
      r.del.addEventListener("click",function(){
        if(state.writing){status("one operation at a time — still writing…","err");return;}
        if(!slug){status("that post is a hand-written HTML page — delete it directly in the repo","err");return;}
        if(!window.confirm("Delete post \""+p.title+"\"?\n\nThis removes the registration AND posts/"+slug+".md\n(images in posts/img/ stay in the library)."))return;
        state.writing=true;
        status("deleting post…","busy");
        writeDataJs(function(text){return removeBlock(text,jstr("post.html?p="+slug));},"unregister post "+slug+" via studio")
        .then(function(){return deleteFileRetry("posts/"+slug+".md","delete post "+slug+" via studio");})
        .then(function(){
          status("✓ post deleted — refreshing list…","ok");
          return delay(900).then(loadManage);
        }).catch(function(err){status(err.message,"err");})
        .then(function(){state.writing=false;});
      });
      pEl.appendChild(r.row);
    });
    if(!SD.entries.length)nEl.innerHTML='<div class="hintline">no notes yet</div>';
    if(!SD.posts.length)pEl.innerHTML='<div class="hintline">no posts yet</div>';
    /* loose .md files dropped into posts/ by hand */
    var uEl=$("mUnfiled");
    uEl.innerHTML='<div class="hintline">scanning posts/…</div>';
    ghGet("posts").then(function(files){
      var unfiled=(files||[]).filter(function(f){
        if(!/\.md$/i.test(f.name))return false;
        var slug=f.name.replace(/\.md$/i,"");
        if(slug.charAt(0)==="_")return false; /* drafts/template stay hidden */
        return registeredSlugs(SD).indexOf(slug.toLowerCase())<0;
      });
      if(!unfiled.length){uEl.innerHTML='<div class="hintline">no loose files — everything is shelved ✓</div>';return;}
      uEl.innerHTML="";
      unfiled.forEach(function(f){
        var slug=f.name.replace(/\.md$/i,"");
        var r=manageRow(slug,'<span style="opacity:.6">posts/'+esc(f.name)+' — readable, but not on the shelf</span>',"⇪ import");
        r.del.classList.add("imp");
        r.del.addEventListener("click",function(){importPost(f,slug);});
        uEl.appendChild(r.row);
      });
    }).catch(function(){uEl.innerHTML='<div class="hintline">scan failed (rate limit?) — try reloading</div>';});
    status("loaded ✓ — "+SD.entries.length+" notes · "+SD.posts.length+" posts","ok");
  }).catch(function(e){status(e.message,"err");});
}
$("mLoad").addEventListener("click",loadManage);

/* ---------------- init ---------------- */
$("nDate").value=today();
renderMood();
renderNTags();
renderPTags();
renderNotePreview();
renderPostPreview();
renderSlugEcho();
refreshTokUi();
})();
