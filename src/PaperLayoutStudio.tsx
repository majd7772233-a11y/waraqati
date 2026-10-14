import { useMemo, useState } from "react";
import {
  calculateLayout,
  getPaperDimensions,
  type ImageFit,
  type MeasurementUnit,
  type PaperOrientation,
  type PaperPreset,
  type PaperSettings,
  type RegionDefinition,
  type Rect,
  LayoutError,
} from "./paperLayout";

export interface StudioImage {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
}

type LayoutMode = "single" | "two-horizontal" | "two-vertical" | "three-horizontal" | "three-vertical" | "stickers" | "custom";
type StudioLocale = "ar" | "en";

const copy = {
 ar: {
  kicker:"03 / استوديو التخطيط", title:"من صورك إلى ورقة جاهزة.", subtitle:"اختر قالبًا، اضبط القياسات، وعاين كل صفحة قبل الانتقال إلى التصدير.",
  library:"صور المكتبة", order:"ترتيب الصور", up:"للأعلى", down:"للأسفل", libraryHint:"حدد الصور التي تريد وضعها في الورقة.", addAll:"إضافة الكل", clear:"مسح التحديد", empty:"استورد صورًا أولًا من مكتبة الصور أعلاه.",
  templates:"قوالب التخطيط", single:"صورة واحدة", singleHint:"ملء الورقة أو احتواء الصورة", twoH:"صورتان · أفقي", twoV:"صورتان · عمودي", threeH:"ثلاث صور · أفقي", threeV:"ثلاث صور · عمودي", stickers:"شبكة ملصقات", custom:"مناطق مخصصة",
  paper:"إعدادات الورقة", size:"مقاس الورق", orientation:"الاتجاه", portrait:"عمودي", landscape:"أفقي", unit:"وحدة القياس", width:"العرض", height:"الارتفاع", margins:"الهوامش", top:"أعلى", right:"يمين", bottom:"أسفل", left:"يسار", gap:"المسافة بين الصور",
  fit:"طريقة ملاءمة الصورة", contain:"احتواء كامل", cover:"ملء مع قص", repeat:"تكرار أول صورة لملء الخانات", rows:"الصفوف", columns:"الأعمدة", count:"عدد المناطق", regions:"ضبط مناطق التخطيط", region:"منطقة", x:"X", y:"Y", apply:"تحديث المعاينة",
  preview:"معاينة الورقة", page:"صفحة", of:"من", previous:"السابقة", next:"التالية", pages:"صفحات", photos:"صور مختارة", slots:"خانات في الصفحة", printNote:"المعاينة محسوبة بوحدة mm من محرك التخطيط المشترك. الطباعة بلا حدود تعتمد على الطابعة.",
  noSelection:"اختر صورة واحدة على الأقل لعرض المعاينة.", layoutError:"تعذر إنشاء التخطيط", reset:"إعادة ضبط القالب", selected:"محدد", remove:"إزالة",
 },
 en: {
  kicker:"03 / LAYOUT STUDIO", title:"Turn your images into a page.", subtitle:"Choose a template, fine-tune measurements, and preview every page before exporting.",
  library:"Library images", order:"Image order", up:"Move up", down:"Move down", libraryHint:"Select the images you want to place on paper.", addAll:"Add all", clear:"Clear selection", empty:"Import images in the library above first.",
  templates:"Layout templates", single:"Single image", singleHint:"Fill the page or contain the image", twoH:"Two · horizontal", twoV:"Two · vertical", threeH:"Three · horizontal", threeV:"Three · vertical", stickers:"Sticker grid", custom:"Custom regions",
  paper:"Paper settings", size:"Paper size", orientation:"Orientation", portrait:"Portrait", landscape:"Landscape", unit:"Measurement unit", width:"Width", height:"Height", margins:"Margins", top:"Top", right:"Right", bottom:"Bottom", left:"Left", gap:"Gap between images",
  fit:"Image fitting", contain:"Contain", cover:"Cover & crop", repeat:"Repeat first image to fill slots", rows:"Rows", columns:"Columns", count:"Region count", regions:"Edit layout regions", region:"Region", x:"X", y:"Y", apply:"Update preview",
  preview:"Paper preview", page:"Page", of:"of", previous:"Previous", next:"Next", pages:"pages", photos:"selected images", slots:"slots per page", printNote:"Preview geometry is calculated in mm by the shared layout engine. Borderless printing depends on your printer.",
  noSelection:"Select at least one image to preview the layout.", layoutError:"Could not create layout", reset:"Reset template", selected:"selected", remove:"Remove",
 }
} as const;

