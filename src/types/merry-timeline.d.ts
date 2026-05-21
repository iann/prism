declare module 'merry-timeline' {
  interface MerryDataPoint {
    time: number;
    color: string;
    text: string;
    annotation?: string;
  }

  interface MerryOptions {
    width?: number;
    tracker?: number | false;
    timezone?: string;
  }

  function timeline(
    element: HTMLElement,
    data: MerryDataPoint[],
    options?: MerryOptions,
  ): void;

  export default timeline;
}
