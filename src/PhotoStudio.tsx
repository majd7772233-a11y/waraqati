import { useEffect, useMemo, useState } from "react";
import { downloadBlob } from "./imageProcessing";

export interface PhotoStudioImage { id: string; name: string; url: string; width: number; height: number }
type Locale = "ar" | "en";
type PaperPreset = "4x6" | "5x7" | "A4" | "custom";
interface RenderedPage { blob: Blob; filename: string; width: number; height: number }

const copy = {
 ar: { kicker:"04 / استوديو الصور", title:"اصنع ورقة صورك بطريقتك.", subtitle:"أوراق Contact Sheet، صور شخصية، وتسميات اختيارية — كل شيء محلي داخل المتصفح.", select:"صور المكتبة", all:"تحديد الكل", clear:"إلغاء التحديد", preset:"مقاس الورقة", custom:"مخصص", width:"العرض (مم)", height:"الارتفاع (مم)", portrait:"صور شخصية", sheet:"Contact Sheet", cols:"الأعمدة", rows:"الصفوف", gap:"المسافة (مم)", margin:"الهامش (مم)", dpi:"الدقة", labels:"إظهار أسماء الصور", numbers:"إضافة أرقام", titleLabel:"عنوان الورقة", titlePlaceholder:"ذكريات جميلة", generate:"إنشاء معاينة الورقة", render:"جارٍ إنشاء الصفحات…", download:"تنزيل كل الصفحات", page:"صفحة", empty:"استورد الصور أولًا من مكتبة الصور.", nothing:"حدد صورة واحدة على الأقل.", generated:"تم تجهيز {n} صفحة. التنزيل لن يغيّر الصور الأصلية.", local:"معالجة محلية", noTitle:"بدون عنوان", sizeNote:"يتم إنشاء كل صفحة على حدة إذا تجاوزت الصور عدد الخانات.", error:"تعذر إنشاء الورقة. تحقق من عدد الصور والمقاسات." },
 en: { kicker:"04 / PHOTO STUDIO", title:"Build your photo sheet, your way.", subtitle:"Contact sheets, portrait layouts, and optional labels — processed locally in your browser.", select:"Library images", all:"Select all", clear:"Clear selection", preset:"Paper size", custom:"Custom", width:"Width (mm)", height:"Height (mm)", portrait:"Portrait photos", sheet:"Contact sheet", cols:"Columns", rows:"Rows", gap:"Gap (mm)", margin:"Margin (mm)", dpi:"Resolution", labels:"Show image names", numbers:"Add numbers", titleLabel:"Sheet title", titlePlaceholder:"Beautiful memories", generate:"Generate sheet preview", render:"Rendering pages…", download:"Download all pages", page:"Page", empty:"Import images in the image library first.", nothing:"Select at least one image.", generated:"Prepared {n} pages. Downloading will not change your originals.", local:"Local processing", noTitle:"Untitled", sizeNote:"A separate page is created when the selection exceeds the available slots.", error:"Could not create the sheet. Check the image count and dimensions." }
} as const;

