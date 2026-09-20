/**
 * Future optional module: screenshot / OCR "understand the screen".
 * Hard-off by default. Never captures pixels in this build.
 */
export const SCREEN_UNDERSTANDING_IMPLEMENTED = false;

export function screenUnderstandingActive(flag: boolean | undefined): boolean {
  return SCREEN_UNDERSTANDING_IMPLEMENTED && flag === true;
}

export async function captureScreenUnderstanding(): Promise<null> {
  return null;
}
