import crypto from "crypto";

export const generateRandomString = (length = 10) => {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const generateOTP = () => {
  try {
    const otp = crypto.randomInt(100000, 999999).toString();
    return otp;
  } catch (error) {
    throw new Error("Failed to generate OTP.");
  }
};

export const generateS3Key = ({ folder, userId, originalname }) => {
  const trimmedFileName = originalname.replace(/\s+/g, '_');
  const fileExtension = trimmedFileName.split('.').pop();
  const baseName = trimmedFileName.substring(0, trimmedFileName.lastIndexOf('.'));
  const timestamp = Date.now();
  const randomStr = generateRandomString();
  return `${folder}/${userId}_${baseName}_${timestamp}_${randomStr}.${fileExtension}`;
};

