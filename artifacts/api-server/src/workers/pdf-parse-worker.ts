import { parentPort, workerData } from "node:worker_threads";
import { createRequire } from "node:module";

console.log("PDF WORKER STARTED");

const _require = createRequire(import.meta.url);

try {
  console.log("Loading pdf-parse...");
  const _pdfMod = _require("pdf-parse");

const pdfParse =
  typeof _pdfMod === "function"
    ? _pdfMod
    : _pdfMod.default;

  console.log("pdf-parse loaded");

  const buffer = Buffer.from(workerData.buffer as ArrayBuffer);

  console.log("Buffer size:", buffer.length);

  const result = await pdfParse(buffer);

  console.log("PDF parsed successfully");

  parentPort?.postMessage({
    ok: true,
    text: result.text,
    numpages: result.numpages,
  });
} catch (err) {
  console.error("PDF WORKER CRASH");
  console.error(err);

  parentPort?.postMessage({
    ok: false,
    error: String(err),
  });
}