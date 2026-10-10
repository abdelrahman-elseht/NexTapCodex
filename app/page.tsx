import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

function DevicePreview({ english }: { english: boolean }) {
  return (
    <div className="product-stage" aria-label={english ? "NexTap card and mobile page preview" : "معاينة بطاقة NexTap وصفحة النشاط على الهاتف"}>
      <div className="product-composition">
        <div className="product-card" aria-label="NexTap">
          <span className="card-chip" aria-hidden="true" />
          <img className="brand-logo" src="/nextap_logo_vector.svg" alt="NexTap" width="1310" height="341" />
          <span className="card-wordmark">{english ? "One tap · a clearer connection" : "لمسة واحدة · تواصل أسهل"}</span>
        </div>
        <div className="device-card">
          <div className="device-screen" dir={english ? "ltr" : "rtl"}>
            <div className="device-topline"><span>NexTap / {english ? "business page" : "صفحة النشاط"}</span><span className="dot" /></div>
            <span className="device-mark">ق</span>
            <h3>{english ? "Qahwa & Mazaj" : "قهوة ومزاج"}</h3>
            <p>{english ? "Specialty coffee · New Cairo" : "قهوة مختصة · القاهرة الجديدة"}</p>
            <div className="device-actions">
              <span>{english ? "Chat on WhatsApp" : "تواصل عبر واتساب"}</span>
              <span>{english ? "Find our location" : "اعرف موقعنا"}</span>
              <span>{english ? "Explore menu and services" : "شاهد القائمة والخدمات"}</span>
            </div>
            <div className="device-footer"><span>{english ? "Open today · 8 am — 12 am" : "مفتوح اليوم · 8ص — 12م"}</span><span aria-hidden="true">↗</span></div>
          </div>
        </div>
        <div className="stage-caption">{english ? "A physical card. A page that keeps up." : "بطاقة مادية، وصفحة تتحدث معك."}</div>
      </div>
    </div>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { lang } = await searchParams;
  const english = lang === "en";
  const copy = english ? {
    navHow: "How it works", navBenefits: "What you get", navDemo: "See an example", navLogin: "Team sign in",
    headline: <>One tap opens <strong>your business.</strong></>,
    lead: "An NFC card and QR code open one page for your business. Customers find contact details, location, services and opening hours right from their phone.",
    demo: "See a sample page", discover: "Explore how it works",
    note: "One steady link. Update your page from NexTap whenever you need.",
    processTitle: "From card to customer in three steps.",
    processIntro: "A clear setup for your team, and an instant experience for anyone who taps or scans.",
    process: [
      ["01", "Set up your business page", "Add your details, services, hours and contact links to a page that fits your business."],
      ["02", "Connect your card", "Both the QR code and NFC open the same destination on a customer's phone."],
      ["03", "Update details anytime", "Edit the page or pause a card in your dashboard. The card destination stays in your control."],
    ],
    benefitsTitle: "The details customers need, close at hand.",
    benefitsIntro: "A light mobile page, shaped around the questions people ask before they get in touch.",
    benefits: [
      ["Direct contact", "Show WhatsApp, phone and social links when your business adds them."],
      ["Location and hours", "A map link and opening times in a place people can find."],
      ["A flexible page", "Share services, products or external payment details, then update them in your dashboard."],
      ["An orderly workspace", "Manage businesses, pages, cards and manufacturing batches in one protected space."],
    ],
    storyTitle: "One experience. Two ways to get there.",
    storyIntro: "Each card points to a steady NexTap destination. Customers can scan or tap, while your team keeps the page up to date.",
    audience: [["For customers", "WhatsApp · calls · directions · services · reviews"], ["For your team", "Content · branches · publishing · card status"], ["For production", "QR and NFC links lead to the same page"]],
    ctaTitle: "Start with your business page.", ctaIntro: "Explore a mobile example, then contact NexTap if you have a team contact number.",
    contact: "Contact NexTap", example: "Open the example page", footerLine: "Digital business cards for Egyptian businesses",
    footerExample: "Example", footerTeam: "Team sign in", footerContact: "Contact",
  } : {
    navHow: "كيف تعمل", navBenefits: "ما الذي تقدمه", navDemo: "صفحة تجريبية", navLogin: "دخول فريق NexTap",
    headline: <>لمسة واحدة تفتح <strong>باب عملك.</strong></>,
    lead: "بطاقة NFC ورمز QR يفتحان صفحة واحدة لنشاطك. يجد عميلك التواصل والموقع والخدمات ومواعيد العمل من هاتفه مباشرة.",
    demo: "شاهد صفحة تجريبية", discover: "اكتشف طريقة العمل",
    note: "رابط ثابت؛ حدّث صفحتك من لوحة NexTap متى احتجت.",
    processTitle: "من البطاقة إلى عميلك في ثلاث خطوات.",
    processIntro: "إعداد واضح لفريق النشاط، وتجربة مباشرة لكل من يلمس البطاقة أو يمسح الرمز.",
    process: [
      ["01", "جهّز صفحة نشاطك", "أضف بياناتك وخدماتك وساعات العمل وروابط التواصل في صفحة تناسب نشاطك."],
      ["02", "اربط البطاقة بالصفحة", "تحمل البطاقة رمز QR ورابط NFC إلى الوجهة نفسها، لسهولة الوصول من الهاتف."],
      ["03", "حدّث التفاصيل عند الحاجة", "عدّل الصفحة أو أوقف البطاقة من لوحة الفريق، وتبقى وجهة البطاقة تحت إدارتك."],
    ],
    benefitsTitle: "كل معلومة مهمة، في متناول اليد.",
    benefitsIntro: "صفحة خفيفة على الهاتف، مبنية حول الأسئلة التي يطرحها الزائر قبل أن يتواصل.",
    benefits: [
      ["تواصل مباشر", "اتصال وواتساب وروابط التواصل تظهر عندما يضيفها النشاط."],
      ["الموقع والمواعيد", "عنوان قابل للفتح على الخرائط وساعات العمل في مكان واضح."],
      ["قائمة مرنة", "اعرض الخدمات أو المنتجات أو طرق الدفع الخارجية، وحدّثها من لوحة التحكم."],
      ["إدارة يومية مرتبة", "تابع الأنشطة والصفحات والبطاقات والدفعات من مساحة فريق محمية."],
    ],
    storyTitle: "تجربة واحدة، بطريقتين للوصول.",
    storyIntro: "كل بطاقة تشير إلى وجهة NexTap ثابتة. يستطيع العميل مسح الرمز أو استخدام NFC، ويستطيع الفريق تحديث المحتوى من لوحة الإدارة.",
    audience: [["للزائر", "واتساب · اتصال · اتجاهات · خدمات · تقييمات"], ["لفريق النشاط", "إدارة المحتوى · الفروع · النشر · حالة البطاقات"], ["للتشغيل", "روابط QR وNFC تقود إلى الصفحة نفسها"]],
    ctaTitle: "ابدأ من صفحة نشاطك.", ctaIntro: "استكشف نموذجاً على الهاتف، ثم تواصل مع فريق NexTap إذا كان رقم التواصل متاحاً.",
    contact: "تواصل عبر واتساب", example: "افتح الصفحة التجريبية", footerLine: "بطاقات أعمال رقمية للأنشطة المصرية",
    footerExample: "النموذج", footerTeam: "دخول الفريق", footerContact: "التواصل",
  };

  const whatsappNumber = (process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || "").replace(/\D/g, "");
  const contactUrl = whatsappNumber.length >= 10 && whatsappNumber.length <= 15
    ? "https://wa.me/" + whatsappNumber
    : "/demo";
  const languageHref = english ? "/" : "/?lang=en";

  return (
    <main dir={english ? "ltr" : "rtl"} lang={english ? "en" : "ar"}>
      <link rel="preload" href={english ? "/fonts/dm-sans-400.v1.woff2" : "/fonts/alexandria-400.v1.woff2"} as="font" type="font/woff2" crossOrigin="anonymous" />
      <header className="site-header">
        <div className="container header-row">
          <BrandLogo />
          <nav className="nav" aria-label={english ? "Main navigation" : "التنقل الرئيسي"}>
            <a href="#how">{copy.navHow}</a>
            <a href="#benefits">{copy.navBenefits}</a>
            <Link href="/demo">{copy.navDemo}</Link>
            <Link className="language-switch" href={languageHref}>{english ? "العربية" : "English"}</Link>
            <Link className="button secondary" href={"/login?lang=" + (english ? "en" : "ar")}>{copy.navLogin}</Link>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <h1>{copy.headline}</h1>
            <p>{copy.lead}</p>
            <div className="hero-actions">
              <Link className="button gold" href="/demo">{copy.demo}</Link>
              <a className="button secondary" href="#how">{copy.discover}</a>
            </div>
            <div className="hero-note"><span className="dot" /> {copy.note}</div>
          </div>
          <DevicePreview english={english} />
        </div>
      </section>

      <section id="how" className="section">
        <div className="container section-grid">
          <div className="section-lead"><h2>{copy.processTitle}</h2><p>{copy.processIntro}</p></div>
          <div className="process">{copy.process.map(([number, title, description]) => (
            <article className="process-item" key={number}><span className="number">{number}</span><div><h3>{title}</h3><p>{description}</p></div></article>
          ))}</div>
        </div>
      </section>

      <section id="benefits" className="section alt">
        <div className="container section-grid">
          <div className="section-lead"><h2>{copy.benefitsTitle}</h2><p>{copy.benefitsIntro}</p></div>
          <div className="bento">{copy.benefits.map(([title, description]) => (
            <article className="bento-card" key={title}><h3>{title}</h3><p>{description}</p></article>
          ))}</div>
        </div>
      </section>

      <section className="section">
        <div className="container product-story">
          <div className="story-copy"><h2>{copy.storyTitle}</h2><p>{copy.storyIntro}</p></div>
          <div className="story-lines">{copy.audience.map(([label, detail]) => (
            <div className="story-line" key={label}><strong>{label}</strong><span>{detail}</span></div>
          ))}</div>
        </div>
      </section>

      <section id="contact" className="cta-band">
        <div className="container cta-band-inner">
          <div><h2>{copy.ctaTitle}</h2><p>{copy.ctaIntro}</p></div>
          <div className="hero-actions">
            <a className="button" href={contactUrl} target={contactUrl.startsWith("https:") ? "_blank" : undefined} rel={contactUrl.startsWith("https:") ? "noreferrer" : undefined}>
              {contactUrl.startsWith("https:") ? copy.contact : copy.example}
            </a>
            {contactUrl.startsWith("https:") && <Link className="button secondary" href="/demo">{copy.example}</Link>}
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-row">
          <BrandLogo />
          <span>{copy.footerLine}</span>
          <nav className="footer-links" aria-label={english ? "NexTap links" : "روابط NexTap"}>
            <Link href="/demo">{copy.footerExample}</Link><Link href={"/login?lang=" + (english ? "en" : "ar")}>{copy.footerTeam}</Link><a href="#contact">{copy.footerContact}</a>
          </nav>
          <span>© NexTap</span>
        </div>
      </footer>
    </main>
  );
}
