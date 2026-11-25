import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dashboardSource = readFileSync(
  join(process.cwd(), 'src/components/dashboard/Dashboard.tsx'),
  'utf8'
);

describe('dashboard birthday celebration integration', () => {
  it('mounts the celebration in both normal responsive branches', () => {
    const celebrationMounts =
      dashboardSource.match(
        /<BirthdayCelebration celebrations=\{data\.birthdays\.birthdays\} \/>/g
      ) ?? [];
    const mobileBranch = dashboardSource.slice(
      dashboardSource.indexOf('if (isMobile) {'),
      dashboardSource.indexOf('\n  return (', dashboardSource.indexOf('if (isMobile) {'))
    );
    const desktopBranch = dashboardSource.slice(
      dashboardSource.indexOf('\n  return (', dashboardSource.indexOf('if (isMobile) {'))
    );

    expect(celebrationMounts).toHaveLength(2);
    expect(
      mobileBranch.match(/<BirthdayCelebration celebrations=\{data\.birthdays\.birthdays\} \/>/g)
    ).toHaveLength(1);
    expect(
      mobileBranch.match(/<PartyModeButton celebrations=\{data\.birthdays\.birthdays\} \/>/g)
    ).toHaveLength(1);
    expect(mobileBranch.indexOf('<AppShell')).toBeLessThan(
      mobileBranch.indexOf('<BirthdayCelebration celebrations=')
    );
    expect(
      desktopBranch.match(/<BirthdayCelebration celebrations=\{data\.birthdays\.birthdays\} \/>/g)
    ).toHaveLength(1);
    expect(
      desktopBranch.match(/<PartyModeButton celebrations=\{data\.birthdays\.birthdays\} \/>/g)
    ).toHaveLength(1);
    expect(desktopBranch.indexOf('<BirthdayCelebration celebrations=')).toBeLessThan(
      desktopBranch.indexOf('<DashboardLayout')
    );

    // Both standard and LCARS dashboards stay on these responsive paths;
    // AppShell owns the LCARS chrome around the same dashboard content.
    expect(mobileBranch).toContain('<AppShell');
    expect(desktopBranch).toContain('<DashboardLayout');
  });
});