const templateModes: LayoutMode[] = ["single","two-horizontal","two-vertical","three-horizontal","three-vertical","stickers","custom"];

function defaultRegions(rows: number, columns: number, width: number, height: number, gap: number): RegionDefinition[] {
 const cellW=(width-gap*(columns-1))/columns, cellH=(height-gap*(rows-1))/rows;
 return Array.from({length:rows*columns},(_,i)=>({id:`custom-${i+1}`,x:(i%columns)*(cellW+gap),y:Math.floor(i/columns)*(cellH+gap),width:cellW,height:cellH}));
}

export default function PaperLayoutStudio({ images, locale }: { images: StudioImage[]; locale: StudioLocale }) {
 const t=copy[locale];
 const [chosen,setChosen]=useState<string[]>([]);
 const [mode,setMode]=useState<LayoutMode>("single");
 const [size,setSize]=useState<PaperPreset|"custom">("A4");
 const [orientation,setOrientation]=useState<PaperOrientation>("portrait");
 const [unit,setUnit]=useState<MeasurementUnit>("mm");
 const [customWidth,setCustomWidth]=useState(210);
 const [customHeight,setCustomHeight]=useState(297);
 const [margins,setMargins]=useState({top:8,right:8,bottom:8,left:8});
 const [gap,setGap]=useState(4);
 const [fit,setFit]=useState<ImageFit>("contain");
 const [rows,setRows]=useState(3);
 const [columns,setColumns]=useState(3);
 const [repeat,setRepeat]=useState(false);\n const [stickerSizeEnabled,setStickerSizeEnabled]=useState(false);\n const [stickerWidth,setStickerWidth]=useState(45);\n const [stickerHeight,setStickerHeight]=useState(45);
 const [customCount,setCustomCount]=useState(2);
 const [customRegions,setCustomRegions]=useState<RegionDefinition[]>([]);
 const [pageIndex,setPageIndex]=useState(1);


 const selectedImages=useMemo(()=>chosen.map(id=>images.find(image=>image.id===id)).filter((image):image is StudioImage=>Boolean(image)),[chosen,images]);
 const gridRows=mode==="two-vertical"?2:mode==="three-vertical"?3:mode==="single"?1:mode==="two-horizontal"?1:mode==="three-horizontal"?1:rows;
 const gridColumns=mode==="two-horizontal"?2:mode==="three-horizontal"?3:mode==="single"?1:mode==="two-vertical"?1:mode==="three-vertical"?1:columns;
 const settings:PaperSettings={size:size==="custom"?{preset:"custom",width:customWidth,height:customHeight}:{preset:size},orientation,unit,margins,gap};
 const dimensions=useMemo(()=>{try{return getPaperDimensions(settings.size,orientation,unit);}catch{return {width:210,height:297};}},[size,orientation,unit,customWidth,customHeight]);
 const customSource=useMemo(()=>customRegions.length===customCount?customRegions:defaultRegions(1,customCount,dimensions.width/unitFactor(unit),dimensions.height/unitFactor(unit),gap),[customRegions,customCount,dimensions.width,dimensions.height,unit,gap]);
 const stickerRegions=useMemo(()=>{
  const factor=unitFactor(unit);
  const pageWidth=dimensions.width/factor, pageHeight=dimensions.height/factor;
  const availableWidth=pageWidth-margins.left-margins.right, availableHeight=pageHeight-margins.top-margins.bottom;
  const safeWidth=Math.max(.1,stickerWidth),safeHeight=Math.max(.1,stickerHeight);
  const fitColumns=Math.max(1,Math.min(20,Math.floor((availableWidth+gap)/(safeWidth+gap))));
  const fitRows=Math.max(1,Math.min(20,Math.floor((availableHeight+gap)/(safeHeight+gap))));
  const totalWidth=fitColumns*safeWidth+(fitColumns-1)*gap;
  const startX=margins.left+Math.max(0,(availableWidth-totalWidth)/2);
  return Array.from({length:fitRows*fitColumns},(_,index)=>({id:`sticker-${index+1}`,x:startX+(index%fitColumns)*(safeWidth+gap),y:margins.top+Math.max(0,(availableHeight-(fitRows*safeHeight+(fitRows-1)*gap))/2)+Math.floor(index/fitColumns)*(safeHeight+gap),width:safeWidth,height:safeHeight}));
 },[dimensions.width,dimensions.height,unit,margins.top,margins.right,margins.bottom,margins.left,gap,stickerWidth,stickerHeight]);
 const layoutState=useMemo(()=>{
  if(!selectedImages.length)return {value:null,error:""};
  try{
   const repeatCount=mode==="custom"?customCount:mode==="stickers"&&stickerSizeEnabled?stickerRegions.length:gridRows*gridColumns;
   const sources=repeat
    ? Array.from({length:Math.max(1,repeatCount)},(_,i)=>({...selectedImages[0],id:`${selectedImages[0].id}__repeat_${i+1}`}))
    : selectedImages;
   return {value:calculateLayout({
    settings,images:sources.map(image=>({id:image.id,width:image.width,height:image.height})),
    fit,
    ...(mode==="custom"?{regions:customSource}:mode==="stickers"&&stickerSizeEnabled?{regions:stickerRegions}:{grid:{rows:gridRows,columns:gridColumns,gap}}),
   }),error:""};
  }catch(cause){return {value:null,error:cause instanceof Error?cause.message:String(cause)};}
 },[selectedImages,mode,size,orientation,unit,customWidth,customHeight,margins.top,margins.right,margins.bottom,margins.left,gap,fit,rows,columns,repeat,customCount,customSource,stickerSizeEnabled,stickerRegions,gridRows,gridColumns]);
 const layout=layoutState.value;
 const layoutError=layoutState.error;
 const activePage=layout?.pages[Math.min(pageIndex,layout.pages.length)-1]??null;
 const imageById=(id:string)=>images.find(image=>id===image.id||id.startsWith(`${image.id}__repeat_`));
 const setCustomField=(index:number,key:keyof RegionDefinition,value:number)=>setCustomRegions(old=>{
  const base=old.length===customCount?old:customSource;
  return base.map((region,i)=>i===index?{...region,[key]:value}:region);
 });
 function chooseMode(next:LayoutMode){
  setMode(next);setPageIndex(1);
  if(next==="custom"){
   const count=Math.max(1,customCount);
   setCustomRegions(defaultRegions(1,count,dimensions.width/unitFactor(unit),dimensions.height/unitFactor(unit),gap));
  }
 }
 function resetTemplate(){
  setMargins({top:8,right:8,bottom:8,left:8});setGap(4);setFit("contain");setRows(3);setColumns(3);setRepeat(false);setStickerSizeEnabled(false);setStickerWidth(45);setStickerHeight(45);
  setCustomRegions([]);setStickerSizeEnabled(false);setPageIndex(1);
 }
 function toggleImage(id:string){setChosen(old=>old.includes(id)?old.filter(item=>item!==id):[...old,id]);setPageIndex(1);}

 return <section className="studio-section" id="layout-studio" aria-labelledby="studio-title">
  <div className="studio-heading"><div><div className="section-kicker">{t.kicker}</div><h2 id="studio-title">{t.title}</h2><p>{t.subtitle}</p></div><span className="studio-badge"><i/> {selectedImages.length} {t.photos}</span></div>
  <div className="studio-workspace">
   <aside className="studio-sidebar">
    <section className="studio-panel"><div className="studio-panel-title"><span className="studio-panel-icon">▧</span><div><h3>{t.library}</h3><p>{t.libraryHint}</p></div></div>
     {images.length?<><div className="studio-image-picker">{images.map(image=><button type="button" key={image.id} className={`studio-image-option ${chosen.includes(image.id)?"is-chosen":""}`} onClick={()=>toggleImage(image.id)} aria-pressed={chosen.includes(image.id)} title={image.name}><img src={image.url} alt=""/><span>{chosen.includes(image.id)?"✓":"＋"}</span><small>{image.name}</small></button>)}</div><div className="studio-inline-actions"><button type="button" onClick={()=>{setChosen(images.map(image=>image.id));setPageIndex(1);}}>{t.addAll}</button><button type="button" onClick={()=>{setChosen([]);setPageIndex(1);}}>{t.clear}</button></div></>:<p className="studio-empty-hint">{t.empty}</p>}
     {selectedImages.length>0&&<div className="studio-selected-order"><div className="studio-subheading">{t.order}</div>{selectedImages.map((image,index)=><div className="studio-order-row" key={image.id}><span>{index+1}</span><strong title={image.name}>{image.name}</strong><button type="button" disabled={index===0} title={t.up} aria-label={t.up} onClick={()=>setChosen(old=>{const next=[...old];[next[index-1],next[index]]=[next[index],next[index-1]];return next;})}>↑</button><button type="button" disabled={index===selectedImages.length-1} title={t.down} aria-label={t.down} onClick={()=>setChosen(old=>{const next=[...old];[next[index],next[index+1]]=[next[index+1],next[index]];return next;})}>↓</button></div>)}</div>}
    </section>
    <section className="studio-panel"><div className="studio-panel-title"><span className="studio-panel-icon">▦</span><div><h3>{t.templates}</h3><p>{t.reset}</p></div></div>
     <div className="template-grid">{templateModes.map((item,index)=><button key={item} type="button" onClick={()=>chooseMode(item)} className={`template-choice ${mode===item?"is-active":""}`} aria-pressed={mode===item}><span className={`template-glyph glyph-${index+1}`} aria-hidden="true"><i/><i/><i/></span><strong>{t[item==="two-horizontal"?"twoH":item==="two-vertical"?"twoV":item==="three-horizontal"?"threeH":item==="three-vertical"?"threeV":item]}</strong></button>)}</div>
    </section>
    <section className="studio-panel"><div className="studio-panel-title"><span className="studio-panel-icon">⌗</span><div><h3>{t.paper}</h3><p>{t.unit}</p></div></div>
     <div className="studio-fields">
      <label className="studio-field"><span>{t.size}</span><select value={size} onChange={e=>{setSize(e.target.value as PaperPreset|"custom");setPageIndex(1);}}><option value="A4">A4</option><option value="A3">A3</option><option value="A5">A5</option><option value="Letter">Letter</option><option value="custom">{locale==="ar"?"مخصص":"Custom"}</option></select></label>
      <label className="studio-field"><span>{t.orientation}</span><select value={orientation} onChange={e=>{setOrientation(e.target.value as PaperOrientation);setPageIndex(1);}}><option value="portrait">{t.portrait}</option><option value="landscape">{t.landscape}</option></select></label>
      <label className="studio-field"><span>{t.unit}</span><select value={unit} onChange={e=>{setUnit(e.target.value as MeasurementUnit);setCustomRegions([]);}}><option value="mm">mm</option><option value="cm">cm</option><option value="in">in</option></select></label>
      {size==="custom"&&<div className="studio-two-fields"><label className="studio-field"><span>{t.width}</span><input type="number" min="1" value={customWidth} onChange={e=>setCustomWidth(Number(e.target.value))}/></label><label className="studio-field"><span>{t.height}</span><input type="number" min="1" value={customHeight} onChange={e=>setCustomHeight(Number(e.target.value))}/></label></div>}
      <div className="studio-subheading">{t.margins} <small>({unit})</small></div>
      <div className="studio-margin-grid">{(["top","right","bottom","left"] as const).map(side=><label className="studio-field" key={side}><span>{t[side]}</span><input type="number" min="0" step="0.5" value={margins[side]} onChange={e=>setMargins(old=>({...old,[side]:Number(e.target.value)}))}/></label>)}</div>
      <label className="studio-field"><span>{t.gap}</span><input type="number" min="0" step="0.5" value={gap} onChange={e=>setGap(Number(e.target.value))}/></label>
      <label className="studio-field"><span>{t.fit}</span><select value={fit} onChange={e=>setFit(e.target.value as ImageFit)}><option value="contain">{t.contain}</option><option value="cover">{t.cover}</option></select></label>
      {mode==="stickers"&&!stickerSizeEnabled&&<div className="studio-two-fields"><label className="studio-field"><span>{t.rows}</span><input type="number" min="1" max="20" value={rows} onChange={e=>{setRows(clampInt(e.target.value,1,20));setPageIndex(1);}}/></label><label className="studio-field"><span>{t.columns}</span><input type="number" min="1" max="20" value={columns} onChange={e=>{setColumns(clampInt(e.target.value,1,20));setPageIndex(1);}}/></label></div>}
      {mode==="custom"&&<><label className="studio-field"><span>{t.count}</span><input type="number" min="1" max="20" value={customCount} onChange={e=>{const count=clampInt(e.target.value,1,20);setCustomCount(count);setCustomRegions([]);}}/></label><div className="studio-region-editor"><div className="studio-subheading">{t.regions}</div>{customSource.map((region,index)=><div className="studio-region-row" key={index}><strong>{t.region} {index+1}</strong>{(["x","y","width","height"] as const).map(key=><label key={key}><span>{key==="width"?t.width:key==="height"?t.height:key.toUpperCase()}</span><input type="number" min={key==="width"||key==="height"?"0.1":"0"} step="0.5" value={region[key]} onChange={e=>setCustomField(index,key,Number(e.target.value))}/></label>)}</div>)}</div></>}
      {mode==="stickers"&&<><label className="studio-check"><input type="checkbox" checked={stickerSizeEnabled} onChange={e=>{setStickerSizeEnabled(e.target.checked);setPageIndex(1);}}/><span>{locale==="ar"?"تحديد مقاس الملصق بدل الصفوف والأعمدة":"Set sticker size instead of rows and columns"}</span></label>{stickerSizeEnabled&&<div className="studio-two-fields"><label className="studio-field"><span>{locale==="ar"?"عرض الملصق":"Sticker width"} ({unit})</span><input type="number" min="1" step="0.5" value={stickerWidth} onChange={e=>setStickerWidth(Math.max(.1,Number(e.target.value)))}/></label><label className="studio-field"><span>{locale==="ar"?"ارتفاع الملصق":"Sticker height"} ({unit})</span><input type="number" min="1" step="0.5" value={stickerHeight} onChange={e=>setStickerHeight(Math.max(.1,Number(e.target.value)))}/></label></div>}<label className="studio-check"><input type="checkbox" checked={repeat} onChange={e=>{setRepeat(e.target.checked);setPageIndex(1);}}/><span>{t.repeat}</span></label></>}
      <button type="button" className="studio-reset" onClick={resetTemplate}>{t.reset}</button>
     </div>
    </section>
   </aside>
   <div className="studio-preview-column">
    <div className="studio-preview-toolbar"><div><span className="studio-live-dot"/><div><h3>{t.preview}</h3><p>{layout?layout.pageCount:0} {t.pages} · {layout?.regionCount??0} {t.slots}</p></div></div>{layout&&layout.pageCount>1&&<div className="studio-pagination"><button type="button" disabled={pageIndex<=1} onClick={()=>setPageIndex(p=>Math.max(1,p-1))} aria-label={t.previous}>‹</button><span>{t.page} {Math.min(pageIndex,layout.pageCount)} {t.of} {layout.pageCount}</span><button type="button" disabled={pageIndex>=layout.pageCount} onClick={()=>setPageIndex(p=>Math.min(layout.pageCount,p+1))} aria-label={t.next}>›</button></div>}</div>
    {layout&&activePage?<><div className="paper-preview-stage"><div className="paper-preview-sheet" style={{aspectRatio:`${activePage.width}/${activePage.height}`}}><svg viewBox={`0 0 ${activePage.width} ${activePage.height}`} role="img" aria-label={`${t.preview} ${activePage.index}`} preserveAspectRatio="xMidYMid meet"><rect x="0" y="0" width={activePage.width} height={activePage.height} fill="#fff"/><rect x={layout.paper.content.x} y={layout.paper.content.y} width={layout.paper.content.width} height={layout.paper.content.height} fill="none" stroke="#d6d1e5" strokeDasharray="1.5 1.5" strokeWidth=".35"/>{activePage.slots.map((slot,index)=>{const image=slot.image?imageById(slot.image.imageId):undefined;return <g key={slot.regionId+"-"+index}><rect x={slot.region.x} y={slot.region.y} width={slot.region.width} height={slot.region.height} fill={image?"#f5f3fa":"#faf9fd"} stroke="#d8d3e5" strokeWidth=".45" strokeDasharray={image?"0":"2 1.5"}/>{image&&slot.image&&<svg x={slot.image.draw.x} y={slot.image.draw.y} width={slot.image.draw.width} height={slot.image.draw.height} viewBox={`${slot.image.sourceCrop.x*image.width} ${slot.image.sourceCrop.y*image.height} ${slot.image.sourceCrop.width*image.width} ${slot.image.sourceCrop.height*image.height}`} preserveAspectRatio="none" overflow="hidden"><image href={image.url} x="0" y="0" width={image.width} height={image.height} preserveAspectRatio="none"/></svg>}{!image&&<text x={slot.region.x+slot.region.width/2} y={slot.region.y+slot.region.height/2} textAnchor="middle" dominantBaseline="middle" fill="#9b96ad" fontSize={Math.min(slot.region.width,slot.region.height)*.08}>＋</text>}</g>})}</svg></div></div><div className="studio-preview-stats"><span><strong>{layout.imageCount}</strong>{t.photos}</span><span><strong>{layout.pageCount}</strong>{t.pages}</span><span><strong>{activePage.slots.filter(slot=>slot.image).length}</strong> / {activePage.slots.length} {t.slots}</span></div></>:<div className="studio-preview-empty"><span>▧</span><strong>{selectedImages.length?t.layoutError:t.noSelection}</strong><p>{selectedImages.length?layoutError:t.noSelection}</p></div>}
    {layoutError&&selectedImages.length>0&&<p className="studio-error" role="alert">{t.layoutError}: {layoutError}</p>}
    <p className="studio-print-note"><span>◇</span>{t.printNote}</p>
   </div>
  </div>
 </section>;
}

function unitFactor(unit:MeasurementUnit):number{return unit==="mm"?1:unit==="cm"?10:25.4;}
function clampInt(value:string,min:number,max:number):number{const parsed=Number.parseInt(value,10);return Number.isFinite(parsed)?Math.min(max,Math.max(min,parsed)):min;}
