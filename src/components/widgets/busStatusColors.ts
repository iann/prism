export const BUS_STATUS_COLORS = {
  arrived: {
    className: 'bg-status-success',
    lightHex: '#15803d',
  },
  inTransit: {
    className: 'bg-status-warning',
    lightHex: '#b45309',
  },
  overdue: {
    className: 'bg-status-error',
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
