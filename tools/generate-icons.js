/* eslint-disable */
// 生成扩展图标 icons/icon{16,48,128}.png（纯 Node，无依赖）
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT_DIR = path.join(__dirname, "..", "icons");
const SS = 4; // 超采样倍数

// ---------- PNG 编码 ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- 绘制 ----------
function lerpColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function insideRoundedRect(x, y, x0, y0, w, h, r) {
  if (x < x0 || y < y0 || x > x0 + w || y > y0 + h) return false;
  const cx = Math.max(x0 + r, Math.min(x, x0 + w - r));
  const cy = Math.max(y0 + r, Math.min(y, y0 + h - r));
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function insideCircle(x, y, cx, cy, r) {
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function render(size) {
  const S = size * SS;
  const buf = Buffer.alloc(S * S * 4);
  const p = (v) => v * (S / 128); // 以 128 设计稿为基准

  const cTop = [108, 92, 231];   // #6c5ce7
  const cBot = [165, 90, 234];   // #a55eea
  const white = [255, 255, 255];
  const accent = [108, 92, 231];
  const line = [190, 175, 245];

  const radius = p(30);
  const cardX = p(24), cardY = p(34), cardW = p(80), cardH = p(60), cardR = p(8);
  const avatarR = p(9);
  const avatarCX = p(44), avatarCY = p(56);

  for (let y = 0; y < S; y++) {
    const t = y / (S - 1);
    const bg = lerpColor(cTop, cBot, t);
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      let r = 0, g = 0, b = 0, a = 0;
      if (insideRoundedRect(x, y, 0, 0, S, S, radius)) {
        [r, g, b] = bg; a = 255;
        // 白色卡片
        if (insideRoundedRect(x, y, cardX, cardY, cardW, cardH, cardR)) {
          [r, g, b] = white; a = 255;
        }
        // 头像圆点
        if (insideCircle(x, y, avatarCX, avatarCY, avatarR)) {
          [r, g, b] = accent; a = 255;
        }
        // 昵称行（头像右侧）
        if (x >= p(58) && x <= p(92) && y >= p(47) && y <= p(52)) {
          [r, g, b] = accent; a = 255;
        }
        // 签名行（头像右侧短行）
        if (x >= p(58) && x <= p(82) && y >= p(58) && y <= p(61)) {
          [r, g, b] = line; a = 255;
        }
        // 正文两行
        if (x >= p(32) && x <= p(96) && y >= p(70) && y <= p(73)) {
          [r, g, b] = line; a = 255;
        }
        if (x >= p(32) && x <= p(78) && y >= p(79) && y <= p(82)) {
          [r, g, b] = line; a = 255;
        }
      }
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
    }
  }
  return buf;
}

function downsample(src, srcSize, dstSize) {
  const out = Buffer.alloc(dstSize * dstSize * 4);
  const ratio = srcSize / dstSize;
  for (let y = 0; y < dstSize; y++) {
    for (let x = 0; x < dstSize; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ratio; sy++) {
        for (let sx = 0; sx < ratio; sx++) {
          const i = ((y * ratio + sy) * srcSize + (x * ratio + sx)) * 4;
          r += src[i]; g += src[i + 1]; b += src[i + 2]; a += src[i + 3];
        }
      }
      const n = ratio * ratio;
      const o = (y * dstSize + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const masterSize = 128 * SS;
const master = render(128);

[16, 48, 128].forEach((size) => {
  const rgba = downsample(master, masterSize, size);
  const png = encodePNG(size, size, rgba);
  const file = path.join(OUT_DIR, `icon${size}.png`);
  fs.writeFileSync(file, png);
  console.log("wrote", file, png.length, "bytes");
});
