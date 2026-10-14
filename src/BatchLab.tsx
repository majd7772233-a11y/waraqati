import { useEffect, useMemo, useState } from "react";
import { downloadBlob, makeOutputName, outputExtension, processImage, sha256, type OutputImageFormat, type ProcessedImage, type Rotation } from "./imageProcessing";

export interface BatchLabImage { id: string; name: string; url: string; width: number; height: number; file: File }
type Locale = "ar" | "en";
interface BatchOutput { id: string; filename: string; blob: Blob; width: number; height: number; originalName: string; sizeBefore: number }
const copy = {
 ar: { kicker:"05 / المختبر الجماعي",title:"أنجز عشرات الصور دفعة واحدة.",subtitle:"حوّل الصيغ، غيّر الأبعاد، اضغط الملفات، أدر الصور، وقص الحواف الشفافة — دون رفع أي ملف.",local:"معالجة محلية",files:"صور المكتبة",all:"تحديد الكل",clear:"إلغاء التحديد",empty:"استورد الصور من المكتبة أولًا.",format:"صيغة الإخراج",png:"PNG · يدعم الشفافية",jpeg:"JPEG · أصغر عادةً",webp:"WebP · حديث",width:"أقصى عرض",height:"أقصى ارتفاع",quality:"جودة JPEG/WebP",rotation:"التدوير",none:"بدون تدوير",r90:"90° يمينًا",r180:"180°",r270:"90° يسارًا",trim:"قص الحواف الشفافة",rename:"قالب اسم الملف",renameHint:"استخدم {name} و{n} و{ext}",preview:"معاينة العمليات",process:"تجهيز المعاينة",busy:"جارٍ تجهيز الملفات…",download:"تنزيل الملفات الجاهزة",reset:"مسح المعاينة",results:"النتائج",source:"الأصل",output:"الناتج",error:"تعذر معالجة بعض الصور؛ راجع رسالة كل ملف.",done:"اكتملت المعالجة محليًا. لم تتغير الملفات الأصلية.",dupes:"اكتشاف التكرارات المتطابقة",scan:"فحص SHA-256",scanning:"جارٍ حساب البصمات…",duplicates:"مجموعات مكررة",noDuplicates:"لم تُكتشف ملفات متطابقة ضمن الاختيار.",duplicateNote:"يعتمد الفحص على تطابق محتوى الملف حرفيًا، ولا يكتشف الصور المتشابهة بصريًا.",sizeLimit:"حد الأمان: 40 مليون بكسل لكل صورة.",downloadOne:"تنزيل",failed:"فشل",items:"ملف",cancel:"ألغِ التحديد قبل تشغيل عملية أخرى." },
 en: { kicker:"05 / BATCH LAB",title:"Process dozens of images in one pass.",subtitle:"Convert formats, resize, compress, rotate, and trim transparent edges — without uploading files.",local:"Local processing",files:"Library images",all:"Select all",clear:"Clear selection",empty:"Import images into the library first.",format:"Output format",png:"PNG · transparency",jpeg:"JPEG · usually smaller",webp:"WebP · modern",width:"Maximum width",height:"Maximum height",quality:"JPEG/WebP quality",rotation:"Rotation",none:"No rotation",r90:"90° clockwise",r180:"180°",r270:"90° counter-clockwise",trim:"Trim transparent edges",rename:"Filename template",renameHint:"Use {name}, {n}, and {ext}",preview:"Preview operations",process:"Prepare preview",busy:"Preparing files…",download:"Download prepared files",reset:"Clear preview",results:"Results",source:"Original",output:"Output",error:"Some images could not be processed; check each file message.",done:"Local processing finished. Original files were not changed.",dupes:"Find exact duplicates",scan:"Scan SHA-256",scanning:"Calculating fingerprints…",duplicates:"Duplicate groups",noDuplicates:"No byte-identical files were found in this selection.",duplicateNote:"This checks exact file content; visually similar images are not detected.",sizeLimit:"Safety limit: 40 million pixels per image.",downloadOne:"Download",failed:"Failed",items:"files",cancel:"Clear the selection before starting another operation." }
} as const;

