// PDF-to-image rendering is not needed in the current architecture.
// Aliyun OCR RecognizeMultiLanguage API accepts PDF files directly
// (via body: fs.createReadStream(pdfPath)), so page-by-page image
// rendering is unnecessary.
// See ocrService.ts for the actual OCR implementation.
