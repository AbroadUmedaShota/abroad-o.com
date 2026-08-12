import crypto from 'node:crypto';
import sharp from 'sharp';

export const TOP_IMAGE = Object.freeze({
  pngPath: 'image/top1.png',
  webpPath: 'image/top1.webp',
  pngSha256: '8b29caffce54193e61651229cc7a6478f9536467ee6ff3ea29ee18e26f608436',
  expectedWebpBytes: 340064,
  webpSha256: 'cc2f44e9be8d56a47254a79d8808b31927d07273c89fc0ff9f2b1b2b32e51730',
  width: 1990,
  height: 810,
  webpOptions: Object.freeze({ quality: 90, effort: 6, smartSubsample: true })
});

export function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function assertTopImagePng(pngBuffer, label = TOP_IMAGE.pngPath) {
  const metadata = await sharp(pngBuffer).metadata();
  if (metadata.format !== 'png' || metadata.width !== TOP_IMAGE.width || metadata.height !== TOP_IMAGE.height) {
    throw new Error(`Unexpected top image source dimensions for ${label}: ${metadata.format ?? 'unknown'} ${metadata.width}x${metadata.height}`);
  }
  const actualSha256 = sha256(pngBuffer);
  if (actualSha256 !== TOP_IMAGE.pngSha256) {
    throw new Error(`Unexpected top image source SHA-256 for ${label}: ${actualSha256}`);
  }
}

export async function generateTopImageWebp(pngBuffer) {
  await assertTopImagePng(pngBuffer);
  return sharp(pngBuffer).webp(TOP_IMAGE.webpOptions).toBuffer();
}

export async function assertTopImageWebp(webpBuffer, label = TOP_IMAGE.webpPath) {
  const metadata = await sharp(webpBuffer).metadata();
  if (metadata.format !== 'webp' || metadata.width !== TOP_IMAGE.width || metadata.height !== TOP_IMAGE.height) {
    throw new Error(`Unexpected top image derivative dimensions for ${label}: ${metadata.format ?? 'unknown'} ${metadata.width}x${metadata.height}`);
  }
  if (webpBuffer.length !== TOP_IMAGE.expectedWebpBytes || sha256(webpBuffer) !== TOP_IMAGE.webpSha256) {
    throw new Error(`Unexpected top image derivative bytes or SHA-256 for ${label}`);
  }
}

export async function assertTopImageAlphaMetadata(pngBuffer, webpBuffer) {
  const [pngMetadata, webpMetadata] = await Promise.all([sharp(pngBuffer).metadata(), sharp(webpBuffer).metadata()]);
  if (pngMetadata.hasAlpha !== webpMetadata.hasAlpha) {
    throw new Error(`Top image alpha metadata changed: PNG hasAlpha=${pngMetadata.hasAlpha}, WebP hasAlpha=${webpMetadata.hasAlpha}`);
  }
}

export function assertAlphaDifference(maxAlphaDifference, label = 'top image') {
  if (maxAlphaDifference !== 0) {
    throw new Error(`Alpha channel changed for ${label}: maxAlphaDiff=${maxAlphaDifference}`);
  }
}

function globalSsim(left, right) {
  const pixelCount = left.length;
  let leftMean = 0;
  let rightMean = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    leftMean += left[index];
    rightMean += right[index];
  }
  leftMean /= pixelCount;
  rightMean /= pixelCount;

  let leftVariance = 0;
  let rightVariance = 0;
  let covariance = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    leftVariance += leftDelta * leftDelta;
    rightVariance += rightDelta * rightDelta;
    covariance += leftDelta * rightDelta;
  }
  const denominator = Math.max(1, pixelCount - 1);
  leftVariance /= denominator;
  rightVariance /= denominator;
  covariance /= denominator;
  const c1 = 6.5025;
  const c2 = 58.5225;
  return ((2 * leftMean * rightMean + c1) * (2 * covariance + c2))
    / ((leftMean * leftMean + rightMean * rightMean + c1) * (leftVariance + rightVariance + c2));
}

export async function compareTopImagePixels(pngBuffer, webpBuffer) {
  const [png, webp] = await Promise.all([
    sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(webpBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  ]);
  if (png.info.width !== webp.info.width || png.info.height !== webp.info.height || png.info.channels !== webp.info.channels) {
    throw new Error(`Decoded image dimensions differ: PNG ${png.info.width}x${png.info.height}x${png.info.channels}, WebP ${webp.info.width}x${webp.info.height}x${webp.info.channels}`);
  }
  if (png.info.channels !== 4) throw new Error(`Expected normalized RGBA data, found ${png.info.channels} channels`);
  const pngRgb = Buffer.allocUnsafe((png.data.length / 4) * 3);
  const webpRgb = Buffer.allocUnsafe((webp.data.length / 4) * 3);
  let absoluteDifference = 0;
  let squaredDifference = 0;
  let maxAlphaDifference = 0;
  for (let sourceIndex = 0, rgbIndex = 0; sourceIndex < png.data.length; sourceIndex += 4) {
    for (let channel = 0; channel < 3; channel += 1, rgbIndex += 1) {
      const difference = png.data[sourceIndex + channel] - webp.data[sourceIndex + channel];
      pngRgb[rgbIndex] = png.data[sourceIndex + channel];
      webpRgb[rgbIndex] = webp.data[sourceIndex + channel];
      absoluteDifference += Math.abs(difference);
      squaredDifference += difference * difference;
    }
    maxAlphaDifference = Math.max(maxAlphaDifference, Math.abs(png.data[sourceIndex + 3] - webp.data[sourceIndex + 3]));
  }
  const meanAbsoluteDifference = absoluteDifference / pngRgb.length;
  const meanSquaredError = squaredDifference / pngRgb.length;
  const psnr = meanSquaredError === 0 ? Infinity : 10 * Math.log10((255 * 255) / meanSquaredError);
  return { meanAbsoluteDifference, psnr, globalSsim: globalSsim(pngRgb, webpRgb), maxAlphaDifference };
}

export async function assertTopImageQuality(pngBuffer, webpBuffer) {
  const metrics = await compareTopImagePixels(pngBuffer, webpBuffer);
  // RGB-only quality thresholds; alpha is checked separately to avoid transparent or opaque alpha bytes inflating RGB fidelity.
  if (metrics.meanAbsoluteDifference > 2.7 || metrics.psnr < 36 || metrics.globalSsim < 0.9975) {
    throw new Error(`Top image WebP quality is below contract: meanAbs=${metrics.meanAbsoluteDifference.toFixed(4)}, PSNR=${metrics.psnr.toFixed(4)}, globalSSIM=${metrics.globalSsim.toFixed(6)}`);
  }
  assertAlphaDifference(metrics.maxAlphaDifference);
  return metrics;
}