export default function BatchLab({ images, locale }: { images: BatchLabImage[]; locale: Locale }) {
 const t=copy[locale];
 const [selected,setSelected]=useState<string[]>([]);
 const [format,setFormat]=useState<OutputImageFormat>("image/jpeg");
 const [maxWidth,setMaxWidth]=useState(1600);
 const [maxHeight,setMaxHeight]=useState(1600);
 const [quality,setQuality]=useState(.86);
 const [rotation,setRotation]=useState<Rotation>(0);
 const [trimTransparent,setTrimTransparent]=useState(false);
 const [nameTemplate,setNameTemplate]=useState("{name}-{n}");
 const [busy,setBusy]=useState(false);
 const [outputs,setOutputs]=useState<BatchOutput[]>([]);
 const [errors,setErrors]=useState<Record<string,string>>({});
 const [duplicateGroups,setDuplicateGroups]=useState<string[][]>([]);
 const [scanBusy,setScanBusy]=useState(false);
 const selectedImages=useMemo(()=>selected.map(id=>images.find(image=>image.id===id)).filter((image):image is BatchLabImage=>Boolean(image)),[selected,images]);
 useEffect(()=>()=>outputs.forEach(item=>URL.revokeObjectURL(URL.createObjectURL(item.blob))),[outputs]);
 function toggle(id:string){setSelected(old=>old.includes(id)?old.filter(value=>value!==id):[...old,id]);setOutputs([]);setErrors({});}
 function selectAll(){setSelected(old=>old.length===images.length?[]:images.map(image=>image.id));setOutputs([]);}
 function options(){return {format,maxWidth:Math.max(1,maxWidth),maxHeight:Math.max(1,maxHeight),quality,rotation,trimTransparent};}
 async function preview(){
  if(!selectedImages.length)return;
  setBusy(true);setOutputs([]);setErrors({});setDuplicateGroups([]);
  const ready:BatchOutput[]=[];const failures:Record<string,string>={};
  for(let index=0;index<selectedImages.length;index++){
   const image=selectedImages[index];
   try{
    const result:ProcessedImage=await processImage(image.file,options());
    ready.push({id:image.id,filename:makeOutputName(nameTemplate,image.name,index,format),blob:result.blob,width:result.width,height:result.height,originalName:image.name,sizeBefore:image.file.size});
   }catch(error){failures[image.id]=error instanceof Error?error.message:t.error;}
   await new Promise<void>(resolve=>window.setTimeout(resolve,0));
  }
  setOutputs(ready);setErrors(failures);setBusy(false);
 }
 async function scanDuplicates(){
  if(selectedImages.length<2)return;
  setScanBusy(true);setDuplicateGroups([]);
  try{
   const groups=new Map<string,string[]>();
   for(const image of selectedImages){const hash=await sha256(image.file);const group=groups.get(hash)||[];group.push(image.id);groups.set(hash,group);}
   setDuplicateGroups(Array.from(groups.values()).filter(group=>group.length>1));
  }catch(error){setErrors(old=>({...old,scan:error instanceof Error?error.message:"SHA-256 unavailable"}));}
  finally{setScanBusy(false);}
 }
 const totalSaved=outputs.reduce((sum,item)=>sum+item.sizeBefore-item.blob.size,0);
 return <section className="feature-studio batch-studio" id="batch-lab" aria-labelledby="batch-lab-title">
  <div className="feature-heading"><div><div className="section-kicker">{t.kicker}</div><h2 id="batch-lab-title">{t.title}</h2><p>{t.subtitle}</p></div><span className="feature-local-badge">◇ {t.local}</span></div>
  <div className="feature-layout">
   <aside className="feature-panel"><div className="feature-panel-heading"><h3>{t.files} · {selected.length}</h3><button type="button" className="feature-text-button" onClick={selectAll}>{selected.length===images.length&&images.length?t.clear:t.all}</button></div>
    {!images.length?<p className="feature-empty">{t.empty}</p>:<div className="feature-image-picker">{images.map(image=><button type="button" key={image.id} className={selected.includes(image.id)?"feature-image-choice is-selected":"feature-image-choice"} aria-pressed={selected.includes(image.id)} onClick={()=>toggle(image.id)}><img src={image.url} alt="" loading="lazy"/><span>{image.name}</span><i>{selected.includes(image.id)?"✓":"＋"}</i></button>)}</div>}
   </aside>
   <div className="feature-main"><div className="feature-controls">
    <label className="feature-field"><span>{t.format}</span><select value={format} onChange={e=>{setFormat(e.target.value as OutputImageFormat);setOutputs([]);}}><option value="image/png">{t.png}</option><option value="image/jpeg">{t.jpeg}</option><option value="image/webp">{t.webp}</option></select></label>
    <label className="feature-field"><span>{t.width}</span><input type="number" min="1" max="12000" value={maxWidth} onChange={e=>{setMaxWidth(Math.min(12000,Math.max(1,Number(e.target.value)||1)));setOutputs([]);}}/></label>
    <label className="feature-field"><span>{t.height}</span><input type="number" min="1" max="12000" value={maxHeight} onChange={e=>{setMaxHeight(Math.min(12000,Math.max(1,Number(e.target.value)||1)));setOutputs([]);}}/></label>
    <label className="feature-field feature-field-wide"><span>{t.quality} · {Math.round(quality*100)}%</span><input type="range" min="0.35" max="1" step="0.05" value={quality} onChange={e=>{setQuality(Number(e.target.value));setOutputs([]);}}/></label>
    <label className="feature-field"><span>{t.rotation}</span><select value={rotation} onChange={e=>{setRotation(Number(e.target.value) as Rotation);setOutputs([]);}}><option value={0}>{t.none}</option><option value={90}>{t.r90}</option><option value={180}>{t.r180}</option><option value={270}>{t.r270}</option></select></label>
    <label className="feature-field feature-field-wide"><span>{t.rename}</span><input value={nameTemplate} maxLength={100} onChange={e=>{setNameTemplate(e.target.value);setOutputs([]);}}/><small>{t.renameHint}</small></label>
    <label className="feature-check"><input type="checkbox" checked={trimTransparent} onChange={e=>{setTrimTransparent(e.target.checked);setOutputs([]);}} disabled={format==="image/jpeg"}/>{t.trim}</label>
   </div>
   <div className="feature-actions"><button type="button" className="button button-primary" disabled={busy||!selected.length} onClick={()=>void preview()}>{busy?t.busy:t.process}</button><button type="button" className="button button-quiet" disabled={scanBusy||selected.length<2} onClick={()=>void scanDuplicates()}>{scanBusy?t.scanning:t.scan}</button>{outputs.length>0&&<button type="button" className="button button-primary" onClick={()=>outputs.forEach((item,index)=>window.setTimeout(()=>downloadBlob(item.blob,item.filename),index*180))}>{t.download}</button>}{outputs.length>0&&<button type="button" className="button button-quiet" onClick={()=>setOutputs([])}>{t.reset}</button>}</div>
   <p className="feature-note">{t.sizeLimit} {t.duplicateNote}</p>
   {Object.entries(errors).map(([id,message])=><p className="feature-error" role="alert" key={id}>{id==="scan"?"SHA-256: ":""}{message}</p>)}
   {outputs.length>0&&<><p className="feature-success" role="status">{t.done} · {outputs.length} {t.items}. {totalSaved>=0?"+":""}{totalSaved.toLocaleString()} bytes difference</p><div className="batch-output-grid"><h3>{t.results}</h3>{outputs.map(item=><article className="batch-output-card" key={item.id}><div><strong>{item.filename}</strong><span>{item.width} × {item.height} px · {Math.round(item.sizeBefore/1024)} KB → {Math.round(item.blob.size/1024)} KB</span></div><button type="button" onClick={()=>downloadBlob(item.blob,item.filename)}>{t.downloadOne}</button></article>)}</div></>}
   {duplicateGroups.length>0&&<div className="duplicate-results"><h3>{t.dupes} · {duplicateGroups.length}</h3>{duplicateGroups.map((group,index)=><p key={index}>{group.map(id=>images.find(image=>image.id===id)?.name||id).join(" · ")}</p>)}</div>}
   {duplicateGroups.length===0&&!scanBusy&&selected.length>1&&<p className="feature-note">{t.noDuplicates}</p>}
  </div></div>
 </section>;
}
