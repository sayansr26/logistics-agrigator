/**
 * File Upload Middleware
 *
 * Multer configuration for bulk shipment file uploads (CSV/Excel).
 * Uses memory storage so the buffer can be parsed in-process without
 * writing to disk.
 */

const multer = require("multer");
const { ValidationError } = require("../shared/lib/errors");

// Maximum upload size - matches the limit advertised in the UI
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

const ALLOWED_MIME_TYPES = [
  "text/csv",
  "application/csv",
  "text/plain", // some browsers report .csv as text/plain
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream", // some clients (incl. curl) send this
];

/**
 * Accept only CSV/Excel files.
 *
 * Extension is the authoritative check because mime types vary widely
 * across browsers and HTTP clients for these formats.
 */
function fileFilter(req, file, cb) {
  const originalName = file.originalname || "";
  const lastDot = originalName.lastIndexOf(".");
  const extension =
    lastDot === -1 ? "" : originalName.slice(lastDot).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return cb(
      new ValidationError(
        `Unsupported file type "${extension || originalName}". Allowed formats: ${ALLOWED_EXTENSIONS.join(", ")}`,
      ),
    );
  }

  if (file.mimetype && !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new ValidationError(
        `Unsupported content type: ${file.mimetype}. Allowed formats: ${ALLOWED_EXTENSIONS.join(", ")}`,
      ),
    );
  }

  return cb(null, true);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter,
});

/**
 * Translate multer's own errors into the service's standard error shape so
 * they surface as 400s through errorHandler instead of unhandled 500s.
 */
function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(
        new ValidationError(
          `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
        ),
      );
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return next(
        new ValidationError('Unexpected file field. Use the "file" field.'),
      );
    }
    return next(new ValidationError(`File upload failed: ${err.message}`));
  }

  return next(err);
}

/**
 * Single-file upload for the "file" form field, with error normalisation.
 */
const uploadShipmentFile = [upload.single("file"), handleUploadErrors];

module.exports = {
  upload,
  uploadShipmentFile,
  handleUploadErrors,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
};
