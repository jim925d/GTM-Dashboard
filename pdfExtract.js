/**
 * Extract raw text from a PDF file in the browser using pdfjs-dist.
 * Used for playbook PDF upload before sending text to the extraction API.
 */

let workerInitialized = false;

async function ensureWorker() {
  if (workerInitialized) return;
  const pdfjsLib = await import("pdfjs-dist");
  if (typeof window !== "undefined" && pdfjsLib.GlobalWorkerOptions) {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).href;
    } catch {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || "4.0.0"}/pdf.worker.min.mjs`;
    }
    workerInitialized = true;
  }
}

/**
 * @param {File} file - PDF file from input
 * @returns {Promise<string>} Full text extracted from all pages
 */
export async function extractTextFromPdfFile(file) {
  await ensureWorker();
  const pdfjsLib = await import("pdfjs-dist");
  const arrayBuffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = doc.numPages;
  const parts = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = (content.items || []).map((item) => item.str || "").join(" ");
    parts.push(text);
  }
  return parts.join("\n\n").replace(/\s+/g, " ").trim();
}
