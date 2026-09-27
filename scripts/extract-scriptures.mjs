#!/usr/bin/env node
/**
 * Extracts the Scripture passages the app needs from Svenska Kärnbibeln (USX 3.0)
 * and writes src/data/generated/scripture-passages.json.
 *
 * Reads resources/SKB/metadata.xml, resources/SKB/release/USX_1/<BOOK>.usx and
 * the reference list in src/data/scripture-references.js. The source text is
 * licensed separately and is not part of this repository.
 *
 * Annotation markup inside verse boundaries is removed (see cleanExtractedText).
 * Malformed XML, DOCTYPE/external entities, unknown books, out-of-range verses
 * and empty passages abort the build.
 */

import { SaxesParser } from 'saxes';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SKB_DIR = resolve(ROOT, 'resources/SKB');
const USX_DIR = resolve(SKB_DIR, 'release/USX_1');
const OUTPUT_DIR = resolve(ROOT, 'src/data/generated');
const OUTPUT_FILE = resolve(OUTPUT_DIR, 'scripture-passages.json');

// Import references dynamically (ESM)
const refsModule = await import(resolve(ROOT, 'src/data/scripture-references.js'));
const scriptureReferences = refsModule.scriptureReferences;

// ── Parse metadata.xml for book code → Swedish name mapping ──

function parseMetadata() {
  const xml = readFileSync(resolve(SKB_DIR, 'metadata.xml'), 'utf-8');
  if (xml.includes('<!DOCTYPE') || xml.includes('<!ENTITY')) {
    throw new Error('metadata.xml contains DOCTYPE or ENTITY declarations — rejected for security');
  }

  const parser = new SaxesParser();
  const names = {};
  let currentNameId = null;
  let currentTag = null;

  parser.on('opentag', (node) => {
    if (node.name === 'name' && node.attributes.id) {
      currentNameId = node.attributes.id;
      names[currentNameId] = {};
    }
    if (currentNameId && (node.name === 'short' || node.name === 'long' || node.name === 'abbr')) {
      currentTag = node.name;
    }
  });

  parser.on('text', (text) => {
    if (currentNameId && currentTag) {
      names[currentNameId][currentTag] = (names[currentNameId][currentTag] || '') + text;
    }
  });

  parser.on('closetag', (node) => {
    if (node.name === 'name') {
      currentNameId = null;
    }
    if (node.name === 'short' || node.name === 'long' || node.name === 'abbr') {
      currentTag = null;
    }
  });

  parser.write(xml).close();

  // Build code → name map (book-mat → MAT, etc.)
  const codeToName = {};
  for (const [id, parts] of Object.entries(names)) {
    // id is like "book-mat", extract the USX code
    const code = id.replace('book-', '').toUpperCase();
    codeToName[code] = parts.long || parts.short || parts.abbr || code;
  }

  return codeToName;
}

// ── Text cleanup ──

/**
 * Clean extracted verse text.
 *
 * The SKB source marks translator notes, cross-references and alternate
 * renderings with square brackets ("[…]") and parentheses ("(…)"). Both are
 * removed; the plain verse wording is preserved. Removal is followed by
 * whitespace and punctuation tidy-up so sentences do not run together.
 */
function cleanExtractedText(text) {
  let out = String(text);

  // Drop bracketed and parenthesised annotations (notes, cross-references,
  // alternate renderings) entirely.
  out = out.replace(/\[[^\]]*\]/g, ' ');
  out = out.replace(/\([^)]*\)/g, ' ');
  // Any unmatched bracket left behind.
  out = out.replace(/[[\]()]/g, ' ');
  // Tidy punctuation and collapse whitespace.
  out = out.replace(/,\s*([,;:])/g, '$1');
  out = out.replace(/\s+([.,;:!?])/g, '$1');
  out = out.replace(/\s+/g, ' ');

  return out.trim();
}

// ── Parse a single USX file and extract specified verses ──

