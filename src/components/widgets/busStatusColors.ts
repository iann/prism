export const BUS_STATUS_COLORS = {
  arrived: {
    className: 'bg-green-700 dark:bg-green-500',
    lightHex: '#15803d',
  },
  inTransit: {
    className: 'bg-amber-700 dark:bg-amber-500',
    lightHex: '#b45309',
  },
  overdue: {
    className: 'bg-red-600 dark:bg-red-500',
    lightHex: '#dc2626',
  },
} as const;

export function getBusStatusColorClass(status: string): string {
  switch (status) {
    case 'at_stop':
    case 'at_school':
      return BUS_STATUS_COLORS.arrived.className;
    case 'in_transit':
    case 'cold_start':
      return BUS_STATUS_COLORS.inTransit.className;
    case 'overdue':
      return BUS_STATUS_COLORS.overdue.className;
    default:
      return 'bg-muted-foreground/50';
  }
}