export default function PhotoStudio({ images, locale }: { images: PhotoStudioImage[]; locale: Locale }) {
 const t=copy[locale];
 const [selected,setSelected]=useState<string[]>([]);
 const [preset,setPreset]=useState<PaperPreset>("4x6");
 const [customWidth,setCustomWidth]=useState(100);
 const [customHeight,setCustomHeight]=useState(150);
 const [columns,setColumns]=useState(2);
 const [rows,setRows]=useState(3);
 const [gap,setGap]=useState(3);
 const [margin,setMargin]=useState(5);
 const [dpi,setDpi]=useState(150);
 const [labels,setLabels]=useState(true);
 const [numbers,setNumbers]=useState(false);
 const [fitMode,setFitMode]=useState<"contain"|"cover">("contain");
 const [title,setTitle]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [pages,setPages]=useState<RenderedPage[]>([]);
 const [previewIndex,setPreviewIndex]=useState(0);
 const [previewUrl,setPreviewUrl]=useState("");
 useEffect(()=>{if(!pages.length){setPreviewUrl("");return;}const url=URL.createObjectURL(pages[previewIndex].blob);setPreviewUrl(url);return()=>URL.revokeObjectURL(url);},[pages,previewIndex]);
 useEffect(()=>{setSelected(old=>old.filter(id=>images.some(image=>image.id===id)));setPages([]);},[images]);
 const selectedImages=useMemo(()=>selected.map(id=>images.find(image=>image.id===id)).filter((image):image is PhotoStudioImage=>Boolean(image)),[selected,images]);
 const dimensions=useMemo(()=>preset==="4x6"?{width:101.6,height:152.4}:preset==="5x7"?{width:127,height:177.8}:preset==="A4"?{width:210,height:297}:{width:customWidth,height:customHeight},[preset,customWidth,customHeight]);
 function toggle(id:string){setSelected(old=>old.includes(id)?old.filter(value=>value!==id):[...old,id]);setPages([]);}
 function selectAll(){setSelected(old=>old.length===images.length?[]:images.map(image=>image.id));setPages([]);}
 async function renderSheets(){
  if(!selectedImages.length){setError(t.nothing);return;}
  setBusy(true);setError("");setPages([]);
  try{
   const scale=dpi/25.4, width=Math.round(dimensions.width*scale), height=Math.round(dimensions.height*scale);
   if(width*height>30_000_000)throw new Error("page-too-large");
   const safeColumns=Math.max(1,Math.min(10,Math.floor(columns))),safeRows=Math.max(1,Math.min(20,Math.floor(rows)));
   const perPage=safeColumns*safeRows, pageCount=Math.ceil(selectedImages.length/perPage), rendered:RenderedPage[]=[];
   for(let pageIndex=0;pageIndex<pageCount;pageIndex++){
    const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
    const context=canvas.getContext("2d");if(!context)throw new Error("canvas-unavailable");
    context.fillStyle="#ffffff";context.fillRect(0,0,width,height);
    const pad=Math.max(0,margin)*scale, gapPx=Math.max(0,gap)*scale;
    const top=title.trim()?Math.max(0,margin)*scale+Math.round(22*scale):pad;
    if(title.trim()){context.fillStyle="#191827";context.font=`600 ${Math.round(5*scale)}px sans-serif`;context.textAlign="center";context.fillText(title.trim(),width/2,Math.max(10*scale,pad+10*scale));}
    const usableW=width-pad*2,usableH=height-top-pad;
    const cellW=(usableW-gapPx*(safeColumns-1))/safeColumns,cellH=(usableH-gapPx*(safeRows-1))/safeRows;
    for(let slot=0;slot<perPage;slot++){
     const image=selectedImages[pageIndex*perPage+slot];if(!image)continue;
     const x=pad+(slot%safeColumns)*(cellW+gapPx),y=top+Math.floor(slot/safeColumns)*(cellH+gapPx);
     const response=await fetch(image.url);const blob=await response.blob();const bitmap=await createImageBitmap(blob);
     const labelHeight=(labels||numbers)?Math.max(18,Math.round(5*scale)):0;
     const boxH=Math.max(1,cellH-labelHeight),ratio=fitMode==="cover"?Math.max(cellW/bitmap.width,boxH/bitmap.height):Math.min(cellW/bitmap.width,boxH/bitmap.height);
     const drawW=bitmap.width*ratio,drawH=bitmap.height*ratio;
     context.fillStyle="#f1f0f6";context.fillRect(x,y,cellW,boxH);
     context.save();context.beginPath();context.rect(x,y,cellW,boxH);context.clip();context.drawImage(bitmap,x+(cellW-drawW)/2,y+(boxH-drawH)/2,drawW,drawH);context.restore();bitmap.close();
     if(labels||numbers){context.fillStyle="#252238";context.font=`${Math.max(10,Math.round(3.1*scale))}px sans-serif`;context.textAlign="center";const text=[numbers?String(pageIndex*perPage+slot+1):"",labels?image.name:""].filter(Boolean).join(" · ");context.fillText(text,x+cellW/2,y+cellH-Math.max(4,2*scale),Math.max(1,cellW-4));}
    }
    const pageBlob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("encode-failed")),"image/png"));
    rendered.push({blob:pageBlob,filename:`contact-sheet-${String(pageIndex+1).padStart(2,"0")}.png`,width,height});
    await new Promise<void>(resolve=>window.setTimeout(resolve,0));
   }
   setPages(rendered);setPreviewIndex(0);
  }catch{setError(t.error);}finally{setBusy(false);}
 }
 return <section className="feature-studio" id="photo-studio" aria-labelledby="photo-studio-title">
  <div className="feature-heading"><div><div className="section-kicker">{t.kicker}</div><h2 id="photo-studio-title">{t.title}</h2><p>{t.subtitle}</p></div><span className="feature-local-badge">◇ {t.local}</span></div>
  <div className="feature-layout">
   <aside className="feature-panel"><div className="feature-panel-heading"><h3>{t.select}</h3><button type="button" className="feature-text-button" onClick={selectAll}>{selected.length===images.length&&images.length?t.clear:t.all}</button></div>
    {!images.length?<p className="feature-empty">{t.empty}</p>:<div className="feature-image-picker">{images.map(image=><button type="button" key={image.id} className={selected.includes(image.id)?"feature-image-choice is-selected":"feature-image-choice"} aria-pressed={selected.includes(image.id)} onClick={()=>toggle(image.id)}><img src={image.url} alt="" loading="lazy"/><span>{image.name}</span><i>{selected.includes(image.id)?"✓":"＋"}</i></button>)}</div>}
   </aside>
   <div className="feature-main"><div className="feature-controls">
    <label className="feature-field"><span>{t.preset}</span><select value={preset} onChange={e=>{setPreset(e.target.value as PaperPreset);setPages([]);}}><option value="4x6">4 × 6 in</option><option value="5x7">5 × 7 in</option><option value="A4">A4</option><option value="custom">{t.custom}</option></select></label>
    {preset==="custom"&&<><label className="feature-field"><span>{t.width}</span><input type="number" min="20" max="500" value={customWidth} onChange={e=>{setCustomWidth(Math.min(500,Math.max(20,Number(e.target.value)||20)));setPages([]);}}/></label><label className="feature-field"><span>{t.height}</span><input type="number" min="20" max="500" value={customHeight} onChange={e=>{setCustomHeight(Math.min(500,Math.max(20,Number(e.target.value)||20)));setPages([]);}}/></label></>}
    <label className="feature-field"><span>{t.cols}</span><input type="number" min="1" max="10" value={columns} onChange={e=>{setColumns(Math.min(10,Math.max(1,Number(e.target.value)||1)));setPages([]);}}/></label>
    <label className="feature-field"><span>{t.rows}</span><input type="number" min="1" max="20" value={rows} onChange={e=>{setRows(Math.min(20,Math.max(1,Number(e.target.value)||1)));setPages([]);}}/></label>
    <label className="feature-field"><span>{t.gap}</span><input type="number" min="0" max="30" value={gap} onChange={e=>{setGap(Math.min(30,Math.max(0,Number(e.target.value)||0)));setPages([]);}}/></label>
    <label className="feature-field"><span>{t.margin}</span><input type="number" min="0" max="40" value={margin} onChange={e=>{setMargin(Math.min(40,Math.max(0,Number(e.target.value)||0)));setPages([]);}}/></label>
    <label className="feature-field"><span>{t.fitMode}</span><select value={fitMode} onChange={e=>{setFitMode(e.target.value as "contain"|"cover");setPages([]);}}><option value="contain">{t.contain}</option><option value="cover">{t.cover}</option></select></label>
    <label className="feature-field"><span>{t.dpi}</span><select value={dpi} onChange={e=>{setDpi(Number(e.target.value));setPages([]);}}><option value={72}>72 DPI</option><option value={150}>150 DPI</option><option value={300}>300 DPI</option></select></label>
    <label className="feature-field feature-field-wide"><span>{t.titleLabel}</span><input value={title} maxLength={80} placeholder={t.titlePlaceholder} onChange={e=>{setTitle(e.target.value);setPages([]);}}/></label>
    <label className="feature-check"><input type="checkbox" checked={labels} onChange={e=>{setLabels(e.target.checked);setPages([]);}}/>{t.labels}</label>
    <label className="feature-check"><input type="checkbox" checked={numbers} onChange={e=>{setNumbers(e.target.checked);setPages([]);}}/>{t.numbers}</label>
   </div>
   <div className="feature-actions"><button type="button" className="button button-primary" disabled={busy||!selected.length} onClick={()=>void renderSheets()}>{busy?t.render:t.generate}</button>{pages.length>0&&<button type="button" className="button button-quiet" onClick={()=>pages.forEach((page,index)=>window.setTimeout(()=>downloadBlob(page.blob,page.filename),index*180))}>{t.download}</button>}</div>
   {error&&<p className="feature-error" role="alert">{error}</p>}
   {pages.length>0&&<><p className="feature-success" role="status">{t.generated.replace("{n}",String(pages.length))}</p><div className="feature-preview"><div className="feature-preview-bar"><span>{t.page} {previewIndex+1} / {pages.length}</span><div><button type="button" disabled={previewIndex===0} onClick={()=>setPreviewIndex(value=>value-1)}>←</button><button type="button" disabled={previewIndex===pages.length-1} onClick={()=>setPreviewIndex(value=>value+1)}>→</button></div></div><img src={previewUrl} alt={`Contact sheet page ${previewIndex+1}`}/></div></>}
   <p className="feature-note">{t.sizeNote}</p>
  </div></div>
 </section>;
}
