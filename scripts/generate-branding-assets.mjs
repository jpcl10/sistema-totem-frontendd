import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const brandingDir = path.join(root, "public", "branding");
const publicDir = path.join(root, "public");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function pngFiles() {
  const entries = await fs.readdir(brandingDir);
  return entries
    .filter((name) => name.toLowerCase().endsWith(".png"))
    .map((name) => path.join(brandingDir, name));
}

async function imageInfo(file) {
  const meta = await sharp(file).metadata();
  const stat = await fs.stat(file);
  return {
    file,
    name: path.basename(file),
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    size: stat.size,
  };
}

async function pickSources() {
  const sourceFiles = (await pngFiles()).filter((file) => {
    const name = path.basename(file);
    return ![
      "login-hero-desktop.png",
      "login-hero-mobile.png",
      "icon-1024.png",
      "maskable-icon-1024.png",
    ].includes(name);
  });
  const infos = await Promise.all(sourceFiles.map(imageInfo));
  const desktop = infos.find((item) => item.width > item.height && item.width >= 1400);
  const mobile = infos.find((item) => item.height > item.width && item.height >= 1400);
  const square = infos.filter((item) => item.width === item.height);

  if (!desktop || !mobile || square.length < 2) {
    throw new Error("Não foi possível identificar hero desktop, hero mobile e ícones em public/branding.");
  }

  const [icon, maskableIcon] = square.sort((a, b) => a.size - b.size);
  return { desktop, mobile, icon, maskableIcon };
}

async function writeOfficialPng(input, output, options = {}) {
  const image = sharp(input);
  const pipeline = options.resize
    ? image.resize(options.resize.width, options.resize.height, {
        fit: options.resize.fit ?? "cover",
        position: options.resize.position ?? "center",
      })
    : image;
  await pipeline.png({ compressionLevel: 9 }).toFile(path.join(brandingDir, output));
}

async function writeWebp(input, output, quality) {
  await sharp(input)
    .webp({ quality, effort: 6 })
    .toFile(path.join(brandingDir, output));
}

async function writeIcon(input, output, size) {
  await sharp(input)
    .resize(size, size, { fit: "cover", position: "center" })
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicDir, output));
}

async function writeIcoFromPngs(entries, output) {
  const images = await Promise.all(
    entries.map(async ({ file, size }) => ({
      size,
      buffer: await fs.readFile(path.join(publicDir, file)),
    })),
  );
  const headerSize = 6;
  const entrySize = 16;
  let offset = headerSize + images.length * entrySize;
  const buffers = [];
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  buffers.push(header);

  for (const image of images) {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(image.size >= 256 ? 0 : image.size, 0);
    entry.writeUInt8(image.size >= 256 ? 0 : image.size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    buffers.push(entry);
    offset += image.buffer.length;
  }

  for (const image of images) {
    buffers.push(image.buffer);
  }

  await fs.writeFile(path.join(publicDir, output), Buffer.concat(buffers));
}

async function main() {
  await ensureDir(brandingDir);

  const sources = await pickSources();

  await writeOfficialPng(sources.desktop.file, "login-hero-desktop.png");
  await writeOfficialPng(sources.mobile.file, "login-hero-mobile.png");
  await writeOfficialPng(sources.icon.file, "icon-1024.png", {
    resize: { width: 1024, height: 1024, fit: "cover" },
  });
  await writeOfficialPng(sources.maskableIcon.file, "maskable-icon-1024.png", {
    resize: { width: 1024, height: 1024, fit: "cover" },
  });

  await writeWebp(path.join(brandingDir, "login-hero-desktop.png"), "login-hero-desktop.webp", 82);
  await writeWebp(path.join(brandingDir, "login-hero-mobile.png"), "login-hero-mobile.webp", 82);

  await writeIcon(path.join(brandingDir, "icon-1024.png"), "favicon-16x16.png", 16);
  await writeIcon(path.join(brandingDir, "icon-1024.png"), "favicon-32x32.png", 32);
  await writeIcon(path.join(brandingDir, "icon-1024.png"), "favicon-48x48.png", 48);
  await writeIcon(path.join(brandingDir, "icon-1024.png"), "apple-touch-icon.png", 180);
  await writeIcon(path.join(brandingDir, "icon-1024.png"), "pwa-192x192.png", 192);
  await writeIcon(path.join(brandingDir, "icon-1024.png"), "pwa-512x512.png", 512);
  await writeIcon(path.join(brandingDir, "maskable-icon-1024.png"), "pwa-maskable-512x512.png", 512);
  await writeIcoFromPngs([
    { file: "favicon-16x16.png", size: 16 },
    { file: "favicon-32x32.png", size: 32 },
    { file: "favicon-48x48.png", size: 48 },
  ], "favicon.ico");

  console.log("Branding assets generated.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
