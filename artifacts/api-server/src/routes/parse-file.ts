// File upload + text extraction route
import { Router } from "express";
import fs from "node:fs";
import multer from "multer";
import { Worker } from "node:worker_threads";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireAuth } from "../middleware/requireAuth";
// Path to the compiled PDF worker bundle.  The worker is a separate esbuild
// entry point so it runs in an isolated Node.js Worker thread and can be
// hard-terminated on timeout — releasing all CPU and memory immediately.
const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));

const PDF_WORKER_PATH = new URL(
  "../workers/pdf-parse-worker.mjs",
  import.meta.url
);

const WORD_WORKER_PATH = new URL(
  "../workers/word-parse-worker.mjs",
  import.meta.url
);



console.log("=================================");
console.log("PARSE FILE STARTUP DIAGNOSTICS");
console.log("CURRENT_DIR =", CURRENT_DIR);

console.log(
  "PDF PATH =",
  fileURLToPath(PDF_WORKER_PATH)
);

console.log(
  "PDF EXISTS =",
  fs.existsSync(fileURLToPath(PDF_WORKER_PATH))
);

console.log(
  "WORD PATH =",
  fileURLToPath(WORD_WORKER_PATH)
);

console.log(
  "WORD EXISTS =",
  fs.existsSync(fileURLToPath(WORD_WORKER_PATH))
);

console.log("=================================");



// Hard wall-clock limit for a single PDF parse.  If pdf-parse has not
// responded within this window the Worker is terminated unconditionally,
// reclaiming its memory and CPU regardless of what the PDF contains.
// Configurable via PDF_PARSE_TIMEOUT_MS env var for production tuning
// (e.g. larger instances may allow a longer window without risk).
// NOTE: This is a containment / defense-in-depth strategy.  The page-count
// guard (MAX_PDF_PAGES) still runs after the worker returns, but the primary
// protection against resource exhaustion is the hard per-parse timeout —
// it bounds CPU and memory burn for any pathological PDF regardless of page
// structure or compression encoding.
const PDF_PARSE_TIMEOUT_MS = parseInt(
  process.env["PDF_PARSE_TIMEOUT_MS"] ?? "10000",
  10
);

// Hard wall-clock limit for a single Word document parse.  Configurable via
// WORD_PARSE_TIMEOUT_MS env var for production tuning.
const WORD_PARSE_TIMEOUT_MS = parseInt(
  process.env["WORD_PARSE_TIMEOUT_MS"] ?? "15000",
  10
);

/**
 * Parse a PDF buffer in a dedicated Worker thread.
 *
 * Spawning a Worker means the main event loop is never blocked, and —
 * crucially — calling worker.terminate() will forcibly destroy the thread and
 * free all its resources.  This makes the timeout a true hard limit rather
 * than a best-effort Promise.race that leaves background work running.
 */
function pdfParseInWorker(
  buf: Buffer
): Promise<{ text: string; numpages: number }> {
  return new Promise((resolve, reject) => {
    // Transfer ownership of the underlying ArrayBuffer to the worker
    // (zero-copy).  After transfer, `buf` must not be accessed here.
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

    console.log("Starting PDF worker:", PDF_WORKER_PATH);

const worker = new Worker(PDF_WORKER_PATH, {
  workerData: { buffer: ab },
  transferList: [ab as ArrayBuffer],
});

worker.on("online", () => {
  console.log("PDF worker online");
});

    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error("PDF parsing timed out"));
    }, PDF_PARSE_TIMEOUT_MS);

    worker.on("message", (msg: { ok: boolean; text?: string; numpages?: number; error?: string }) => {
      clearTimeout(timer);
      void worker.terminate();
      if (msg.ok) {
        resolve({ text: msg.text ?? "", numpages: msg.numpages ?? 0 });
      } else {
        reject(new Error(msg.error ?? "PDF parsing failed"));
      }
    });

  worker.on("error", (err) => {
  console.error("PDF WORKER ERROR");
  console.error(err);
  console.error("MESSAGE:", err?.message);
  console.error("STACK:", err?.stack);

  clearTimeout(timer);
  reject(err);
});
  });
}

/**
 * Parse a Word document buffer (.docx or .doc) in a dedicated Worker thread.
 *
 * Mirrors pdfParseInWorker: the main event loop is never blocked, and
 * worker.terminate() enforces a true hard timeout so a pathological document
 * cannot consume server resources beyond the allowed window.
 */
