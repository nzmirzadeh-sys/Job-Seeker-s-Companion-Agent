/**
 * Design Tokens - سیستم رنگی و تایپوگرافی Retro
 * پالتِ زرد و مشکی HAMRAH.EXE
 */

export const retroColors = {
  // پس‌زمینه‌ها
  bg: {
    primary: '#FBF7EC',    // پس‌زمینهٔ اصلی - کرم/پوستی
    secondary: '#FCE9A8',  // secondary - زرد کم‌رنگ (هایلایت)
    tertiary: '#F2C230',   // tertiary - زرد خردلی (نوار عنوان)
    overlay: 'rgba(20, 19, 17, 0.5)', // overlay شفاف - مشکی چرمی
  },

  // مرزها و خطوط
  border: {
    primary: '#141311',    // مرزهای اصلی - مشکی چرمی
    secondary: '#8B8680',  // مرزهای secondary - خاکستری سیاه
    light: '#C9C3BB',      // مرزهای روشن - طوسی روشن
  },

  // متن‌ها
  text: {
    primary: '#141311',    // متن اصلی - مشکی چرمی
    secondary: '#5A5450',  // متن فرعی - خاکستری تیره
    tertiary: '#8B8680',   // متن tertiary - خاکستری
    light: '#C9C3BB',      // متن روشن
    inverse: '#FBF7EC',    // متن معکوس - کرم
  },

  // رنگ‌های تأکید (اصلی: زرد)
  accent: {
    primary: '#F2C230',    // زرد خردلی - primary action
    hover: '#E6B717',      // hover state - زرد تیره‌تر
    active: '#D9A815',     // active state - زرد تیره
  },

  // رنگ‌های state (محدود و کم‌رنگ)
  status: {
    success: '#3B7A4A',    // تأیید - سبز کدر (فقط بج/آیکون)
    warning: '#C98A1F',    // اخطار - زرد کهربایی (فقط بج/آیکون)
    error: '#B23A2E',      // خطا - قرمز آجری (فقط بج/آیکون)
    info: '#F2C230',       // اطلاعات - زرد خردلی
  },

  // رنگ‌های خاص
  special: {
    highlight: '#FCE9A8',  // نمایش - زرد کم‌رنگ
    disabled: '#C9C3BB',   // غیرفعال - خاکستری روشن
  },
};

export const retroTypography = {
  // فونت‌ها
  fonts: {
    mono: 'Courier New, Courier, monospace', // فونت retro
    system: 'system-ui, -apple-system, sans-serif', // fallback
  },

  // اندازه‌ها (px)
  sizes: {
    xs: '10px',
    sm: '12px',
    base: '14px',
    lg: '16px',
    xl: '18px',
    '2xl': '20px',
    '3xl': '24px',
  },

  // وزن‌ها
  weights: {
    normal: 400,
    bold: 700,
  },

  // خط‌ارتفاع
  lineHeights: {
    tight: '1.2',
    normal: '1.5',
    relaxed: '1.75',
  },
};

export const retroSpacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
};

export const retroBorders = {
  // ضخامت مرزها (px)
  thin: '1px',
  normal: '2px',
  thick: '3px',
  extraThick: '4px',

  // استایل‌های مرز
  styles: {
    solid: 'solid',
    dotted: 'dotted',
    dashed: 'dashed',
  },
};

export const retroShadows = {
  // سایه‌های Retro (بدون soft shadow - تنها hard shadows)
  none: 'none',
  inset: 'inset 1px 1px 0 rgba(0,0,0,0.25)',
  outset: '1px 1px 0 rgba(0,0,0,0.25)',
};

export const retroRadius = {
  // Retro: بدون radius - تمام گوشه‌ها مربع
  none: '0px',
};

/**
 * استفاده در Tailwind:
 * این token‌ها به صورت CSS variables در globals.css ست می‌شوند
 */
