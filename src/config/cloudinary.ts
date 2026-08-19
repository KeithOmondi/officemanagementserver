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
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase() || '';
    
    // DOCX files are ZIP archives internally - treat as raw
    const isWord  = file.mimetype === "application/msword" || 
                    file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                    ['doc', 'docx'].includes(fileExtension);
    const isExcel = file.mimetype === "application/vnd.ms-excel" ||
                    file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
                    ['xls', 'xlsx'].includes(fileExtension);
    const isPdf   = file.mimetype === "application/pdf" || fileExtension === 'pdf';
    const isVideo = file.mimetype.startsWith("video");
    const isImage = file.mimetype.startsWith("image");

    let resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto';
    
    if (isPdf) {
      resourceType = 'image'; // PDF works as image
    } else if (isVideo) {
      resourceType = 'video';
    } else if (isImage) {
      resourceType = 'image';
    } else {
      // Word, Excel, and everything else - raw
      resourceType = 'raw';
    }

    console.log('📄 Resource type:', resourceType, 'for', file.originalname);

    const options: UploadApiOptions = {
      folder,
      access_mode: "public",
      resource_type: resourceType,
    };

    // Only add transformations for non-raw files
    if (resourceType !== 'raw') {
      if (isPdf) {
        options.format = "pdf";
      } else if (isVideo) {
        options.eager = [{ streaming_profile: "hd", quality: "auto" }];
        options.eager_async = true;
      } else if (isImage && !isPdf) {
        options.transformation = [{ width: 1600, crop: "limit", quality: "auto" }];
      }
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload error:', error);
          return reject(error);
        }
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