function wordParseInWorker(buf: Buffer): Promise<{ text: string }> {
  return new Promise((resolve, reject) => {
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

   const worker = new Worker(WORD_WORKER_PATH, {
  workerData: { buffer: ab },
  transferList: [ab as ArrayBuffer],
});

    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error("Word parsing timed out"));
    }, WORD_PARSE_TIMEOUT_MS);

    worker.on("message", (msg: { ok: boolean; text?: string; error?: string }) => {
      clearTimeout(timer);
      void worker.terminate();
      if (msg.ok) {
        resolve({ text: msg.text ?? "" });
      } else {
        reject(new Error(msg.error ?? "Word parsing failed"));
      }
    });

 worker.on("error", (err) => {
  console.error(" WORD WORKER ERROR");
  console.error(err);
  console.error("MESSAGE:", err?.message);
  console.error("STACK:", err?.stack);

  clearTimeout(timer);
  reject(err);
});
  });
}

const router = Router();

// Maximum file size accepted (10 MB).
const MAX_FILE_BYTES = 10 * 1024 * 1024;

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
function detectFileType(buf: Buffer): "pdf" | "docx" | "doc" | null {
  // PDF: starts with "%PDF"
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return "pdf";
  }
  // DOCX (ZIP-based): starts with PK\x03\x04
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    return "docx";
  }
  // DOC (Compound File Binary Format): starts with D0 CF 11 E0 A1 B1 1A E1
  if (
    buf.length >= 8 &&
    buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0 &&
    buf[4] === 0xa1 && buf[5] === 0xb1 && buf[6] === 0x1a && buf[7] === 0xe1
  ) {
    return "doc";
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
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    const nameOk = /\.(pdf|docx|doc)$/i.test(file.originalname);
    if (allowed.includes(file.mimetype) || nameOk) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and Word documents (.pdf, .docx, .doc) are supported."));
    }
  },
});

// POST /resume/parse-file
// Accepts multipart/form-data with field "file" (.pdf or .docx only)
// Returns { text: string, wordCount: number, fileName: string, fileType: string }
router.post("/parse-file", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: `File is too large. Maximum allowed size is ${MAX_FILE_BYTES / (1024 * 1024)} MB.` });
        return;
      }
      res.status(400).json({ error: err instanceof Error ? err.message : "File upload failed." });
      return;
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded." });
    return;
  }

  const { originalname, buffer } = req.file;

  // Validate file content via magic bytes — never trust the client-supplied MIME type.
  const detectedType = detectFileType(buffer);
  if (!detectedType) {
    res.status(400).json({ error: "Only PDF and Word documents (.pdf, .docx, .doc) are supported." });
    return;
  }

  try {
    let extractedText = "";

    if (detectedType === "pdf") {
      let data: { text: string; numpages: number };
      try {
        data = await pdfParseInWorker(buffer);
      } catch (workerErr: unknown) {
        const msg = workerErr instanceof Error ? workerErr.message : String(workerErr);
        if (msg === "PDF parsing timed out") {
          res.status(400).json({ error: "PDF processing exceeded the time limit. Please upload a simpler document." });
          return;
        }
        throw workerErr;
      }
      if (data.numpages > MAX_PDF_PAGES) {
        res.status(400).json({ error: `PDF must not exceed ${MAX_PDF_PAGES} pages.` });
        return;
      }
      extractedText = data.text;
    } else if (detectedType === "docx") {
      // Validate the ZIP/DOCX structure before handing to mammoth.
      // This catches ZIP bombs (entry count, uncompressed size, ratio) and
      // ensures the archive is a valid DOCX rather than an arbitrary payload.
      const zipError = validateDocxStructure(buffer);
      if (zipError) {
        res.status(400).json({ error: "The uploaded file is not a valid Word document or failed safety checks." });
        return;
      }
      let wordData: { text: string };
      try {
        wordData = await wordParseInWorker(buffer);
      } catch (workerErr: unknown) {
        const msg = workerErr instanceof Error ? workerErr.message : String(workerErr);
        if (msg === "Word parsing timed out") {
          res.status(400).json({ error: "Word document processing exceeded the time limit. Please upload a simpler document." });
          return;
        }
        throw workerErr;
      }
      extractedText = wordData.text;
    } else {
      // Legacy .doc (Compound File Binary Format) — parsed in worker thread
      // with a hard timeout to prevent main-loop blocking.
      let wordData: { text: string };
      try {
        wordData = await wordParseInWorker(buffer);
      } catch (workerErr: unknown) {
        const msg = workerErr instanceof Error ? workerErr.message : String(workerErr);
        if (msg === "Word parsing timed out") {
          res.status(400).json({ error: "Word document processing exceeded the time limit. Please upload a simpler document." });
          return;
        }
        throw workerErr;
      }
      extractedText = wordData.text;
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
} catch (err: any) {
  console.error("========== PARSE FILE ERROR ==========");
  console.error(err);
  console.error("MESSAGE:", err?.message);
  console.error("STACK:", err?.stack);

  req.log.error({ err }, "File parsing error");

  res.status(500).json({
    error: err?.message || "Failed to parse file"
  });
}
});
export default router;
