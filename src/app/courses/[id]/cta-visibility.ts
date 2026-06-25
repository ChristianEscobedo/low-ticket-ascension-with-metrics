export interface VideoCTA {
  id: string;
  title: string;
  subtitle?: string | null;
  buttonText: string;
  link: string;
  linkTarget?: '_blank' | '_self';
  type: 'offer' | 'book-call' | 'webinar' | 'link';
  style: 'glass' | 'solid' | 'gradient' | 'pulse';
  position: 'bottom-bar' | 'bottom-right' | 'top-bar' | 'center-modal';
  showAfterSeconds: number;
  autoHideSeconds?: number | null;
  dismissable: boolean;
  showOnce?: boolean;
}

/**
 * Pure visibility selector. Used by VideoCTAOverlay and exercised directly
 * in unit tests so the time-gating logic stays correct without a DOM.
 */
export function selectVisibleCtas(
  ctas: VideoCTA[] | null | undefined,
  currentTime: number,
  dismissed: Set<string>,
  autoHidden: Set<string>
): VideoCTA[] {
  if (!ctas?.length) return [];
  return ctas.filter(
    (c) =>
      !dismissed.has(c.id) &&
      !autoHidden.has(c.id) &&
      currentTime >= (c.showAfterSeconds || 0)
  );
}
