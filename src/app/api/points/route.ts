import { NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { users, choreCompletions, settings } from '@/lib/db/schema';
import { eq, isNotNull } from 'drizzle-orm';
import { getCached } from '@/lib/cache/redis';
import { startOfWeek, startOfMonth, startOfYear } from 'date-fns';
import { logError } from '@/lib/utils/logError';

export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ points: [] });
  }

  try {
    const data = await getCached(
      'points:summary',
      async () => {
        const [wso] = await db.select().from(settings).where(eq(settings.key, 'weekStartsOn'));
        const weekStartsOn: 0 | 1 = wso?.value === '1' ? 1 : 0;

        const children = await db
          .select({ id: users.id, name: users.name, color: users.color })
          .from(users)
          .where(eq(users.role, 'child'));

        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn });
        const monthStart = startOfMonth(now);
        const yearStart = startOfYear(now);

        // Fetch approved completions once and aggregate in memory. The old
        // implementation issued one query per child, which becomes needlessly
        // expensive on a display that refreshes the points widget regularly.
        const completions = await db
          .select({
            completedBy: choreCompletions.completedBy,
            pointsAwarded: choreCompletions.pointsAwarded,
            completedAt: choreCompletions.completedAt,
          })
          .from(choreCompletions)
          .where(isNotNull(choreCompletions.approvedBy));

        const completionsByChild = new Map<string, typeof completions>();
        for (const completion of completions) {
          const childCompletions = completionsByChild.get(completion.completedBy) || [];
          childCompletions.push(completion);
          completionsByChild.set(completion.completedBy, childCompletions);
        }

        const summaries = children.map((child) => {
          const childCompletions = completionsByChild.get(child.id) || [];

          let weekly = 0;
          let monthly = 0;
          let yearly = 0;
          let allTime = 0;

          for (const c of childCompletions) {
            const pts = c.pointsAwarded ?? 0;
            allTime += pts;
            if (c.completedAt >= yearStart) yearly += pts;
            if (c.completedAt >= monthStart) monthly += pts;
            if (c.completedAt >= weekStart) weekly += pts;
          }

          return {
            userId: child.id,
            name: child.name,
            color: child.color,
            weekly,
            monthly,
            yearly,
            allTime,
          };
        });

        return summaries;
      },
      120
    );

    return NextResponse.json({ points: data });
  } catch (error) {
    logError('Error fetching points:', error);
    return NextResponse.json({ error: 'Failed to fetch points' }, { status: 500 });
  }
}
