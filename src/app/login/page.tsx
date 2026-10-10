import Link from "next/link";
import { signIn } from "./actions";
import { BrandLogo } from "@/components/ui/brand-logo";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ notice?: string; lang?: string }> }) {
  const { notice, lang } = await searchParams;
  const english = lang === "en";
  const message = notice === "unauthorized"
    ? english ? "This account is not authorized to access the admin workspace." : "هذا الحساب غير مخوّل بالدخول إلى مساحة الإدارة."
    : notice
      ? english ? "Sign-in failed. Check your details and try again." : "تعذر تسجيل الدخول. راجع بياناتك وحاول مرة أخرى."
      : "";

  return (
    <main className="status-screen" dir={english ? "ltr" : "rtl"} lang={english ? "en" : "ar"}>
      <div className="auth-layout">
        <aside className="auth-aside">
          <BrandLogo href="/" />
          <div>
            <h2>{english ? "A clear view of every card." : "إدارة واضحة من أول بطاقة."}</h2>
            <p>{english ? "NexTap's workspace for managing business pages, NFC cards and QR codes." : "مساحة فريق NexTap لإدارة صفحات الأنشطة وبطاقات NFC ورموز QR."}</p>
          </div>
          <ul>
            <li>{english ? "Update page content and publish when ready." : "حدّث محتوى الصفحة وانشره عند جاهزيته."}</li>
            <li>{english ? "Track each card and its assigned page." : "تابع حالة البطاقة والصفحة المرتبطة بها."}</li>
            <li>{english ? "Prepare manufacturing and card exports." : "أنشئ ملفات التصدير الخاصة بالتصنيع."}</li>
          </ul>
          <Link href="/" className="auth-home-link">{english ? "Back to NexTap" : "العودة إلى NexTap"}</Link>
        </aside>

        <section className="form-card login-card" aria-labelledby="login-title">
          <div className="auth-switch-row">
            <span className="login-mark" aria-hidden="true" />
            <Link className="language-switch" href={"/login?lang=" + (english ? "ar" : "en")}>{english ? "العربية" : "English"}</Link>
          </div>
          <h1 id="login-title">{english ? "Team sign in" : "دخول فريق NexTap"}</h1>
          <p className="muted">{english ? "This workspace is for NexTap administrators." : "هذه المساحة مخصصة لأعضاء فريق الإدارة."}</p>
          {message && <div className="alert" role="alert">{message}</div>}
          <form action={signIn}>
            <label className="field" htmlFor="email">{english ? "Email address" : "البريد الإلكتروني"}
              <input id="email" type="email" name="email" dir="ltr" autoComplete="username" required maxLength={254} />
            </label>
            <label className="field" htmlFor="password">{english ? "Password" : "كلمة المرور"}
              <input id="password" type="password" name="password" dir="ltr" autoComplete="current-password" required maxLength={256} />
            </label>
            <SubmitButton className="button gold" pendingText={english ? "Checking..." : "جارٍ التحقق..."}>
              {english ? "Sign in securely" : "دخول آمن"}
            </SubmitButton>
          </form>
          <p className="notice">{english ? "Administrator accounts are created by invitation. Self-service registration is disabled." : "تُنشأ حسابات الإدارة بدعوة من مسؤول NexTap. لا يتوفر التسجيل الذاتي."}</p>
        </section>
      </div>
    </main>
  );
}
