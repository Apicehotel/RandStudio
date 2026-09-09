export function parseCubeLUT(text, name = 'Imported LUT') {
  const lines = String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let size = 0;
  let title = name;
  let domainMin = [0, 0, 0];
  let domainMax = [1, 1, 1];
  const data = [];
  for (const line of lines) {
    if (line.startsWith('#')) continue;
    if (/^TITLE\s+/i.test(line)) { title = line.replace(/^TITLE\s+/i, '').replace(/^"|"$/g, ''); continue; }
    if (/^LUT_3D_SIZE\s+/i.test(line)) { size = Number(line.split(/\s+/).at(-1)); continue; }
    if (/^DOMAIN_MIN\s+/i.test(line)) { domainMin = numbers(line).slice(0, 3); continue; }
    if (/^DOMAIN_MAX\s+/i.test(line)) { domainMax = numbers(line).slice(0, 3); continue; }
    const values = numbers(line);
    if (values.length >= 3) data.push(values.slice(0, 3));
  }
  if (!Number.isInteger(size) || size < 2 || size > 128) throw new Error('LUT_3D_SIZE non valido');
  if (data.length !== size ** 3) throw new Error(`LUT incompleta: attesi ${size ** 3} campioni, trovati ${data.length}`);
  return { schema: 'randstudio.lut/v1', title, size, domainMin, domainMax, data };
}

export function lutToFFmpeg(lutAsset) {
  if (!lutAsset?.virtualName) throw new Error('LUT asset senza virtualName');
  return `lut3d=file='${escapeFilterPath(lutAsset.virtualName)}'`;
}

export function sampleLUT(lut, rgb) {
  const [r, g, b] = rgb.map((value, index) => normalize(value, lut.domainMin[index], lut.domainMax[index]));
  const max = lut.size - 1;
  const xi = Math.round(r * max), yi = Math.round(g * max), zi = Math.round(b * max);
  const index = zi * lut.size * lut.size + yi * lut.size + xi;
  return lut.data[index] ?? rgb;
}

export function applyLUTToImageData(imageData, lut) {
  const data=imageData.data;
  for(let i=0;i<data.length;i+=4){const mapped=sampleLUT(lut,[data[i]/255,data[i+1]/255,data[i+2]/255]);data[i]=Math.round(mapped[0]*255);data[i+1]=Math.round(mapped[1]*255);data[i+2]=Math.round(mapped[2]*255)}
  return imageData;
}

export async function renderLUTToCanvas(source, canvas, lut) {
  const bitmap=await createImageBitmap(source); canvas.width=bitmap.width; canvas.height=bitmap.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true}); ctx.drawImage(bitmap,0,0); bitmap.close?.();
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height); ctx.putImageData(applyLUTToImageData(pixels,lut),0,0); return true;
}

function numbers(line) { return line.split(/\s+/).map(Number).filter(Number.isFinite); }
function normalize(value, min, max) { return Math.max(0, Math.min(1, (value - min) / Math.max(1e-9, max - min))); }
function escapeFilterPath(value) { return String(value).replace(/\\/g, '/').replace(/'/g, "\\'").replace(/:/g, '\\:'); }
