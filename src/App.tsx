import { useEffect, useState } from "react";
import { getDirection, getMessages, type Locale } from "./i18n";
const icons = ["▦", "✳", "▧", "⌘"];
export default function App() {
  const [locale, setLocale] = useState<Locale>(() => window.localStorage.getItem("waraqati-locale") === "en" ? "en" : "ar");
  const t = getMessages(locale);
  const direction = getDirection(locale);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
    window.localStorage.setItem("waraqati-locale", locale);
  }, [locale, direction]);
  const toolNames = [t.layout, t.stickers, t.photos, t.batch];
  return <main className="app-shell" dir={direction}>
    <div className="ambient ambient-one" aria-hidden="true" /><div className="ambient ambient-two" aria-hidden="true" />
    <header className="topbar"><a className="brand" href="#home" aria-label={t.brand}><span className="brand-mark"><span /></span><span>{t.brand}<small>STUDIO</small></span></a>
      <div className="topbar-actions"><span className="status"><i />{locale === "ar" ? "مساحة عمل محلية" : "Local workspace"}</span><button className="language-button" onClick={() => setLocale(locale === "ar" ? "en" : "ar")} type="button"><span aria-hidden="true">◎</span>{t.language}</button></div>
    </header>
    <section className="hero" id="home"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line" />{t.eyebrow}</div><h1>{t.title}<span className="title-spark" aria-hidden="true">✳</span></h1><p className="hero-subtitle">{t.subtitle}</p>
      <div className="hero-actions"><a className="button button-primary" href="#tools">{t.start}<span aria-hidden="true">{locale === "ar" ? "↙" : "↗"}</span></a><a className="button button-quiet" href="#tools">{t.explore}<span aria-hidden="true">⌄</span></a></div>
      <div className="hero-note"><span className="note-icon">✦</span><span>{locale === "ar" ? "من الفكرة إلى الورقة — بطريقتك أنت." : "From your idea to the printed page — your way."}</span></div></div>
      <div className="preview-stage" aria-label={locale === "ar" ? "تصور توضيحي لتخطيط الصور" : "Illustration of an image layout"}><div className="stage-orbit orbit-a" /><div className="stage-orbit orbit-b" /><div className="floating-label label-top"><span />{locale === "ar" ? "تخطيط حر" : "FREE LAYOUT"}</div>
        <div className="paper paper-back"><div className="paper-lines" /></div><div className="paper paper-front"><div className="paper-heading"><span>W.</span><i /></div><div className="photo-grid"><div className="photo photo-one"><span className="sun" /><span className="hill hill-one" /><span className="hill hill-two" /></div><div className="photo photo-two"><span className="sun" /><span className="hill hill-one" /><span className="hill hill-two" /></div><div className="photo photo-three"><span className="sun" /><span className="hill hill-one" /><span className="hill hill-two" /></div></div><div className="paper-caption"><span /><span /><span /></div><div className="paper-footer"><b>YOUR MOMENTS</b><b>01 — 03</b></div></div>
        <div className="floating-label label-bottom"><span className="label-check">✓</span>{locale === "ar" ? "جاهز للإبداع" : "READY TO CREATE"}</div><div className="stage-glow" /></div></section>
    <section className="tools-section" id="tools"><div className="section-heading"><div><div className="section-kicker">01 / WORKSPACE</div><h2>{t.tools}</h2></div><span className="section-count">04 <i /> {locale === "ar" ? "أدوات" : "TOOLS"}</span></div>
      <div className="tool-grid">{toolNames.map((name, i) => <article className={`tool-card tool-card-${i + 1}`} key={name}><div className="tool-card-top"><span className="tool-number">0{i + 1}</span><span className="tool-icon" aria-hidden="true">{icons[i]}</span></div><h3>{name}</h3><div className="tool-card-bottom"><span className="coming-soon"><i />{t.comingSoon}</span><span className="card-arrow" aria-hidden="true">↗</span></div></article>)}</div>
    </section>
    <section className="principles"><article><span className="principle-icon">◈</span><div><h3>{t.localFirst}</h3><p>{t.localFirstBody}</p></div></article><article><span className="principle-icon">⌗</span><div><h3>{t.precision}</h3><p>{t.precisionBody}</p></div></article><article><span className="principle-icon">▣</span><div><h3>{t.responsive}</h3><p>{t.responsiveBody}</p></div></article></section>
    <footer className="footer"><a className="footer-brand" href="#home">W<span>.</span></a><p>{t.footer}</p><span>MADE TO MAKE</span></footer>
  </main>;
}