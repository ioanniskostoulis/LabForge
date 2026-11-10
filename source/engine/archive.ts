import * as fs from "node:fs";
import * as path from "node:path";
import { deflateRawSync, inflateRawSync } from "node:zlib";

// ZIP is used without an added runtime dependency so the same project opens on macOS and Windows.
const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function isZip(file: string): boolean {
  const handle = fs.openSync(file, "r");
  try { const head = Buffer.alloc(4); return fs.readSync(handle, head, 0, 4, 0) === 4 && head.readUInt32LE(0) === 0x04034b50; }
  finally { fs.closeSync(handle); }
}

function projectFiles(root: string): { name: string; bytes: Buffer; directory: boolean }[] {
  const files: { name: string; bytes: Buffer; directory: boolean }[] = [];
  const visit = (directory: string) => {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, item.name);
      // Intermediates are kept, hidden, under .build/ (latexmk reuses them); stray ones elsewhere are left out.
      const inBuild = path.relative(root, full).split(path.sep)[0] === ".build";
      if (item.name === ".DS_Store" || (!inBuild && /\.(aux|log|bcf|blg|bbl|fls|fdb_latexmk|synctex\.gz|run\.xml|xdv)$/.test(item.name))) continue;
      if (item.isSymbolicLink()) continue;
      if (item.isDirectory()) {
        files.push({ name: `${path.relative(root, full).split(path.sep).join("/")}/`, bytes: Buffer.alloc(0), directory: true });
        visit(full);
      }
      else if (item.isFile()) files.push({ name: path.relative(root, full).split(path.sep).join("/"), bytes: fs.readFileSync(full), directory: false });
    }
  };
  visit(root);
  return files;
}

export function archiveBytes(root: string): Buffer {
  const parts: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;
  const files = projectFiles(root);
  if (files.length > 10_000) throw new Error("The project has too many files for one .lfg archive.");
  for (const { name, bytes, directory: isDirectory } of files) {
    const filename = Buffer.from(name, "utf8");
    const compressed = isDirectory ? bytes : deflateRawSync(bytes);
    const payload = compressed.length < bytes.length ? compressed : bytes;
    const method = payload === bytes ? 0 : 8;
    const crc = crc32(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(method, 8); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(filename.length, 26);
    parts.push(local, filename, payload);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8); central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(payload.length, 20); central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
    directory.push(central, filename);
    offset += local.length + filename.length + payload.length;
  }
  const centralBytes = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBytes.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, centralBytes, end]);
}

export function saveArchive(root: string, destination: string): void {
  const temp = `${destination}.tmp`;
  fs.writeFileSync(temp, archiveBytes(root));
  fs.renameSync(temp, destination);
}

export function extractArchive(file: string, destination: string): void {
  const bytes = fs.readFileSync(file);
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0 || end + 22 > bytes.length) throw new Error("This .lfg file is not a valid ZIP archive.");
  const count = bytes.readUInt16LE(end + 10);
  if (count > 10_000) throw new Error("The project contains too many files.");
  let offset = bytes.readUInt32LE(end + 16);
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error("The project archive is damaged.");
    const flags = bytes.readUInt16LE(offset + 8);
    const method = bytes.readUInt16LE(offset + 10);
    const crc = bytes.readUInt32LE(offset + 16);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const size = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    offset += 46 + nameLength + extraLength + commentLength;
    if (!(flags & 0x800) || (flags & 1) || ![0, 8].includes(method)) throw new Error("This .lfg archive uses an unsupported ZIP feature.");
    if (!name || name.startsWith("/") || name.includes("\\") || name.includes(":") || name.split("/").some(part => part === ".." || part === ".")) throw new Error("The project archive contains an unsafe path.");
    if (name.endsWith("/")) { fs.mkdirSync(path.join(destination, ...name.split("/").filter(Boolean)), { recursive: true }); continue; }
    total += size;
    if (total > 512 * 1024 * 1024 || size > 256 * 1024 * 1024) throw new Error("The project archive is too large to open safely.");
    if (localOffset + 30 > bytes.length || bytes.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("The project archive is damaged.");
    const start = localOffset + 30 + bytes.readUInt16LE(localOffset + 26) + bytes.readUInt16LE(localOffset + 28);
    const data = bytes.subarray(start, start + compressedSize);
    if (data.length !== compressedSize) throw new Error("The project archive is incomplete.");
    const output = method === 8 ? inflateRawSync(data, { maxOutputLength: size }) : data;
    if (output.length !== size || crc32(output) !== crc) throw new Error(`The project file ${name} is damaged.`);
    const target = path.join(destination, ...name.split("/"));
    if (!target.startsWith(path.resolve(destination) + path.sep)) throw new Error("The project archive contains an unsafe path.");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, output);
  }
}
