// Access gate — JSX port of the approved landing-page mockup (formerly
// public/landing.html): dark split layout, scarlet identity panel, gate card.
// Two deliberate departures from the mockup: fonts are the app's self-hosted
// Barlow (no Google Fonts CDN — the CSP/offline convention holds), and the
// form is wired to Supabase email/password sign-in. Sign-ups are disabled in
// the Supabase project (invitation only), so there is no register/reset flow.
import { useState } from 'react'
import type { FormEvent } from 'react'
import { getSupabase } from './supabaseClient'

const CSS = `
.gate-root{
  --bg:#111214; --panel:#1A1B1E; --card:#202124;
  --scarlet:#E03A3E; --scarlet-deep:#C42F33;
  --silver:#C4CED4; --text:#F5F5F4; --text-muted:#9BA0A6;
  --line-dark:rgba(255,255,255,.09);
  --pcl-yellow:#FFC425; --pcl-green:#005D2F;
  font-family:'Barlow',system-ui,sans-serif;
  background:var(--bg); color:var(--text);
  display:flex; flex-direction:column; min-height:100vh;
}
.gate-root .wrap{flex:1;display:flex;position:relative;overflow:hidden}
.gate-root .identity{
  flex:1.15; background:var(--panel); padding:64px 72px;
  display:flex; flex-direction:column; justify-content:space-between; position:relative;
  clip-path:polygon(0 0,100% 0,calc(100% - 120px) 100%,0 100%);
  animation:gatePanelIn .7s cubic-bezier(.2,.7,.2,1) both;
}
@keyframes gatePanelIn{from{transform:translateX(-24px);opacity:0}to{transform:none;opacity:1}}
.gate-root .identity::after{
  content:"";position:absolute;top:0;right:96px;width:6px;height:100%;
  background:var(--scarlet);transform:skewX(-6.8deg);transform-origin:top;
}
.gate-root .identity::before{
  content:"";position:absolute;top:0;right:78px;width:2px;height:100%;
  background:var(--scarlet);opacity:.45;transform:skewX(-6.8deg);transform-origin:top;
}
.gate-root .lockup{display:flex;align-items:center;gap:14px}
.gate-root .pcl-oval{
  width:54px;height:36px;border-radius:50%;background:var(--pcl-green);
  border:2.5px solid var(--pcl-yellow);display:flex;align-items:center;justify-content:center;
  font-weight:700;font-style:italic;font-size:15px;color:var(--pcl-yellow);
  letter-spacing:.5px;flex:0 0 auto;
}
.gate-root .lockup .div{color:var(--scarlet);font-weight:600;font-size:18px;letter-spacing:2px}
.gate-root .lockup .client{
  font-weight:600;font-size:15px;letter-spacing:2.5px;color:var(--silver);text-transform:uppercase;
}
.gate-root .hero h1{
  font-weight:700;text-transform:uppercase;
  font-size:clamp(40px,4.8vw,68px);line-height:.98;letter-spacing:.5px;max-width:14ch;
}
.gate-root .hero h1 .thin{font-weight:400;color:var(--silver)}
.gate-root .hero .rule{width:64px;height:4px;background:var(--scarlet);margin:28px 0 20px}
.gate-root .hero p{color:var(--text-muted);font-size:15.5px;line-height:1.6;max-width:44ch}
.gate-root .datastrip{
  display:flex;gap:36px;border-top:1px solid var(--line-dark);
  padding-top:24px;padding-right:200px;flex-wrap:wrap;
}
.gate-root .stat .n{
  font-weight:700;font-size:30px;font-variant-numeric:tabular-nums;
  letter-spacing:.5px;white-space:nowrap;
}
.gate-root .stat .l{
  font-size:11px;letter-spacing:1.8px;text-transform:uppercase;
  color:var(--text-muted);margin-top:2px;
}
.gate-root .gate{flex:1;display:flex;align-items:center;justify-content:center;padding:64px 56px}
.gate-root .card{
  width:100%;max-width:400px;background:var(--card);
  border:1px solid var(--line-dark);border-top:3px solid var(--scarlet);
  border-radius:10px;padding:40px 38px 34px;
  animation:gateCardIn .7s .15s cubic-bezier(.2,.7,.2,1) both;
}
@keyframes gateCardIn{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}
.gate-root .card h2{
  font-weight:600;text-transform:uppercase;font-size:24px;letter-spacing:1.5px;margin-bottom:6px;
}
.gate-root .card .sub{color:var(--text-muted);font-size:13.5px;margin-bottom:28px}
.gate-root label{
  display:block;font-size:11px;font-weight:600;letter-spacing:1.6px;
  text-transform:uppercase;color:var(--silver);margin-bottom:7px;
}
.gate-root input{
  width:100%;background:var(--bg);border:1px solid var(--line-dark);border-radius:6px;
  padding:12px 14px;color:var(--text);font-size:15px;font-family:inherit;
  margin-bottom:20px;transition:border-color .15s;
}
.gate-root input:focus{outline:none;border-color:var(--scarlet)}
.gate-root input::placeholder{color:#5a5f66}
.gate-root .btn{
  width:100%;border:none;border-radius:6px;cursor:pointer;
  background:var(--scarlet);color:#fff;font-family:inherit;
  font-weight:600;text-transform:uppercase;font-size:16px;letter-spacing:2px;padding:13px;
  transition:background .15s;
}
.gate-root .btn:hover{background:var(--scarlet-deep)}
.gate-root .btn:focus-visible{outline:2px solid var(--silver);outline-offset:2px}
.gate-root .btn:disabled{opacity:.55;cursor:default}
.gate-root .form-error{color:#ff8a8d;font-size:13px;margin:-8px 0 16px}
.gate-root .notice{
  background:rgba(224,58,62,.12);border:1px solid rgba(224,58,62,.4);border-radius:6px;
  color:var(--text);font-size:13px;padding:10px 12px;margin-bottom:20px;
}
.gate-root .help{margin-top:18px;text-align:center;font-size:12.5px;color:var(--text-muted)}
.gate-root .access{
  margin-top:24px;padding-top:18px;border-top:1px solid var(--line-dark);
  font-size:11.5px;line-height:1.55;color:var(--text-muted);
}
.gate-root footer{
  background:#0D0D0F;border-top:1px solid var(--line-dark);padding:14px 40px;
  display:flex;justify-content:space-between;align-items:center;
  font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--text-muted);
}
.gate-root footer .slashes{color:var(--scarlet);letter-spacing:1px;margin:0 8px}
.gate-root footer .conf{color:var(--silver)}
@media (max-width:900px){
  .gate-root .wrap{flex-direction:column}
  .gate-root .identity{clip-path:none;padding:44px 28px}
  .gate-root .identity::after,.gate-root .identity::before{display:none}
  .gate-root .hero h1{font-size:40px}
  .gate-root .datastrip{gap:28px;padding-right:0}
  .gate-root .gate{padding:36px 24px 56px}
  .gate-root footer{padding:12px 20px}
}
@media (prefers-reduced-motion:reduce){
  .gate-root .identity,.gate-root .card{animation:none}
}
`

