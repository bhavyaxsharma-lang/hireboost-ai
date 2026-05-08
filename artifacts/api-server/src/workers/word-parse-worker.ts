/**
 * Worker thread entry point for Word document parsing (.docx / .doc).
 *
 * Running mammoth inside a dedicated Worker lets the main thread enforce a
 * hard wall-clock timeout: if the worker does not respond within the deadline,
 * worker.terminate() is called and the OS immediately reclaims its memory and
 * CPU, ensuring a pathological Word document cannot consume server resources
 * beyond the allowed window.
 */
import { parentPort, workerData } from "node:worker_threads";
import { createRequire } from "node:module";

const _require = createRequire(import.meta.url);

const mammoth = _require("mammoth") as {
  extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string; messages: unknown[] }>;
};

const buffer = Buffer.from(workerData.buffer as ArrayBuffer);

try {
  const result = await mammoth.extractRawText({ buffer });
  parentPort?.postMessage({ ok: true, text: result.value });
} catch (err: unknown) {
  parentPort?.postMessage({ ok: false, error: String(err) });
}
