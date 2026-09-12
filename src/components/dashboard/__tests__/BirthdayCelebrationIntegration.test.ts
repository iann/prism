import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dashboardSource = readFileSync(
  join(process.cwd(), 'src/components/dashboard/Dashboard.tsx'),
  'utf8'
);

describe('dashboard birthday celebration integration', () => {
  it('mounts the celebration in both normal responsive branches', () => {
    const celebrationMounts = dashboardSource.match(/<BirthdayCelebration \/>/g) ?? [];
    const mobileBranch = dashboardSource.slice(
      dashboardSource.indexOf('if (isMobile) {'),
      dashboardSource.indexOf('\n  return (', dashboardSource.indexOf('if (isMobile) {'))
    );
    const desktopBranch = dashboardSource.slice(
      dashboardSource.indexOf('\n  return (', dashboardSource.indexOf('if (isMobile) {'))
    );

    expect(celebrationMounts).toHaveLength(2);
    expect(mobileBranch.match(/<BirthdayCelebration \/>/g)).toHaveLength(1);
    expect(mobileBranch.indexOf('<BirthdayCelebration />')).toBeLessThan(
      mobileBranch.indexOf('<LCARSFrame')
    );
    expect(desktopBranch.match(/<BirthdayCelebration \/>/g)).toHaveLength(1);
    expect(desktopBranch.indexOf('<BirthdayCelebration />')).toBeLessThan(
      desktopBranch.indexOf('<DashboardLayout')
    );

    // Both standard and LCARS dashboards stay on these same responsive paths;
    // the celebration is a child of AppShell, outside either content wrapper.
    expect(mobileBranch).toContain('<LCARSFrame');
    expect(desktopBranch).toContain('<DashboardLayout');
  });
});
