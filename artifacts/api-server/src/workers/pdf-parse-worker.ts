import { parentPort, workerData } from "node:worker_threads";
import { createRequire } from "node:module";

const _require = createRequire(import.meta.url);

try {
  const _pdfMod = _require("pdf-parse");

  const pdfParse =
    typeof _pdfMod === "function"
      ? _pdfMod
      : _pdfMod.default;

  const buffer = Buffer.from(workerData.buffer as ArrayBuffer);

  const result = await pdfParse(buffer);

  parentPort?.postMessage({
    ok: true,
    text: result.text,
    numpages: result.numpages,
  });
} catch (err) {
  
  

  parentPort?.postMessage({
    ok: false,
    error: String(err),
  });
}
