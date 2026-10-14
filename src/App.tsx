import { useEffect, useState } from "react";
import { getDirection, getMessages, type Locale } from "./i18n";

const toolIcons = ["▦", "✳", "▧", "⌘"];

export default function App() {
  const [locale, setLocale] = useState<Locale>(() =>
    window.localStorage.getItem("waraqati-locale") === "en" ? "en" : "ar"
  );
  const t = getMessages(locale);
  const direction = getDirection(locale);
  const toolNames = [t.layout, t.stickers, t.photos, t.batch];

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
    window.localStorage.setItem("waraqati-locale", locale);
  }, [locale, direction]);

  return (
    <main className="app-shell" dir={direction}>
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <header className="topbar">
        <a className="brand" href="#home" aria-label={t.brand}>
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="brand-word">{t.brand}<small>STUDIO</small></span>
        </a>
        <nav className="topbar-actions" aria-label={locale === "ar" ? "إعدادات الموقع" : "Site settings"}>
          <span className="status"><i aria-hidden="true" />{t.localWorkspace}</span>
          <button
            className="language-button"
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
            type="button"
            aria-label={locale === "ar" ? "Switch to English" : "التبديل إلى العربية"}
          ><span aria-hidden="true">文/A</span>{t.language}</button>
        </nav>
      </header>

      <section className="hero" id="home" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" />{t.eyebrow}</div>
          <h1 id="hero-title">{t.title}<span className="title-spark" aria-hidden="true">✳</span></h1>
          <p className="hero-subtitle">{t.subtitle}</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#tools">{t.start}<span aria-hidden="true">{locale === "ar" ? "↙" : "↗"}</span></a>
            <a className="button button-quiet" href="#tools">{t.explore}<span aria-hidden="true">⌄</span></a>
          </div>
          <div className="hero-note"><span className="note-icon" aria-hidden="true">✦</span><span>{t.heroNote}</span></div>
          <div className="trust-row">
            <span><i aria-hidden="true">✓</i>{t.localProcessing}</span>
            <span><i aria-hidden="true">◇</i>{t.printReady}</span>
          </div>
        </div>

        <div className="preview-stage" role="img" aria-label={t.previewDescription}>
          <div className="stage-orbit orbit-a" aria-hidden="true" />
          <div className="stage-orbit orbit-b" aria-hidden="true" />
          <div className="floating-label label-top"><span />{t.freeLayout}</div>
          <div className="paper paper-back" aria-hidden="true"><div className="paper-lines" /></div>
          <div className="paper paper-front">
            <div className="paper-heading"><span>W.</span><i /></div>
            <div className="photo-grid" aria-hidden="true">
              <div className="photo photo-one"><span className="sun" /><span className="hill hill-one" /><span className="hill hill-two" /></div>
              <div className="photo photo-two"><span className="sun" /><span className="hill hill-one" /><span className="hill hill-two" /></div>
              <div className="photo photo-three"><span className="sun" /><span className="hill hill-one" /><span className="hill hill-two" /></div>
            </div>
            <div className="paper-caption" aria-hidden="true"><span /><span /><span /></div>
            <div className="paper-footer"><b>{t.moments}</b><b>01 — 03</b></div>
          </div>
          <div className="floating-label label-bottom"><span className="label-check">✓</span>{t.readyToCreate}</div>
          <div className="stage-glow" aria-hidden="true" />
          <div className="stage-index" aria-hidden="true">01 <span /> 04</div>
        </div>
      </section>

      <section className="tools-section" id="tools" aria-labelledby="tools-title">
        <div className="section-heading">
          <div><div className="section-kicker">{t.workspaceLabel}</div><h2 id="tools-title">{t.tools}</h2><p>{t.toolsSubtitle}</p></div>
          <span className="section-count"><strong>04</strong><i />{t.toolCount}</span>
        </div>
        <div className="tool-grid">
          {toolNames.map((name, i) => (
            <article className={`tool-card tool-card-${i + 1}`} key={name}>
              <div className="tool-card-top"><span className="tool-number">0{i + 1}</span><span className="tool-icon" aria-hidden="true">{toolIcons[i]}</span></div>
              <h3>{name}</h3>
              <p className="tool-description">{[t.layoutDescription, t.stickersDescription, t.photosDescription, t.batchDescription][i]}</p>
              <div className="tool-card-bottom"><span className="coming-soon"><i aria-hidden="true" />{t.comingSoon}</span><span className="card-arrow" aria-hidden="true">↗</span></div>
            </article>
          ))}
        </div>
        <p className="tools-disclaimer"><span aria-hidden="true">✦</span>{t.toolsDisclaimer}</p>
      </section>

      <section className="principles" aria-label={t.principlesLabel}>
        <article><span className="principle-icon" aria-hidden="true">◈</span><div><h3>{t.localFirst}</h3><p>{t.localFirstBody}</p></div></article>
        <article><span className="principle-icon" aria-hidden="true">⌗</span><div><h3>{t.precision}</h3><p>{t.precisionBody}</p></div></article>
        <article><span className="principle-icon" aria-hidden="true">▣</span><div><h3>{t.responsive}</h3><p>{t.responsiveBody}</p></div></article>
      </section>

      <footer className="footer"><a className="footer-brand" href="#home" aria-label={t.brand}>W<span>.</span></a><p>{t.footer}</p><span>{t.footerSignature}</span></footer>
    </main>
  );
}
