export type Locale = "ar" | "en";

export const messages = {
  ar: {
    brand: "ورقتي", eyebrow: "استوديو الصور والطباعة", title: "كل صورة لها مكانها.",
    subtitle: "رتّب صورك، ابتكر تخطيطك، وجهّز ورقتك للطباعة — كل ذلك في مساحة واحدة.",
    start: "ابدأ تصميمك", explore: "استكشف الأدوات", tools: "مساحة إبداعك",
    layout: "تخطيط الورق", stickers: "استوديو الملصقات", photos: "استوديو الصور", batch: "المعالجة الجماعية",
    comingSoon: "قريبًا", localFirst: "خصوصيتك أولًا",
    localFirstBody: "الهدف أن تبقى صورك على جهازك وتُعالج محليًا قدر الإمكان.",
    precision: "دقة في كل قياس", precisionBody: "بنية تخطيط موحدة لقياسات الورق والمسافات ومواقع الصور.",
    responsive: "مصمم لكل شاشة", responsiveBody: "تجربة تراعي الهاتف والحاسوب بدل تصغير واجهة واحدة.",
    footer: "ورقتي — ورقتك، على طريقتك.", language: "English",
    localWorkspace: "مساحة عمل محلية", heroNote: "من الفكرة إلى الورقة — بطريقتك أنت.",
    localProcessing: "معالجة محلية", printReady: "مصمم للطباعة",
    previewDescription: "معاينة توضيحية لورقة مطبوعة تضم ثلاثة مواضع للصور",
    freeLayout: "تخطيط حر", readyToCreate: "جاهز للإبداع", moments: "لحظاتك",
    workspaceLabel: "01 / مساحة العمل", toolsSubtitle: "أدوات متخصصة، ومساحة واحدة لكل أفكارك.",
    toolCount: "أدوات", layoutDescription: "رتّب الصور على مقاسات الورق بدقة.", stickersDescription: "جهّز الملصقات في شبكات مرنة للطباعة.",
    photosDescription: "أنشئ أوراق صور شخصية ومعاينات منظمة.", batchDescription: "حوّل الصور واضغطها وعدّلها دفعة واحدة.",
    toolsDisclaimer: "هذه البوابات تعريفية الآن؛ ستُفعّل الأدوات عند اكتمال وظائفها.",
    principlesLabel: "مبادئ ورقتي", footerSignature: "صُنع للإبداع"
  },
  en: {
    brand: "Waraqati", eyebrow: "IMAGE & PRINT STUDIO", title: "Every image has its place.",
    subtitle: "Arrange your photos, shape your layout, and prepare your pages for print — all in one workspace.",
    start: "Start creating", explore: "Explore tools", tools: "Your creative workspace",
    layout: "Paper Layout", stickers: "Sticker Studio", photos: "Photo Studio", batch: "Batch Lab",
    comingSoon: "Coming soon", localFirst: "Privacy comes first",
    localFirstBody: "The goal is to keep your images on your device and process them locally whenever possible.",
    precision: "Precision in every measure", precisionBody: "A shared layout foundation for paper sizes, spacing, and image placement.",
    responsive: "Made for every screen", responsiveBody: "Purposeful experiences for phones and desktops, not one shrunken interface.",
    footer: "Waraqati — Arrange. Create. Print.", language: "العربية",
    localWorkspace: "Local workspace", heroNote: "From your idea to the printed page — your way.",
    localProcessing: "Local processing", printReady: "Made for print",
    previewDescription: "Illustrative preview of a printed page with three image placements",
    freeLayout: "FREE LAYOUT", readyToCreate: "READY TO CREATE", moments: "YOUR MOMENTS",
    workspaceLabel: "01 / WORKSPACE", toolsSubtitle: "Purpose-built tools, one home for every idea.",
    toolCount: "TOOLS", layoutDescription: "Arrange images precisely on paper sizes.", stickersDescription: "Prepare sticker grids ready for printing.",
    photosDescription: "Create organized photo sheets and portraits.", batchDescription: "Convert, compress, and edit images in batches.",
    toolsDisclaimer: "These tool gateways are introductory for now; tools will activate as their features are implemented.",
    principlesLabel: "Waraqati principles", footerSignature: "MADE TO CREATE"
  }
} as const;

export function getDirection(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function getMessages(locale: Locale) {
  return messages[locale];
}
