/**
 * File Upload Middleware
 *
 * Multer configuration for handling file uploads, specifically for Excel imports.
 * Validates file type and size before processing.
 */

const multer = require("multer");
const logger = require("../shared/lib/logger");

// Allowed file types for import
const ALLOWED_FILE_TYPES = {
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
};

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Storage configuration (memory storage for immediate processing)
const storage = multer.memoryStorage();

// File filter to validate Excel files
const fileFilter = (req, file, cb) => {
  logger.info("File upload received", {
    originalname: file.originalname,
    mimetype: file.mimetype,
  });

  // Check if file type is allowed
  if (ALLOWED_FILE_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    logger.warn("Invalid file type for upload", {
      originalname: file.originalname,
      mimetype: file.mimetype,
      allowedTypes: Object.keys(ALLOWED_FILE_TYPES),
    });
    cb(
      new Error(
        `Invalid file type. Only Excel files (.xlsx, .xls) are allowed. Received: ${file.mimetype}`,
      ),
      false,
    );
  }
};

// Multer upload configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

// Error handler middleware for multer errors
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    logger.error("Multer upload error", {
      code: err.code,
      field: err.field,
    });

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        status: "error",
        message: `File size exceeds limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        code: "FILE_TOO_LARGE",
      });
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        status: "error",
        message: "Unexpected file field",
        code: "UNEXPECTED_FIELD",
      });
    }

    return res.status(400).json({
      status: "error",
      message: err.message,
      code: "UPLOAD_ERROR",
    });
  }

  if (err) {
    logger.error("File upload error", {
      error: err.message,
      stack: err.stack,
    });

    return res.status(400).json({
      status: "error",
      message: err.message,
      code: "UPLOAD_ERROR",
    });
  }

  next();
};

// Single file upload middleware
const uploadSingle = (fieldName = "file") => {
  return (req, res, next) => {
    const uploadHandler = upload.single(fieldName);

    uploadHandler(req, res, (err) => {
      if (err) {
        return handleUploadError(err, req, res, next);
      }
      next();
    });
  };
};

module.exports = {
  upload,
  uploadSingle,
  handleUploadError,
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES,
};
