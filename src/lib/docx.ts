// Word files, read in the browser: a .docx is a zip; its text is word/document.xml and its typed
// comments are word/comments.xml, each anchored to a range of the text. The zip is read with the
// browser's own DecompressionStream, so nothing is uploaded.

import { addPlainWords, pinMarks, type ReadMark, titleOf } from "./build";
import { newId } from "./store";
import { splitSentences } from "./text";
import type { Essay, Paragraph } from "./types";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export class NotAWordFile extends Error {}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// The named files of a zip archive.
export async function unzip(buffer: ArrayBuffer, wanted: readonly string[]): Promise<Map<string, string>> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let end = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new NotAWordFile("That file isn't a Word document. Choose a .docx file.");
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const out = new Map<string, string>();
  const decoder = new TextDecoder();
  for (let k = 0; k < count && at + 46 <= buffer.byteLength; k++) {
    if (view.getUint32(at, true) !== 0x02014b50) break;
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extra = view.getUint16(at + 30, true);
    const comment = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extra + comment;
    if (!wanted.includes(name)) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = bytes.subarray(start, start + size);
    if (method === 0) out.set(name, decoder.decode(raw));
    else if (method === 8) out.set(name, decoder.decode(await inflate(raw)));
    else throw new NotAWordFile("This Word file is packed in a way the browser can't open. Save it again from Word or Google Docs.");
  }
  return out;
}

interface Anchor {
  id: string;
  paragraph: number;
  start: number;
  end: number;
}

// Paragraph texts and where each comment's range starts and ends in them.
export function parseDocument(xml: string): { paragraphs: string[]; anchors: Anchor[] } {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const paragraphs: string[] = [];
  const open = new Map<string, { paragraph: number; start: number }>();
  const anchors: Anchor[] = [];
  for (const p of doc.getElementsByTagNameNS(W, "p")) {
    let text = "";
    const index = paragraphs.length;
    const push = (s: string): void => {
      for (const ch of s.replace(/\s/g, " ")) {
        if (ch === " " && (text === "" || text.endsWith(" "))) continue;
        text += ch;
      }
    };
    const walker = doc.createTreeWalker(p, NodeFilter.SHOW_ELEMENT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const el = node as Element;
      if (el.namespaceURI !== W) continue;
      const id = el.getAttributeNS(W, "id") ?? "";
      if (el.localName === "t") push(el.textContent);
      else if (el.localName === "tab" || el.localName === "br") push(" ");
      else if (el.localName === "commentRangeStart") open.set(id, { paragraph: index, start: text.length });
      else if (el.localName === "commentRangeEnd" || (el.localName === "commentReference" && !anchors.some((a) => a.id === id))) {
        const from = open.get(id);
        if (el.localName === "commentReference" && from === undefined) anchors.push({ id, paragraph: index, start: text.length, end: text.length });
        else if (from !== undefined && !anchors.some((a) => a.id === id)) {
          anchors.push({ id, paragraph: from.paragraph, start: from.start, end: from.paragraph === index ? text.length : Number.MAX_SAFE_INTEGER });
        }
      }
    }
    paragraphs.push(text.trimEnd());
  }
  return { paragraphs, anchors };
}

export function parseComments(xml: string): Map<string, string> {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const out = new Map<string, string>();
  for (const c of doc.getElementsByTagNameNS(W, "comment")) {
    const paras = [...c.getElementsByTagNameNS(W, "p")].map((p) => [...p.getElementsByTagNameNS(W, "t")].map((t) => t.textContent).join(""));
    out.set(c.getAttributeNS(W, "id") ?? "", paras.join(" ").replace(/\s+/g, " ").trim());
  }
  return out;
}

// Paragraphs of sentences, plus each comment pinned to the sentence its range starts in.
export function docxEssayParts(documentXml: string, commentsXml: string): { paragraphs: Paragraph[]; read: ReadMark[] } {
  const { paragraphs: texts, anchors } = parseDocument(documentXml);
  const comments = parseComments(commentsXml);
  const paragraphs: Paragraph[] = [];
  const read: ReadMark[] = [];
  let next = 0;
  texts.forEach((text, pi) => {
    if (text.trim() === "") return;
    const heading = text.length < 60 && !/[.!?]["”]?$/.test(text);
    const parts = heading ? [text.trim()] : splitSentences(text);
    let cursor = 0;
    const placed = parts.map((t) => {
      const start = text.indexOf(t, cursor);
      cursor = start < 0 ? cursor : start + t.length;
      return { id: `s${String(next++)}`, text: t, start: Math.max(0, start), page: 1 };
    });
    paragraphs.push({ heading, sentences: placed.map(({ id, text: t, page }) => ({ id, text: t, page })) });
    for (const a of anchors.filter((x) => x.paragraph === pi)) {
      const words = comments.get(a.id);
      if (words === undefined || words === "") continue;
      const s = [...placed].reverse().find((x) => x.start <= a.start) ?? placed[0];
      if (s === undefined) continue;
      const near = text.slice(a.start, Math.min(a.end, s.start + s.text.length)).trim();
      read.push({ words, kind: "comment", near, page: 1, sentenceId: s.id });
    }
  });
  return { paragraphs, read };
}

export async function readWordFile(file: File): Promise<Essay> {
  const files = await unzip(await file.arrayBuffer(), ["word/document.xml", "word/comments.xml"]);
  const documentXml = files.get("word/document.xml");
  if (documentXml === undefined) throw new NotAWordFile("That file isn't a Word document. Choose a .docx file.");
  const commentsXml = files.get("word/comments.xml");
  const { paragraphs, read } = docxEssayParts(documentXml, commentsXml ?? "<w:comments xmlns:w=\"" + W + "\"/>");
  if (read.length === 0) throw new NotAWordFile("This Word file has no comments in it. Scan photos of the marked printout instead, or check you downloaded the commented copy.");
  const marks = await addPlainWords(paragraphs, pinMarks(paragraphs, read));
  return { id: newId(), title: titleOf(paragraphs), source: "docx", paragraphs, marks, rounds: [], createdAt: new Date().toISOString() };
}
