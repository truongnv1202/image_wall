/**
 * Chạy: npx tsx scripts/debug-wall-mask.ts
 * In max pixel mask sau khi Sharp rasterize SVG (kiểm tra chữ có vẽ không).
 */
import { readFile } from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";

import sharp from "sharp";

const outW = 1920;
const outH = 1080;
const phrase = "HÒA BÌNH\nĐẸP LẮM";
const lines = phrase.split(/\n/).map((s) => s.trim()).filter(Boolean);
const fontSize = 120;

function svg(fontFaceCss: string | null): string {
  const fontStack =
    "'WallCompositeMask', 'DejaVu Sans', 'Liberation Sans', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif";
  const defs = fontFaceCss
    ? `<defs><style type="text/css"><![CDATA[${fontFaceCss}]]></style></defs>`
    : "";
  const texts = lines.map((line, i) => {
    const y = 540 + i * fontSize * 1.12;
    return `<text x="960" y="${y}" fill="white" text-anchor="middle" font-size="${fontSize}" font-weight="700" font-family="${fontStack}">${line}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}">
${defs}<rect width="100%" height="100%" fill="black"/>${texts.join("")}</svg>`;
}

async function maxOfMask(svgStr: string): Promise<number> {
  const { data } = await sharp(Buffer.from(svgStr, "utf8"), { density: 150 })
    .resize(outW, outH)
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let max = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i]! > max) max = data[i]!;
  }
  return max;
}

async function main() {
  const ttf = path.join(process.cwd(), "public", "fonts", "wall-composite", "NotoSans-Bold.ttf");
  const buf = await readFile(ttf);
  const b64 = buf.toString("base64");
  const dataCss = `@font-face{font-family:'WallCompositeMask';src:url('data:font/ttf;charset=utf-8;base64,${b64}') format('truetype');font-weight:700;font-style:normal;}`;
  const fileUrl = pathToFileURL(ttf).href.replace(/'/g, "%27");
  const fileCss = `@font-face{font-family:'WallCompositeMask';src:url('${fileUrl}') format('truetype');font-weight:700;font-style:normal;}`;

  const m0 = await maxOfMask(svg(null));
  const m1 = await maxOfMask(svg(dataCss));
  const m2 = await maxOfMask(svg(fileCss));

  console.log({ noFontFace: m0, dataUri: m1, fileUrl: m2 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
