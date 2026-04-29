// File upload + text extraction route
import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/requireAuth";
import { createRequire } from "node:module";

// pdf-parse (v1.x) and mammoth are CJS-only — use createRequire so the
// externalized modules resolve correctly at runtime from the bundle location.
const _require = createRequire(import.meta.url);

// pdf-parse v1.x: module.exports is the parse function directly.
// Guard with .default fallback for any bundler-wrapping edge case.
const _pdfMod = _require("pdf-parse");
const pdfParse = (typeof _pdfMod === "function" ? _pdfMod : _pdfMod.default) as (
  buffer: Buffer
) => Promise<{ text: string; numpages: number }>;

// mammoth: module.exports is the mammoth object with extractRawText, etc.
const mammoth = _require("mammoth") as {
  extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string; messages: unknown[] }>;
};

const router = Router();

// Maximum file size accepted (4 MB). Reduces the per-request memory allocation
// ceiling and makes parser-bomb attacks more expensive to sustain.
const MAX_FILE_BYTES = 4 * 1024 * 1024;

// Maximum length of extracted text returned to callers. Prevents a legitimate
// but oversized document from producing an unbounded response and consuming
// excess downstream memory when the text is forwarded to the AI pipeline.
const MAX_EXTRACTED_CHARS = 50_000;

// Maximum page count accepted for PDF documents. pdf-parse must traverse every
// page to extract text; a parser-bomb may embed thousands of blank pages.
const MAX_PDF_PAGES = 50;

// Magic-byte signatures for the file formats we accept.
// These are checked against the actual file content rather than the
// client-supplied MIME type, which is trivially spoofable.
function detectFileType(buf: Buffer): "pdf" | "docx" | null {
  // PDF: starts with "%PDF"
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return "pdf";
  }
  // DOCX/DOC (ZIP-based): starts with PK\x03\x04
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    return "docx";
  }
  return null;
}

// ZIP / DOCX structural safety limits
const ZIP_MAX_ENTRIES = 500;           // legitimate DOCX files have ~10–30 entries
const ZIP_MAX_UNCOMPRESSED = 50 * 1024 * 1024;  // 50 MB total uncompressed
const ZIP_MAX_RATIO = 20;             // compression ratio ceiling (e.g. 4 MB → ≤ 80 MB)

// EOCD (End of Central Directory) signature: PK\x05\x06
const EOCD_SIG = 0x06054b50;
// Central directory entry signature: PK\x01\x02
const CD_SIG = 0x02014b50;

/**
 * validateDocxStructure inspects the ZIP central directory inside `buf` and
 * rejects:
 *   • archives with too many entries (explosion by entry count)
 *   • archives whose total uncompressed size exceeds the ceiling (ZIP bomb)
 *   • archives with a decompression ratio above the ceiling
 *   • archives that are not a valid DOCX (missing [Content_Types].xml /
 *     word/document.xml), preventing arbitrary ZIP payloads from being
 *     processed by mammoth.
 *
 * Returns null on a valid DOCX, or an error string describing the problem.
 */
