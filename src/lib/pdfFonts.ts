import jsPDF from 'jspdf';

// Unicode ranges for script detection
const TAMIL_RANGE = /[\u0B80-\u0BFF]/;
const DEVANAGARI_RANGE = /[\u0900-\u097F]/;
const BENGALI_RANGE = /[\u0980-\u09FF]/;
const TELUGU_RANGE = /[\u0C00-\u0C7F]/;
const KANNADA_RANGE = /[\u0C80-\u0CFF]/;
const MALAYALAM_RANGE = /[\u0D00-\u0D7F]/;
const ARABIC_RANGE = /[\u0600-\u06FF]/;
const CJK_RANGE = /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/;

type ScriptId = 'tamil' | 'devanagari' | 'bengali' | 'telugu' | 'kannada' | 'malayalam' | 'latin';

interface FontConfig {
  name: string;
  regularUrl: string;
  boldUrl: string;
}

// Static TTF font URLs from fontsource CDN (jsPDF requires static, not variable fonts)
const SCRIPT_FONTS: Record<string, FontConfig> = {
  tamil: {
    name: 'NotoSansTamil',
    regularUrl: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-tamil@latest/tamil-400-normal.ttf',
    boldUrl: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-tamil@latest/tamil-700-normal.ttf',
  },
  devanagari: {
    name: 'NotoSansDevanagari',
    regularUrl: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-devanagari@latest/devanagari-400-normal.ttf',
    boldUrl: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-devanagari@latest/devanagari-700-normal.ttf',
  },
  bengali: {
    name: 'NotoSansBengali',
    regularUrl: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-bengali@latest/bengali-400-normal.ttf',
    boldUrl: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-bengali@latest/bengali-700-normal.ttf',
  },
  telugu: {
    name: 'NotoSansTelugu',
    regularUrl: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-telugu@latest/telugu-400-normal.ttf',
    boldUrl: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-telugu@latest/telugu-700-normal.ttf',
  },
  kannada: {
    name: 'NotoSansKannada',
    regularUrl: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kannada@latest/kannada-400-normal.ttf',
    boldUrl: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kannada@latest/kannada-700-normal.ttf',
  },
  malayalam: {
    name: 'NotoSansMalayalam',
    regularUrl: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-malayalam@latest/malayalam-400-normal.ttf',
    boldUrl: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-malayalam@latest/malayalam-700-normal.ttf',
  },
};

// jsPDF uses WinAnsiEncoding by default; for real Unicode scripts (Tamil/Indic/etc.)
// we must register fonts with Identity-H.
const UNICODE_ENCODING = 'Identity-H';

// Cache fetched fonts in memory
const fontCache = new Map<string, string>();

/**
 * Detect the primary non-Latin script in the given text.
 * Returns the script ID or 'latin' if no non-Latin characters found.
 */
export function detectScript(text: string): ScriptId {
  if (TAMIL_RANGE.test(text)) return 'tamil';
  if (DEVANAGARI_RANGE.test(text)) return 'devanagari';
  if (BENGALI_RANGE.test(text)) return 'bengali';
  if (TELUGU_RANGE.test(text)) return 'telugu';
  if (KANNADA_RANGE.test(text)) return 'kannada';
  if (MALAYALAM_RANGE.test(text)) return 'malayalam';
  return 'latin';
}

/**
 * Fetch a font file from URL and convert to base64 string.
 */
async function fetchFontAsBase64(url: string): Promise<string> {
  if (fontCache.has(url)) return fontCache.get(url)!;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch font from ${url}: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Convert to base64 in chunks to avoid call stack overflow for large fonts
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }

  const base64 = btoa(binary);
  fontCache.set(url, base64);
  return base64;
}

/**
 * Load and register the appropriate Unicode font for the given content.
 * Returns the font family name to use, or 'helvetica' if Latin-only.
 *
 * Also monkey-patches doc.setFont() so existing "helvetica" calls
 * automatically use the loaded Unicode font instead.
 */
export async function setupUnicodeFontForPDF(
  doc: jsPDF,
  contentSamples: string[]
): Promise<void> {
  const allContent = contentSamples.join(' ');
  const script = detectScript(allContent);

  if (script === 'latin') {
    // No custom font needed, helvetica works fine
    return;
  }

  const fontConfig = SCRIPT_FONTS[script];
  if (!fontConfig) return;

  try {
    // Fetch both regular and bold variants
    const [regularBase64, boldBase64] = await Promise.all([
      fetchFontAsBase64(fontConfig.regularUrl),
      fetchFontAsBase64(fontConfig.boldUrl),
    ]);

    // Register fonts with jsPDF
    const regularFileName = `${fontConfig.name}-Regular.ttf`;
    const boldFileName = `${fontConfig.name}-Bold.ttf`;

    doc.addFileToVFS(regularFileName, regularBase64);
    doc.addFont(regularFileName, fontConfig.name, 'normal', UNICODE_ENCODING);

    doc.addFileToVFS(boldFileName, boldBase64);
    doc.addFont(boldFileName, fontConfig.name, 'bold', UNICODE_ENCODING);

    // Monkey-patch setFont to redirect "helvetica" to our Unicode font
    const originalSetFont = doc.setFont.bind(doc);
    (doc as any).setFont = (
      fontName: string,
      fontStyle?: string,
      fontWeight?: string | number
    ) => {
      if (fontName?.toLowerCase?.() === 'helvetica') {
        fontName = fontConfig.name;
      }
      return originalSetFont(fontName, fontStyle, fontWeight);
    };

    // Set the font as default
    doc.setFont(fontConfig.name, 'normal');

    console.log(`Loaded ${script} font: ${fontConfig.name}`);
  } catch (error) {
    console.error(`Failed to load ${script} font, falling back to helvetica:`, error);
    // Silently fall back to helvetica - non-Latin text won't render correctly
    // but the PDF will still be generated
  }
}
