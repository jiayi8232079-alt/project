declare module 'svg-captcha' {
  export interface CaptchaOptions {
    size?: number;
    noise?: number;
    color?: boolean;
    background?: string;
    width?: number;
    height?: number;
    fontSize?: number;
    charPreset?: string;
    ignoreChars?: string;
    inverse?: boolean;
  }

  export interface CaptchaObj {
    data: string;
    text: string;
  }

  export function create(options?: CaptchaOptions): CaptchaObj;
  export function createMathExpr(options?: CaptchaOptions): CaptchaObj;
  export function loadFont(url: string): void;

  const svgCaptcha: {
    create: typeof create;
    createMathExpr: typeof createMathExpr;
    loadFont: typeof loadFont;
  };
  export default svgCaptcha;
}