function validateDocxStructure(buf: Buffer): string | null {
  const len = buf.length;

  // ── 1. Locate End of Central Directory record ──────────────────────────────
  // EOCD is at least 22 bytes and may have a trailing comment (max 65535 bytes).
  // Scan backwards for the EOCD signature from near the end of the buffer.
  const searchStart = Math.max(0, len - 65557); // 22 + 65535
  let eocdOffset = -1;
  for (let i = len - 22; i >= searchStart; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    return "Invalid ZIP: end-of-central-directory record not found";
  }

  // ── 2. Read EOCD fields ────────────────────────────────────────────────────
  if (eocdOffset + 22 > len) {
    return "Invalid ZIP: truncated end-of-central-directory record";
  }
  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdSize      = buf.readUInt32LE(eocdOffset + 12);
  const cdOffset    = buf.readUInt32LE(eocdOffset + 16);

  if (totalEntries > ZIP_MAX_ENTRIES) {
    return `ZIP rejected: too many entries (${totalEntries} > ${ZIP_MAX_ENTRIES})`;
  }
  if (cdOffset + cdSize > len) {
    return "Invalid ZIP: central directory extends beyond file bounds";
  }

  // ── 3. Iterate central directory entries ───────────────────────────────────
  let pos = cdOffset;
  let totalUncompressed = 0;
  let totalCompressed = 0;
  const requiredEntries = new Set(["[content_types].xml", "word/document.xml"]);
  const foundEntries = new Set<string>();

  for (let i = 0; i < totalEntries; i++) {
    if (pos + 46 > len) {
      return "Invalid ZIP: central directory entry truncated";
    }
    if (buf.readUInt32LE(pos) !== CD_SIG) {
      return "Invalid ZIP: unexpected signature in central directory";
    }

    const compressedSize   = buf.readUInt32LE(pos + 20);
    const uncompressedSize = buf.readUInt32LE(pos + 24);
    const fileNameLen      = buf.readUInt16LE(pos + 28);
    const extraLen         = buf.readUInt16LE(pos + 30);
    const commentLen       = buf.readUInt16LE(pos + 32);

    totalCompressed   += compressedSize;
    totalUncompressed += uncompressedSize;

    if (totalUncompressed > ZIP_MAX_UNCOMPRESSED) {
      return `ZIP rejected: total uncompressed size exceeds ${ZIP_MAX_UNCOMPRESSED / (1024 * 1024)} MB`;
    }

    if (pos + 46 + fileNameLen > len) {
      return "Invalid ZIP: file name extends beyond buffer";
    }
    const fileName = buf.toString("utf8", pos + 46, pos + 46 + fileNameLen).toLowerCase();
    foundEntries.add(fileName);

    pos += 46 + fileNameLen + extraLen + commentLen;
  }

  // ── 4. Compression ratio check ─────────────────────────────────────────────
  if (totalCompressed > 0 && totalUncompressed / totalCompressed > ZIP_MAX_RATIO) {
    return `ZIP rejected: compression ratio ${(totalUncompressed / totalCompressed).toFixed(1)}:1 exceeds limit`;
  }

  // ── 5. DOCX structure check ────────────────────────────────────────────────
  for (const required of requiredEntries) {
    if (!foundEntries.has(required)) {
      return `Invalid DOCX: missing required entry "${required}"`;
    }
  }

  return null; // all checks passed
}

// Memory storage — files never touch disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter(_req, file, cb) {
    // Only accept PDF and DOCX (OpenXML). Legacy binary .doc is NOT accepted
    // because it uses a different container format (CFDF) that our magic-byte
    // and ZIP-structure checks cannot validate and mammoth handles poorly.
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and Word documents (.pdf, .docx) are supported."));
    }
  },
});

// POST /resume/parse-file
// Accepts multipart/form-data with field "file" (.pdf or .docx only)
// Returns { text: string, wordCount: number, fileName: string, fileType: string }
router.post("/parse-file", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded." });
    return;
  }

  const { originalname, buffer } = req.file;

  // Validate file content via magic bytes — never trust the client-supplied MIME type.
  const detectedType = detectFileType(buffer);
  if (!detectedType) {
    res.status(400).json({ error: "Only PDF and Word documents (.pdf, .docx) are supported." });
    return;
  }

  try {
    let extractedText = "";

    if (detectedType === "pdf") {
      const data = await pdfParse(buffer);
      // Enforce a page-count ceiling to prevent multi-thousand-page parser bombs.
      if (data.numpages > MAX_PDF_PAGES) {
        res.status(400).json({ error: `PDF must not exceed ${MAX_PDF_PAGES} pages.` });
        return;
      }
      extractedText = data.text;
    } else {
      // Validate the ZIP/DOCX structure before handing to mammoth.
      // This catches ZIP bombs (entry count, uncompressed size, ratio) and
      // ensures the archive is a valid DOCX rather than an arbitrary payload.
      const zipError = validateDocxStructure(buffer);
      if (zipError) {
        res.status(400).json({ error: "The uploaded file is not a valid Word document or failed safety checks." });
        return;
      }
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    }

    // Clean up excessive whitespace while preserving structure
    extractedText = extractedText
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Truncate to a safe maximum so a large document cannot produce an
    // unbounded response body or saturate downstream AI token windows.
    if (extractedText.length > MAX_EXTRACTED_CHARS) {
      extractedText = extractedText.slice(0, MAX_EXTRACTED_CHARS);
    }

    const wordCount = extractedText.split(/\s+/).filter(Boolean).length;

    res.json({
      text: extractedText,
      wordCount,
      fileName: originalname,
      fileType: detectedType,
    });
  } catch (err) {
    req.log.error({ err }, "File parsing error");
    res.status(500).json({ error: "Failed to parse the file. Please ensure it is not password-protected and try again." });
  }
});

export default router;
