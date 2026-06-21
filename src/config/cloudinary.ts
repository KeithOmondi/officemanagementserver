import { v2 as cloudinary, UploadApiResponse, UploadApiOptions } from "cloudinary";
import { env } from "./env";
import { Readable } from "stream";
import pLimit from "p-limit";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Limit concurrent uploads to 10 to manage network congestion
const limit = pLimit(10);

export const uploadToCloudinary = (
  file: Express.Multer.File,
  folder: string
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const isVideo = file.mimetype.startsWith("video");
    const isImage = file.mimetype.startsWith("image");
    const isPdf   = file.mimetype === "application/pdf";

    const options: UploadApiOptions = {
      folder,
      access_mode: "public",
      // PDFs must use resource_type "image" so Cloudinary serves them
      // inline (with Content-Disposition: inline) instead of as raw
      // attachments that force a browser download.
      resource_type: isPdf ? "image" : "auto",
    };

    if (isPdf) {
      // Request a page-1 preview thumbnail while we're at it (optional but useful)
      options.format = "pdf";
    } else if (isVideo) {
      options.eager       = [{ streaming_profile: "hd", quality: "auto" }];
      options.eager_async = true;
    } else if (isImage) {
      options.transformation = [{ width: 1600, crop: "limit", quality: "auto" }];
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("Upload failed: No result from Cloudinary"));
        resolve(result);
      }
    );

    Readable.from(file.buffer).pipe(uploadStream);
  });
};

export const uploadMultipleToCloudinary = async (
  files: Express.Multer.File[],
  folder: string
): Promise<UploadApiResponse[]> => {
  const uploadPromises = files.map((file) =>
    limit(() => uploadToCloudinary(file, folder))
  );
  return Promise.all(uploadPromises);
};

export const deleteFromCloudinary = (publicId: string, resourceType: "image" | "video" | "raw" = "image"): Promise<void> => {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType }).then(() => undefined);
};

export { cloudinary };