import { useEffect, useMemo, useRef, useState } from "react";
import { getDirection, getMessages, type Locale } from "./i18n";
import { isSupportedImage, readImageZip } from "./imageLibrary";
import PaperLayoutStudio from "./PaperLayoutStudio";
import PhotoStudio from "./PhotoStudio";
import BatchLab from "./BatchLab";
import { loadImageLibrary, saveImageLibrary } from "./localWorkspace";

type SortMode = "name" | "size" | "date";
interface LibraryImage { id: string; file: File; url: string; width: number; height: number }
interface ImportSummary { accepted: number; unsupported: number; damaged: number; duplicates: number }
const toolIcons = ["▦", "✳", "▧", "⌘"];

export default function App() {
 const [locale,setLocale]=useState<Locale>(()=>{try{return window.localStorage.getItem("waraqati-locale")==="en"?"en":"ar";}catch{return "ar";}});
 const [images,setImages]=useState<LibraryImage[]>([]);
 const [libraryHydrated,setLibraryHydrated]=useState(false);
 const [libraryStorageReady,setLibraryStorageReady]=useState(false);
 const [selected,setSelected]=useState<string[]>([]);
 const [sortMode,setSortMode]=useState<SortMode>("name");
 const [query,setQuery]=useState("");
 const [busy,setBusy]=useState(false);
 const [progress,setProgress]=useState({done:0,total:0});
 const [summary,setSummary]=useState<ImportSummary|null>(null);
 const [error,setError]=useState("");
 const fileInput=useRef<HTMLInputElement>(null), folderInput=useRef<HTMLInputElement>(null), zipInput=useRef<HTMLInputElement>(null);
 const urls=useRef<string[]>([]);
 const t=getMessages(locale), direction=getDirection(locale);
 const collator=useMemo(()=>new Intl.Collator(locale,{numeric:true,sensitivity:"base"}),[locale]);
 const filtered=useMemo(()=>images.filter(x=>x.file.name.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale))).sort((a,b)=>sortMode==="size"?b.file.size-a.file.size||collator.compare(a.file.name,b.file.name):sortMode==="date"?b.file.lastModified-a.file.lastModified||collator.compare(a.file.name,b.file.name):collator.compare(a.file.name,b.file.name)),[images,query,sortMode,locale,collator]);
 const studioImages=useMemo(()=>images.map(image=>({id:image.id,name:image.file.name,url:image.url,width:image.width,height:image.height})),[images]);
 const batchImages=useMemo(()=>images.map(image=>({id:image.id,name:image.file.name,url:image.url,width:image.width,height:image.height,file:image.file})),[images]);

 useEffect(()=>{document.documentElement.lang=locale;document.documentElement.dir=direction;try{window.localStorage.setItem("waraqati-locale",locale);}catch{/* Language selection still works for this session when storage is blocked. */}},[locale,direction]);
 useEffect(()=>{
  folderInput.current?.setAttribute("webkitdirectory","");
  let cancelled=false;
  void (async()=>{
   try{
    const stored=await loadImageLibrary();
    const restored:LibraryImage[]=stored.map(item=>{
     const file=new File([item.blob],item.name,{type:item.type,lastModified:item.lastModified});
     const url=URL.createObjectURL(file);urls.current.push(url);
     return {id:item.id,file,url,width:0,height:0};
    });
    await Promise.all(restored.map(async image=>{
     try{const bitmap=await createImageBitmap(image.file);image.width=bitmap.width;image.height=bitmap.height;bitmap.close();}catch{/* Keep unreadable files visible so they can be removed. */}
    }));
    if(cancelled){restored.forEach(image=>URL.revokeObjectURL(image.url));return;}
    setImages(restored);
    setLibraryStorageReady(true);
    setLibraryHydrated(true);
   }catch{
    if(!cancelled){setError(locale==="ar"?"التخزين المحلي للصور غير متاح. يمكنك متابعة العمل في هذه الجلسة، لكن قد لا تُحفظ الصور بعد إغلاق التطبيق.":"Local image storage is unavailable. You can keep working in this session, but images may not persist after closing the app.");setLibraryHydrated(true);}
   }
  })();
  return()=>{cancelled=true;urls.current.forEach(URL.revokeObjectURL);};
 },[]);
 useEffect(()=>{
  if(!libraryHydrated||!libraryStorageReady)return;
  void saveImageLibrary(images.map(image=>({id:image.id,name:image.file.name,type:image.file.type,size:image.file.size,lastModified:image.file.lastModified,blob:image.file}))).catch(()=>setError(locale==="ar"?"تعذر حفظ مكتبة الصور محليًا. قد تكون مساحة المتصفح ممتلئة.":"Could not persist the image library. Browser storage may be full."));
 },[images,libraryHydrated,locale]);

 async function importFiles(incoming:FileList|File[],zipMode=false){
  if(!libraryHydrated){setError(locale==="ar"?"انتظر حتى تنتهي استعادة المكتبة المحلية.":"Wait for the local library to finish restoring.");return;}
  if(busy||!incoming.length)return;
  setBusy(true);setError("");setSummary(null);
  let candidates:File[]=[],unsupported=0,damaged=0;
  try{
   if(zipMode){try{const result=await readImageZip(incoming[0]);candidates=result.files;unsupported+=result.unsupported;damaged+=result.damaged;}catch{setError(t.zipError);return;}}
   else candidates=Array.from(incoming);
   const known=new Set(images.map(x=>`${x.file.name.toLowerCase()}|${x.file.size}|${x.file.lastModified}`));
   const additions:LibraryImage[]=[];let duplicates=0;setProgress({done:0,total:candidates.length});
   for(let i=0;i<candidates.length;i++){
    const file=candidates[i],signature=`${file.name.toLowerCase()}|${file.size}|${file.lastModified}`;
    if(known.has(signature)){duplicates++;setProgress({done:i+1,total:candidates.length});continue;}
    if(!isSupportedImage(file)){unsupported++;setProgress({done:i+1,total:candidates.length});continue;}
    let bitmap:ImageBitmap|undefined;
    try{
     bitmap=await createImageBitmap(file);
     if(!bitmap.width||!bitmap.height)throw new Error("invalid-image");
     const url=URL.createObjectURL(file);urls.current.push(url);
     additions.push({id:`${Date.now().toString(36)}-${i.toString(36)}-${Math.random().toString(36).slice(2,8)}`,file,url,width:bitmap.width,height:bitmap.height});known.add(signature);
    }catch{damaged++;}finally{bitmap?.close();setProgress({done:i+1,total:candidates.length});}
    if(i%6===5)await new Promise<void>(resolve=>window.setTimeout(resolve,0));
   }
   if(additions.length)setImages(old=>[...old,...additions]);
   setSummary({accepted:additions.length,unsupported,damaged,duplicates});
  }finally{
   setBusy(false);setProgress({done:0,total:0});
   if(fileInput.current)fileInput.current.value="";
   if(folderInput.current)folderInput.current.value="";
   if(zipInput.current)zipInput.current.value="";
  }
 }
 function toggle(id:string){setSelected(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);}
 function removeSelected(){const removed=new Set(selected);const gone=images.filter(x=>removed.has(x.id));gone.forEach(x=>{URL.revokeObjectURL(x.url);urls.current=urls.current.filter(url=>url!==x.url);});setImages(old=>old.filter(x=>!removed.has(x.id)));setSelected([]);}
 function clearLibrary(){images.forEach(x=>{URL.revokeObjectURL(x.url);urls.current=urls.current.filter(url=>url!==x.url);});setImages([]);setSelected([]);setSummary(null);}
 function selectAll(){setSelected(old=>old.length===filtered.length?[]:filtered.map(x=>x.id));}

 return <main className="app-shell" dir={direction}>
  <div className="ambient ambient-one" aria-hidden="true"/><div className="ambient ambient-two" aria-hidden="true"/>
  <header className="topbar"><a className="brand" href="#home" aria-label={t.brand}><span className="brand-mark" aria-hidden="true"><span/></span><span className="brand-word">{t.brand}<small>STUDIO</small></span></a><nav className="topbar-actions" aria-label={locale==="ar"?"إعدادات الموقع":"Site settings"}><span className="status"><i aria-hidden="true"/>{t.localWorkspace}</span><button className="language-button" onClick={()=>setLocale(locale==="ar"?"en":"ar")} type="button" aria-label={locale==="ar"?"Switch to English":"التبديل إلى العربية"}><span aria-hidden="true">文/A</span>{t.language}</button></nav></header>
  <section className="hero" id="home" aria-labelledby="hero-title"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/>{t.eyebrow}</div><h1 id="hero-title">{t.title}<span className="title-spark" aria-hidden="true">✳</span></h1><p className="hero-subtitle">{t.subtitle}</p><div className="hero-actions"><a className="button button-primary" href="#library">{t.start}<span aria-hidden="true">{locale==="ar"?"↙":"↗"}</span></a><a className="button button-quiet" href="#tools">{t.explore}<span aria-hidden="true">⌄</span></a></div><div className="hero-note"><span className="note-icon" aria-hidden="true">✦</span><span>{t.heroNote}</span></div><div className="trust-row"><span><i>✓</i>{t.localProcessing}</span><span><i>◇</i>{t.printReady}</span></div></div>
   <div className="preview-stage" role="img" aria-label={t.previewDescription}><div className="stage-orbit orbit-a"/><div className="stage-orbit orbit-b"/><div className="floating-label label-top"><span/>{t.freeLayout}</div><div className="paper paper-back"><div className="paper-lines"/></div><div className="paper paper-front"><div className="paper-heading"><span>W.</span><i/></div><div className="photo-grid"><div className="photo photo-one"><span className="sun"/><span className="hill hill-one"/><span className="hill hill-two"/></div><div className="photo photo-two"><span className="sun"/><span className="hill hill-one"/><span className="hill hill-two"/></div><div className="photo photo-three"><span className="sun"/><span className="hill hill-one"/><span className="hill hill-two"/></div></div><div className="paper-caption"><span/><span/><span/></div><div className="paper-footer"><b>{t.moments}</b><b>01 — 03</b></div></div><div className="floating-label label-bottom"><span className="label-check">✓</span>{t.readyToCreate}</div><div className="stage-glow"/><div className="stage-index">01 <span/> 04</div></div>
  </section>

  <section className="library-section" id="library" aria-labelledby="library-title">
   <div className="library-heading"><div><div className="section-kicker">{t.libraryKicker}</div><h2 id="library-title">{t.libraryTitle}</h2><p>{t.librarySubtitle}</p></div><div className="library-total"><strong>{images.length}</strong><span>{t.imagesCount}</span></div></div>
   <section className={`drop-zone ${busy?"is-busy":""}`} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="copy";}} onDrop={e=>{e.preventDefault();if(!busy)void importFiles(e.dataTransfer.files);}} aria-label={t.dropZoneLabel}>
    <div className="drop-symbol" aria-hidden="true">↥</div><div className="drop-copy"><strong>{t.dropTitle}</strong><span>{t.dropSubtitle}</span></div>
    <div className="import-actions"><button className="button button-primary" type="button" disabled={busy} onClick={()=>fileInput.current?.click()}>{t.chooseImages}<span>＋</span></button><button className="button button-quiet" type="button" disabled={busy} onClick={()=>folderInput.current?.click()}>{t.chooseFolder}</button><button className="button button-quiet" type="button" disabled={busy} onClick={()=>zipInput.current?.click()}>{t.importZip}</button></div>
    <input ref={fileInput} className="visually-hidden" type="file" accept="image/*" multiple onChange={e=>{if(e.currentTarget.files)void importFiles(e.currentTarget.files);}} aria-label={t.chooseImages}/>
    <input ref={folderInput} className="visually-hidden" type="file" multiple onChange={e=>{if(e.currentTarget.files)void importFiles(e.currentTarget.files);}} aria-label={t.chooseFolder}/>
    <input ref={zipInput} className="visually-hidden" type="file" accept=".zip,application/zip" onChange={e=>{if(e.currentTarget.files)void importFiles(e.currentTarget.files,true);}} aria-label={t.importZip}/>
    <p className="format-hint">{t.supportedFormats}</p>
   </section>
   {busy&&<div className="import-progress" role="status" aria-live="polite"><div className="progress-label"><span>{t.processing}</span><strong>{progress.total?Math.round(progress.done/progress.total*100):0}%</strong></div><div className="progress-track"><span style={{width:progress.total?`${progress.done/progress.total*100}%`:"0%"}}/></div><small>{progress.done} / {progress.total}</small></div>}
   {error&&<p className="import-alert import-alert-error" role="alert">{error}</p>}
   {summary&&<div className="import-summary" role="status" aria-live="polite"><strong>{t.importComplete}</strong><span>{t.accepted}: {summary.accepted}</span><span>{t.unsupported}: {summary.unsupported}</span><span>{t.damaged}: {summary.damaged}</span><span>{t.duplicates}: {summary.duplicates}</span></div>}
   <div className="library-toolbar"><div className="library-stats"><span className="stat-dot"/>{images.length} {t.imagesCount}<span className="toolbar-divider"/>{selected.length} {t.selectedCount}</div><div className="library-controls"><label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.searchImages} aria-label={t.searchImages}/></label><label className="sort-field"><span>{t.sortBy}</span><select value={sortMode} onChange={e=>setSortMode(e.target.value as SortMode)} aria-label={t.sortBy}><option value="name">{t.sortName}</option><option value="size">{t.sortSize}</option><option value="date">{t.sortDate}</option></select></label></div></div>
   {images.length>0?<><div className="selection-toolbar"><button type="button" className="text-action" onClick={selectAll}>{selected.length===filtered.length?t.deselectAll:t.selectAll}</button><span>{filtered.length} {t.resultsCount}</span><button type="button" className="text-action danger-action" disabled={!selected.length} onClick={removeSelected}>{t.deleteSelected} ({selected.length})</button><button type="button" className="text-action danger-action" onClick={clearLibrary}>{t.clearLibrary}</button></div>
    {filtered.length?<div className="image-grid">{filtered.map(item=><article className={`image-card ${selected.includes(item.id)?"is-selected":""}`} key={item.id}><button type="button" className="image-select" onClick={()=>toggle(item.id)} aria-pressed={selected.includes(item.id)} aria-label={selected.includes(item.id)?t.deselectImage:t.selectImage}><span>{selected.includes(item.id)?"✓":""}</span></button><div className="thumbnail-wrap"><img src={item.url} alt="" loading="lazy"/><span className="image-dimensions">{item.width} × {item.height}</span></div><div className="image-meta"><strong title={item.file.name}>{item.file.name}</strong><span>{formatBytes(item.file.size,locale)} · {item.width/item.height>=1?t.landscape:t.portrait}</span></div></article>)}</div>:<div className="empty-state compact-empty"><span>⌕</span><strong>{t.noSearchResults}</strong><p>{t.tryDifferentSearch}</p></div>}
   </>:<div className="empty-state"><span className="empty-icon">▧</span><strong>{t.emptyLibrary}</strong><p>{t.emptyLibraryHint}</p></div>}
   <p className="privacy-note"><span aria-hidden="true">◇</span>{t.privacyNote}</p>
  </section>

  <PaperLayoutStudio images={studioImages} locale={locale} />
  <PhotoStudio images={studioImages} locale={locale} />
  <BatchLab images={batchImages} locale={locale} />

  <section className="tools-section" id="tools" aria-labelledby="tools-title"><div className="section-heading"><div><div className="section-kicker">{t.workspaceLabel}</div><h2 id="tools-title">{t.tools}</h2><p>{t.toolsSubtitle}</p></div><span className="section-count"><strong>04</strong><i/>{t.toolCount}</span></div><div className="tool-grid">{[t.layout,t.stickers,t.photos,t.batch].map((name,i)=><article className={`tool-card tool-card-${i+1}`} key={name}><div className="tool-card-top"><span className="tool-number">0{i+1}</span><span className="tool-icon" aria-hidden="true">{toolIcons[i]}</span></div><h3>{name}</h3><p className="tool-description">{[t.layoutDescription,t.stickersDescription,t.photosDescription,t.batchDescription][i]}</p><div className="tool-card-bottom">{<a className="tool-ready" href={i===0||i===1?"#layout-studio":i===2?"#photo-studio":"#batch-lab"}>{i===0?t.available:i===1?(locale==="ar"?"افتح الاستوديو":"Open Studio"):locale==="ar"?"ابدأ الآن":"Open tool"}<span aria-hidden="true"> ↗</span></a>}<span className="card-arrow" aria-hidden="true">↗</span></div></article>)}</div><p className="tools-disclaimer"><span>✦</span>{t.toolsDisclaimer}</p></section>
  <section className="principles" aria-label={t.principlesLabel}><article><span className="principle-icon">◈</span><div><h3>{t.localFirst}</h3><p>{t.localFirstBody}</p></div></article><article><span className="principle-icon">⌗</span><div><h3>{t.precision}</h3><p>{t.precisionBody}</p></div></article><article><span className="principle-icon">▣</span><div><h3>{t.responsive}</h3><p>{t.responsiveBody}</p></div></article></section>
  <footer className="footer"><a className="footer-brand" href="#home" aria-label={t.brand}>W<span>.</span></a><p>{t.footer}</p><span>{t.footerSignature}</span></footer>
 </main>;
}
function formatBytes(bytes:number,locale:Locale):string{return new Intl.NumberFormat(locale==="ar"?"ar":"en",{style:"unit",unit:"byte",unitDisplay:"short",maximumFractionDigits:1}).format(bytes);}
