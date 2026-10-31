// Width/height attributes for an image under src/_includes/img, read from the
// original file, so the browser reserves space before the image loads and the
// page doesn't jump. Used by the `imageSize` shortcode in eleventy.config.cjs.
// Returns "" for external URLs, missing files, or images without dimensions.
const path = require("node:path");
const sharp = require("sharp");

async function imageSize(src, sourceRoot = "src/_includes") {
  if (!src || !String(src).startsWith("/img/")) return "";
  const file = path.join(sourceRoot, String(src).split(/[?#]/)[0]);
  try {
    const { width, height } = await sharp(file).metadata();
    return width && height ? `width="${width}" height="${height}"` : "";
  } catch {
    return "";
  }
}

module.exports = { imageSize };
