/**
 * Worker thread entry point for PDF parsing.
 *
 * Running pdf-parse inside a dedicated Worker lets the main thread enforce a
 * hard wall-clock timeout: if the worker does not respond within the deadline,
 * worker.terminate() is called and the OS immediately reclaims its memory and
 * CPU, ensuring a pathological PDF cannot consume server resources beyond the
 * allowed window.
 */
import { parentPort, workerData } from "node:worker_threads";
import { createRequire } from "node:module";

const _require = createRequire(import.meta.url);

const _pdfMod = _require("pdf-parse");
const pdfParse = (
  typeof _pdfMod === "function" ? _pdfMod : _pdfMod.default
) as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;

const buffer = Buffer.from(workerData.buffer as ArrayBuffer);

try {
  const result = await pdfParse(buffer);
  parentPort?.postMessage({ ok: true, text: result.text, numpages: result.numpages });
} catch (err: unknown) {
  parentPort?.postMessage({ ok: false, error: String(err) });
}
