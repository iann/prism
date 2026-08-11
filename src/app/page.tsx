import { DashboardClient } from './DashboardClient';
import { db } from '@/lib/db/client';

export const metadata = {
  title: 'Dashboard',
  description: 'Your family dashboard - view calendars, tasks, weather, and more.',
};

// The default dashboard reads its per-display font scale from the database.
// Keep this route dynamic so a change in Settings is reflected without
// requiring the next Docker build to bake in a new value.
export const dynamic = 'force-dynamic';

// Both the default and named dashboards wrap their content in a zoom
// container driven by `layouts.fontScale`. The default route reads the
// selected layout here; named dashboards do the equivalent in their layout.
export default async function HomePage() {
  let fontScale = 100;
  try {
    const layout = await db.query.layouts.findFirst({
      where: (l, { eq: eqFn }) => eqFn(l.isDefault, true),
      columns: { fontScale: true },
    });
    fontScale = layout?.fontScale ?? 100;
  } catch {
    // DB unavailable — keep default scale.
  }

  return (
    <main className="min-h-screen bg-background">
      <div id="ssr-placeholder" className="h-screen flex items-center justify-center" aria-hidden="true">
        <h1 className="text-4xl font-bold text-muted-foreground/20">Prism</h1>
      </div>
      <div style={fontScale !== 100 ? { zoom: fontScale / 100 } : undefined}>
        <DashboardClient />
      </div>
    </main>
  );
}