function extractVersesFromUsx(bookCode, chapter, startVerse, endVerse) {
  const usxPath = resolve(USX_DIR, `${bookCode}.usx`);
  if (!existsSync(usxPath)) {
    throw new Error(`USX file not found: ${usxPath}`);
  }

  const xml = readFileSync(usxPath, 'utf-8');
  if (xml.includes('<!DOCTYPE') || xml.includes('<!ENTITY')) {
    throw new Error(`${bookCode}.usx contains DOCTYPE or ENTITY — rejected`);
  }

  const parser = new SaxesParser();
  let currentChapter = null;
  let currentVerse = null;
  let inVerse = false;
  let inXt = false;
  let xtDepth = 0;
  let textBuffer = '';
  let collectedText = '';
  let verseFound = false;

  parser.on('opentag', (node) => {
    if (node.name === 'chapter' && node.attributes.number) {
      currentChapter = parseInt(node.attributes.number, 10);
    }

    if (node.name === 'verse' && node.attributes.number && node.attributes.sid) {
      const verseNum = parseInt(node.attributes.number, 10);
      if (currentChapter === chapter && verseNum >= startVerse && verseNum <= endVerse) {
        currentVerse = verseNum;
        inVerse = true;
        verseFound = true;
        textBuffer = '';
      }
    }

    if (node.name === 'char' && node.attributes.style === 'xt') {
      inXt = true;
      xtDepth = 1;
    } else if (inXt) {
      xtDepth++;
    }
  });

  parser.on('text', (text) => {
    if (inVerse && !inXt) {
      textBuffer += text;
    }
  });

  parser.on('closetag', (node) => {
    if (inXt) {
      xtDepth--;
      if (xtDepth <= 0) {
        inXt = false;
        xtDepth = 0;
      }
    }

    if (node.name === 'verse' && node.attributes.eid) {
      if (inVerse) {
        // Keep multi-verse requests readable: separate verses with a space.
        if (collectedText && textBuffer && !/\s$/.test(collectedText)) {
          collectedText += ' ';
        }
        collectedText += textBuffer;
        inVerse = false;
        currentVerse = null;
        textBuffer = '';
      }
    }
  });

  parser.write(xml).close();

  if (!verseFound) {
    throw new Error(`Verses ${chapter}:${startVerse}-${endVerse} not found in ${bookCode}.usx`);
  }

  return cleanExtractedText(collectedText);
}

// ── Parse a reference string like "LUK 1:26-38" ──

function parseRef(refStr) {
  const match = refStr.match(/^([A-Z0-9]+)\s+(\d+):(\d+)(?:-(\d+))?$/);
  if (!match) throw new Error(`Invalid reference format: ${refStr}`);
  return {
    book: match[1],
    chapter: parseInt(match[2], 10),
    startVerse: parseInt(match[3], 10),
    endVerse: match[4] ? parseInt(match[4], 10) : parseInt(match[3], 10),
  };
}

// ── Main ──

/**
 * The Scripture source is licensed separately and is not part of this
 * repository, so fail with instructions instead of a raw ENOENT.
 */
function requireSource() {
  if (existsSync(resolve(SKB_DIR, 'metadata.xml'))) return;

  console.error(`
Källan till bibeltexten saknas.

Appen läser utvalda verser ur Svenska Kärnbibeln i USX 3.0-format. Texten är
licensierad separat och ingår inte i repot. Se README, avsnittet
"Skaffa bibeltexten".

Lägg filerna så här och kör om:

  resources/SKB/metadata.xml
  resources/SKB/release/USX_1/<BOKKOD>.usx    (66 böcker)
`);
  process.exit(1);
}

function main() {
  requireSource();

  console.log('Parsing metadata.xml for book names...');
  const codeToName = parseMetadata();

  console.log(`Extracting ${scriptureReferences.length} passages...`);
  const results = {};

  for (const ref of scriptureReferences) {
    const { id, book, chapter, verses } = ref;
    const startVerse = verses[0];
    const endVerse = verses[1] || verses[0];

    console.log(`  ${id}: ${book} ${chapter}:${startVerse}-${endVerse}`);

    const text = extractVersesFromUsx(book, chapter, startVerse, endVerse);

    if (!text) {
      throw new Error(`Empty extraction for ${id}`);
    }

    results[id] = {
      bookCode: book,
      bookName: codeToName[book] || book,
      chapter,
      startVerse,
      endVerse,
      displayRef: `${codeToName[book] || book} ${chapter}:${startVerse}${endVerse !== startVerse ? '-' + endVerse : ''}`,
      text,
    };
  }

  // Write output
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nWrote ${Object.keys(results).length} passages to ${OUTPUT_FILE}`);
}

main();
