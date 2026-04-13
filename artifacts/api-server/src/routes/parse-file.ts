// File upload + text extraction route
import { Router } from "express";
import multer from "multer";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// pdf-parse and mammoth are CJS-only — use require to avoid ESM interop issues
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;
const mammoth = require("mammoth") as {
  extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string; messages: unknown[] }>;
};

const router = Router();

// Memory storage — files never touch disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter(_req, file, cb) {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and Word documents (.pdf, .docx, .doc) are supported."));
    }
  },
});

// POST /resume/parse-file
// Accepts multipart/form-data with field "file"
// Returns { text: string, wordCount: number, fileName: string, fileType: string }
router.post("/parse-file", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded." });
    return;
  }

  const { originalname, mimetype, buffer } = req.file;

  try {
    let extractedText = "";

    if (mimetype === "application/pdf") {
      const data = await pdfParse(buffer);
      extractedText = data.text;
    } else if (
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimetype === "application/msword"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else {
      res.status(400).json({ error: "Unsupported file type." });
      return;
    }

    // Clean up excessive whitespace while preserving structure
    extractedText = extractedText
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const wordCount = extractedText.split(/\s+/).filter(Boolean).length;

    const fileType = mimetype === "application/pdf" ? "pdf" : "docx";

    res.json({
      text: extractedText,
      wordCount,
      fileName: originalname,
      fileType,
    });
  } catch (err) {
    req.log.error({ err }, "File parsing error");
    res.status(500).json({ error: "Failed to parse the file. Please ensure it is not password-protected and try again." });
  }
});

export default router;
