// Builds the Word file for the docx sample, with its typed comments anchored to the marked words.
// Open /scripts/docx.html on the Vite dev server (npx vite); it saves the file to put in public/samples/.

import { necklace } from "../src/samples/necklace";
import type { SampleEssay } from "../src/samples/types";

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const esc = (t: string): string => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const run = (t: string): string => `<w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

function documentXml(sample: SampleEssay): string {
  const lines = sample.heading.map((h, i) => `<w:p>${i === sample.heading.length - 1 ? '<w:pPr><w:jc w:val="center"/></w:pPr>' : ""}${run(h)}</w:p>`);
  const paras = (sample.pages[0] ?? []).map((p) => {
    const parts = p.flatMap((s, i) => {
      const lead = i === 0 ? [] : [run(" ")];
      if (typeof s === "string") return [...lead, run(s)];
      return [
        ...lead,
        ...s.map((part) =>
          typeof part === "string"
            ? run(part)
            : `<w:commentRangeStart w:id="${String(part.c)}"/>${run(part.t)}<w:commentRangeEnd w:id="${String(part.c)}"/><w:r><w:commentReference w:id="${String(part.c)}"/></w:r>`,
        ),
      ];
    });
    return `<w:p><w:pPr><w:ind w:firstLine="720"/></w:pPr>${parts.join("")}</w:p>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${[...lines, ...paras].join("")}<w:sectPr/></w:body></w:document>`;
}

function commentsXml(sample: SampleEssay): string {
  const items = sample.comments.map(
    (c) => `<w:comment w:id="${String(c.n)}" w:author="Mr. Hale" w:initials="MH" w:date="2026-11-04T16:00:00Z"><w:p>${run(c.words)}</w:p></w:comment>`,
  );
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments ${NS}>${items.join("")}</w:comments>`;
}

const files: [string, string][] = [
  [
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>',
  ],
  [
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  ],
  [
    "word/_rels/document.xml.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>',
  ],
  ["word/document.xml", documentXml(necklace)],
  ["word/comments.xml", commentsXml(necklace)],
];

// A zip of deflated entries: local headers, then the central directory.
const parts: Uint8Array[] = [];
const central: Uint8Array[] = [];
let offset = 0;
const encoder = new TextEncoder();
for (const [name, text] of files) {
  const raw = encoder.encode(text);
  const packed = await deflateRaw(raw);
  const nameBytes = encoder.encode(name);
  const crc = crc32(raw);
  const local = new DataView(new ArrayBuffer(30));
  local.setUint32(0, 0x04034b50, true);
  local.setUint16(4, 20, true);
  local.setUint16(8, 8, true);
  local.setUint32(14, crc, true);
  local.setUint32(18, packed.length, true);
  local.setUint32(22, raw.length, true);
  local.setUint16(26, nameBytes.length, true);
  const entry = new DataView(new ArrayBuffer(46));
  entry.setUint32(0, 0x02014b50, true);
  entry.setUint16(4, 20, true);
  entry.setUint16(6, 20, true);
  entry.setUint16(10, 8, true);
  entry.setUint32(16, crc, true);
  entry.setUint32(20, packed.length, true);
  entry.setUint32(24, raw.length, true);
  entry.setUint16(28, nameBytes.length, true);
  entry.setUint32(42, offset, true);
  parts.push(new Uint8Array(local.buffer), nameBytes, packed);
  central.push(new Uint8Array(entry.buffer), nameBytes);
  offset += 30 + nameBytes.length + packed.length;
}
const dirLength = central.reduce((n, c) => n + c.length, 0);
const end = new DataView(new ArrayBuffer(22));
end.setUint32(0, 0x06054b50, true);
end.setUint16(8, files.length, true);
end.setUint16(10, files.length, true);
end.setUint32(12, dirLength, true);
end.setUint32(16, offset, true);
const blob = new Blob([...parts, ...central, new Uint8Array(end.buffer)].map((p) => p as BlobPart), { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
const link = document.createElement("a");
link.href = URL.createObjectURL(blob);
link.download = necklace.files[0] ?? "sample.docx";
link.textContent = `Save ${link.download}`;
document.body.appendChild(link);
link.click();
