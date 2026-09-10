function clampByte(value) { return Math.max(0, Math.min(255, Math.round((Number(value) || 0) + 1e-9))); }
function clampPercent(value) { return Math.max(0, Math.min(100, Number(value) || 0)); }
function componentHex(value) { return clampByte(value).toString(16).padStart(2, '0').toUpperCase(); }

function rgbToHex(red, green, blue) { return `#${componentHex(red)}${componentHex(green)}${componentHex(blue)}`; }

function hexToRgb(value) {
  let hex = String(value || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) hex = hex.split('').map(item => item + item).join('');
  if (!/^[0-9a-f]{6}$/i.test(hex)) throw new Error('请输入 3 位或 6 位 HEX 颜色值');
  return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
}

function rgbToHsl(red, green, blue) {
  const r = clampByte(red) / 255;
  const g = clampByte(green) / 255;
  const b = clampByte(blue) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  let hue = 0;
  let saturation = 0;
  if (max !== min) {
    const delta = max - min;
    saturation = light > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue /= 6;
  }
  return { h: Math.round(hue * 360) % 360, s: Math.round(saturation * 100), l: Math.round(light * 100) };
}

function hslToRgb(hue, saturation, lightness) {
  const h = ((Number(hue) || 0) % 360 + 360) % 360 / 360;
  const s = clampPercent(saturation) / 100;
  const l = clampPercent(lightness) / 100;
  if (!s) { const gray = clampByte(l * 255); return { r: gray, g: gray, b: gray }; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = offset => {
    let t = h + offset;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: clampByte(channel(1 / 3) * 255), g: clampByte(channel(0) * 255), b: clampByte(channel(-1 / 3) * 255) };
}

function rgbToCmyk(red, green, blue) {
  const r = clampByte(red) / 255;
  const g = clampByte(green) / 255;
  const b = clampByte(blue) / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  return { c: Math.round((1 - r - k) / (1 - k) * 100), m: Math.round((1 - g - k) / (1 - k) * 100), y: Math.round((1 - b - k) / (1 - k) * 100), k: Math.round(k * 100) };
}

function colorDetails(red, green, blue, alpha = 255) {
  const r = clampByte(red); const g = clampByte(green); const b = clampByte(blue);
  const a = clampByte(alpha);
  const alphaValue = Math.round(a / 255 * 1000) / 1000;
  const hsl = rgbToHsl(r, g, b);
  const cmyk = rgbToCmyk(r, g, b);
  return { r, g, b, a, hex: rgbToHex(r, g, b), rgb: `rgb(${r}, ${g}, ${b})`, rgba: `rgba(${r},${g},${b},${alphaValue})`, alpha: `${Math.round(a / 255 * 100)}%`, hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`, cmyk: `cmyk(${cmyk.c}%,${cmyk.m}%,${cmyk.y}%,${cmyk.k}%)` };
}

module.exports = { clampByte, colorDetails, hexToRgb, hslToRgb, rgbToCmyk, rgbToHex, rgbToHsl };
