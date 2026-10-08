import { signIn } from "./actions";
import { BrandLogo } from "@/components/brand-logo";
export const dynamic="force-dynamic";
export default async function Login({searchParams}:{searchParams:Promise<{notice?:string}>}) {
  const {notice}=await searchParams;
  return <main className="status-screen"><section className="form-card" style={{width:"min(440px,100%)",textAlign:"right"}}><BrandLogo/><h1>دخول المالك</h1><p className="muted">هذه المساحة خاصة بفريق NexTap.</p>{notice&&<div className="alert">{notice==="unauthorized"?"هذا الحساب غير مصرح له.":"تعذر تسجيل الدخول. راجع بياناتك وحاول مجدداً."}</div>}<form action={signIn}><label className="field"><span>البريد الإلكتروني</span><input type="email" name="email" autoComplete="username" required maxLength={254}/></label><label className="field"><span>كلمة المرور</span><input type="password" name="password" autoComplete="current-password" required maxLength={256}/></label><button className="button" style={{width:"100%",marginTop:12}}>دخول آمن</button></form><p className="notice">إنشاء الحسابات ذاتياً غير متاح. فعّل حساب المالك من لوحة Supabase ثم أضف معرّفه إلى قائمة المالكين.</p></section></main>;
}
