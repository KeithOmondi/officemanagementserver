import multer, { FileFilterCallback } from "multer";
import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/response";

/**
 * memoryStorage is fastest for processing but uses Server RAM.
 * With 50 files @ 55MB, one request could peak at ~2.7GB RAM.
 */
const storage = multer.memoryStorage();

const allowedTypes: Record<string, string[]> = {
  // --- Images ---
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
  "image/svg+xml": ["svg"],
  "image/heic": ["heic"],

  // --- Documents (PDF & Microsoft Office) ---
  "application/pdf": ["pdf"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.ms-excel": ["xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/vnd.ms-powerpoint": ["ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],

  // --- OpenDocument Formats ---
  "application/vnd.oasis.opendocument.text": ["odt"],
  "application/vnd.oasis.opendocument.spreadsheet": ["ods"],
  "application/vnd.oasis.opendocument.presentation": ["odp"],

  // --- Data & Text ---
  "text/plain": ["txt"],
  "text/csv": ["csv"],
  "application/json": ["json"],
  "application/rtf": ["rtf"],
  "text/html": ["html", "htm"],

  // --- Archives ---
  "application/zip": ["zip"],
  "application/x-7z-compressed": ["7z"],
  "application/x-rar-compressed": ["rar"],

  // --- Videos ---
  "video/mp4": ["mp4"],
  "video/mpeg": ["mpeg"],
  "video/quicktime": ["mov"],
  "video/webm": ["webm"],
  "video/x-msvideo": ["avi"],
};

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  if (allowedTypes[file.mimetype]) {
    cb(null, true);
  } else {
    // Fixed: first argument is statusCode (number), second is message (string)
    cb(new AppError(400, "Unsupported file format. Please upload images, PDFs, Docs, or Videos.") as any, false);
  }
};

// 1. Base multer instance
export const upload = multer({
  storage,
  limits: {
    fileSize: 55 * 1024 * 1024, // 55MB per file
    files: 50,                  // Maximum 50 files per request
  },
  fileFilter,
});

/**
 * 2. Pre-configured middleware for bulk uploads.
 * Use this in your route:
 * router.post('/path', uploadBulkEvidence, requireFiles, controller)
 */
export const uploadBulkEvidence = upload.array("documents", 50);

/**
 * 3. Validation middleware to ensure files actually reached the controller
 * Uses type assertion because multer attaches `files` to the request.
 */
export const requireFiles = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  // Cast to access the `files` property added by multer
  const files = (req as any).files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    return next(new AppError(400, "At least one document is required for this submission."));
  }
  next();
};