export default function SignIn({ notice }: { notice: string | null }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    const { error: signInError } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (signInError) {
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'Invalid email or password.'
          : signInError.message,
      )
      setPending(false)
    }
    // On success Boot's onAuthStateChange takes over (fetch → app).
  }

  return (
    <div className="gate-root">
      <style>{CSS}</style>
      <div className="wrap">
        <section className="identity">
          <div className="lockup">
            <div className="pcl-oval">PCL</div>
            <span className="div">///</span>
            <span className="client">Portland Trail Blazers · Rip City Management</span>
          </div>

          <div className="hero">
            <h1>
              Moda Center
              <br />
              <span className="thin">Capital Program Planner</span>
            </h1>
            <div className="rule" />
            <p>
              Live cost, phasing, and sequencing model for the Moda Center renovation — built and
              maintained by PCL preconstruction. Access is limited to invited project stakeholders.
            </p>
          </div>

          <div className="datastrip">
            <div className="stat">
              <div className="n">65</div>
              <div className="l">Scope items</div>
            </div>
            <div className="stat">
              <div className="n">6</div>
              <div className="l">Construction windows</div>
            </div>
            <div className="stat">
              <div className="n">2027–30</div>
              <div className="l">Program</div>
            </div>
            <div className="stat">
              <div className="n">4</div>
              <div className="l">Stakeholder parties</div>
            </div>
          </div>
        </section>

        <section className="gate">
          <form className="card" onSubmit={onSubmit}>
            <h2>Sign in</h2>
            <div className="sub">Use the credentials provided by your PCL project contact.</div>

            {notice ? <div className="notice">{notice}</div> : null}

            <label htmlFor="gate-email">Email</label>
            <input
              id="gate-email"
              type="email"
              placeholder="name@organization.com"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label htmlFor="gate-pw">Password</label>
            <input
              id="gate-pw"
              type="password"
              placeholder="••••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error ? <div className="form-error">{error}</div> : null}

            <button className="btn" type="submit" disabled={pending}>
              {pending ? 'Signing in…' : 'Enter the planner'}
            </button>

            <div className="help">
              Need access or a password reset? Contact your PCL project contact.
            </div>

            <div className="access">
              This application contains confidential preconstruction information for the Moda Center
              renovation. Access is logged. Do not share credentials.
            </div>
          </form>
        </section>
      </div>

      <footer>
        <span>
          PCL Construction<span className="slashes">///</span>Moda Center
        </span>
        <span className="conf">Confidential — Invited Access Only</span>
      </footer>
    </div>
  )
}
