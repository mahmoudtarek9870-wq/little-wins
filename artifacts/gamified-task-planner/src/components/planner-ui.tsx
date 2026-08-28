import { type ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { BarChart3, CalendarDays, ChevronRight, CircleHelp, Flame, Goal, History, LayoutDashboard, Menu, Settings2, Sparkles, Trophy, X } from 'lucide-react';

export const navItems = [
  { href: '/', label: 'Today', icon: LayoutDashboard },
  { href: '/history', label: 'History', icon: History },
  { href: '/challenges', label: 'Challenges', icon: Trophy },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings2 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeLabel = navItems.find((item) => item.href === location)?.label ?? 'Today';
  return (
    <div className="app-shell grain flex min-h-[100dvh] text-foreground">
      <aside className="hidden w-[250px] shrink-0 flex-col bg-sidebar px-5 py-7 text-sidebar-foreground md:flex">
        <Link href="/" className="mb-12 flex items-center gap-3" data-testid="link-brand">
          <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-black/10"><Sparkles size={19} /></span>
          <span><span className="block font-serif text-[17px] font-bold tracking-tight">Little Wins</span><span className="font-mono text-[9px] uppercase tracking-[.2em] opacity-55">personal planner</span></span>
        </Link>
        <p className="mb-3 px-3 font-mono text-[9px] uppercase tracking-[.2em] text-sidebar-foreground/40">Your space</p>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location === item.href;
            return <Link key={item.href} href={item.href} data-testid={`link-nav-${item.label.toLowerCase()}`} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition-all ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`}><Icon size={17} strokeWidth={active ? 2.4 : 1.8} /><span>{item.label}</span>{active && <ChevronRight size={14} className="ml-auto opacity-50" />}</Link>;
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-4">
          <div className="mb-3 flex items-center gap-2 text-sidebar-primary"><CircleHelp size={16} /><span className="font-mono text-[10px] uppercase tracking-wider">A small note</span></div>
          <p className="text-[12px] leading-relaxed text-sidebar-foreground/65">You don't need a perfect day. Just a next one.</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-5 py-5 md:hidden">
          <button type="button" onClick={() => setMenuOpen(true)} data-testid="button-open-menu" className="rounded-xl p-2 text-foreground hover:bg-muted"><Menu size={21} /></button>
          <span className="font-serif text-lg font-bold">{activeLabel}</span>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Sparkles size={16} /></span>
        </header>
        {menuOpen && <div className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm md:hidden" onClick={() => setMenuOpen(false)}><div className="h-full w-[280px] bg-sidebar p-5 text-sidebar-foreground shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="mb-10 flex items-center justify-between"><span className="font-serif text-xl font-bold">Little Wins</span><button onClick={() => setMenuOpen(false)} data-testid="button-close-menu" className="rounded-lg p-2"><X size={19} /></button></div><nav className="space-y-1">{navItems.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} data-testid={`link-mobile-${item.label.toLowerCase()}`} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-sidebar-foreground/75"><Icon size={18} />{item.label}</Link>; })}</nav></div></div>}
        <main className="mx-auto w-full max-w-[1240px] flex-1 px-5 pb-10 md:px-10 md:py-9 lg:px-14">{children}</main>
        <nav className="sticky bottom-0 z-30 flex justify-around border-t border-border bg-card/95 px-2 py-2 backdrop-blur md:hidden">{navItems.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} data-testid={`link-bottom-${item.label.toLowerCase()}`} className={`flex min-w-[54px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[9px] font-bold ${location === item.href ? 'text-primary' : 'text-muted-foreground'}`}><Icon size={17} />{item.label}</Link>; })}</nav>
      </div>
    </div>
  );
}

export function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-in mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.22em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-accent" />{eyebrow}</p><h1 className="font-serif text-4xl font-bold leading-none tracking-[-.04em] text-foreground md:text-5xl">{title}</h1>{description && <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>}</div>{action}</div>;
}

export function SectionLabel({ children, icon: Icon = CalendarDays }: { children: ReactNode; icon?: typeof CalendarDays }) {
  return <div className="mb-3 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[.18em] text-muted-foreground"><Icon size={13} className="text-primary" />{children}</div>;
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return <div className={`progress-track h-2 ${className}`}><div className="progress-fill h-full" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}

export function LoadingBlock({ lines = 4 }: { lines?: number }) {
  return <div className="space-y-3" data-testid="status-loading">{Array.from({ length: lines }).map((_, i) => <div key={i} className={`skeleton h-16 rounded-2xl ${i === lines - 1 ? 'w-3/4' : 'w-full'}`} />)}</div>;
}

export function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return <div className="soft-card rounded-3xl p-8 text-center" data-testid="status-error"><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-accent/30"><Flame size={22} className="text-primary" /></div><h3 className="font-serif text-xl font-bold">The path got foggy</h3><p className="mt-2 text-sm text-muted-foreground">We couldn't bring this moment into view.</p><button onClick={onRetry} data-testid="button-retry" className="mt-5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Try again</button></div>;
}

export function EmptyBlock({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <div className="soft-card rounded-3xl border-dashed p-10 text-center" data-testid="status-empty"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-secondary"><Goal size={24} className="text-primary" /></div><h3 className="font-serif text-xl font-bold">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>{action && <div className="mt-5">{action}</div>}</div>;
}