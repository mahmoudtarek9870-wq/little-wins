import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Compass } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="app-shell grain flex min-h-[100dvh] items-center justify-center p-5">
      <Card className="soft-card w-full max-w-md rounded-3xl">
        <CardContent className="p-8">
          <div className="mb-7 grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary">
            <Compass size={27} />
          </div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[.2em] text-primary">A wrong turn</p>
          <h1 className="font-serif text-3xl font-bold tracking-tight">This page wandered off.</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">No matter. The next useful thing is always closer than it looks.</p>
          <Link href="/" data-testid="link-not-found-home" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground">
            <ArrowLeft size={15} />Back to today
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
