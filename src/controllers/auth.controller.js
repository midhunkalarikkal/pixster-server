import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';
import nodemailer from "nodemailer";
import { redis } from "../lib/redis.js";
import User from "../models/user.model.js";
import { Upload } from "@aws-sdk/lib-storage";
import { generateToken } from "../lib/utils.js";
import { generateOTP, generateS3Key } from "../utils/helper.js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { generateSignedUrl, s3Client } from "../utils/aws.config.js";
import {
  validateEmail,
  validateFullName,
  validatePassword,
  validateUsername,
} from "../utils/validator.js";
import { 
  emailVerifiedTemplateFirst, 
  otpEmailTemplateFirst, 
  otpEmailTemplateLast 
} from "../utils/constants.js";

export const signup = async (req, res) => {
  try {
    const { fullName, userName, email, password } = req.body;

    const fullNameError = validateFullName(fullName);
    const userNameError = validateUsername(userName);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    if (fullNameError) {
      return res.status(400).json({ message: fullNameError });
    }

    if (userNameError) {
      return res.status(400).json({ message: userNameError });
    }

    if (emailError) {
      return res.status(400).json({ message: emailError });
    }

    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const existingUserByEmail = await User.findOne({ email: email });
    if (existingUserByEmail) {
      return res.status(400).json({ message: "Email already exists." });
    }

    const existingUserByUsername = await User.findOne({ userName: userName });
    if (existingUserByUsername) {
      return res.status(400).json({ message: "Username already exists." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName,
      userName,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    generateToken(newUser._id, email, res);

    const otp = generateOTP();

    const redisOtpStoring = await redis.set(`otp:${email}`, otp, { ex: 300 });
 
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.OFFICIAL_EMAIL,
        pass: process.env.OFFICIALEMAIL_PASS,
      },
    });
 
    const mailOptionsOtpSent = {
      from: process.env.OFFICIAL_EMAIL,
      to: email,
      subject: "Your Pixster OTP Code - Verify Your Account",
      html: `${otpEmailTemplateFirst} ${otp} ${otpEmailTemplateLast}`,
    };
 
    await transporter.sendMail(mailOptionsOtpSent);
    
    return res.status(201).json({
      message : "Otp sent successfully to you email.",
    });

  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const token = req.cookies.jwt;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;
    const userId = decoded.userId;

    const storedOtp = await redis.get(`otp:${email}`);

    if(!storedOtp) {
      return res.status(404).json({ message : "Something went wrong, please try again" });
    }

    if(Number(otp) !== storedOtp) {
      return res.status(400).json({ message : "Incorrect Otp" });
    }

    const updatedUser = await User.findOneAndUpdate({_id : userId}, {
      isEmailVerifed : true
    })

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.OFFICIAL_EMAIL,
        pass: process.env.OFFICIALEMAIL_PASS,
      },
    });

    const mailOptionsAccountCreated = {
      from: process.env.OFFICIAL_EMAIL,
      to: email,
      subject: "🎉 Welcome to Pixster – Account Created Successfully",
      html: ` ${emailVerifiedTemplateFirst} ${updatedUser.fullName} ${emailVerifiedTemplateFirst}`,
    };

    await transporter.sendMail(mailOptionsAccountCreated);

    generateToken(updatedUser._id, updatedUser.email, res);

    return res.status(200).json({
     message : "Email verified successfully"
    });

  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
}

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Fill all fields." });
    }

    if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email)) {
      return res.status(400).json({ message: "Invalid email." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if(!user.isEmailVerifed) {
      return res.status(400).json({ message : "Email not verified", verifyEmail : true })
    }

    if(user.profilePic){
      const signedUrl = await generateSignedUrl(user.profilePic);
      user.profilePic = signedUrl;
    }

    generateToken(user._id, email, res);
    return res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      userName: user.userName,
      email: user.email,
      profilePic: user.profilePic,
      about: user.about,
      public: user.public,
      createdAt: user.createdAt,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if(!email) {
      return res.status(400).json({ message : "Invalid request" });
    }

    const user = await User.findOne({ email : email });
    if(!user) {
      return res.status(404).json({ message : "User not found" });
    }

    generateToken(user._id, user.email, res);

    const otp = generateOTP();

    const redisOtpStoring = await redis.set(`otp:${email}`, otp, { ex: 300 });
 
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.OFFICIAL_EMAIL,
        pass: process.env.OFFICIALEMAIL_PASS,
      },
    });
 
    const mailOptionsOtpSent = {
      from: process.env.OFFICIAL_EMAIL,
      to: email,
      subject: "Your Pixster OTP Code - Verify Your Account",
      html: `${otpEmailTemplateFirst} ${otp} ${otpEmailTemplateLast}`,
    };
 
    await transporter.sendMail(mailOptionsOtpSent);
    
    return res.status(201).json({
      success : true,
      message : "Otp sent successfully to you email.",
    });
    
  }catch (error) {
    return req.status(500).json({ message: "Internal server error." });
  }
}

export const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if(!password) {
      return res.status(404).json({ message : "Invalid request" });
    }

    const token = req.cookies.jwt;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const user = await User.findById({ _id : userId });
    if(!user) {
      return res.status(404).json({ message : "No user found" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({ success : true, message : "Password reseted successfully" });
  }catch (error) {
    return req.status(500).json({ message: "Internal server error." });
  }
}

export const logout = (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 0 });
    return res.status(200).json({ message: "Logged out successfully." });
  } catch (error) {
    return req.status(500).json({ message: "Internal server error." });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const file = req.file;
    const userId = req.user._id;

    if (!file) {
      return res.status(400).json({ message: "Profile pic is required" });
    }

    const user = await User.findById(userId);
    if(!user){
      return res.status(400).json({ message : "User not found." });
    }

    if(user.profilePic){
      const oldKey = user.profilePic.split('/').slice(3).join('/');
      const deleteParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: oldKey,
      };
      try{
        await s3Client.send(new DeleteObjectCommand(deleteParams));
      }catch (error) {
        throw new Error("Profile image updating error.");
      }
    }

    const key = generateS3Key({
      folder: 'pixsterUsersProfileImages',
      userId: userId,
      originalname: file.originalname,
    });

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    const upload = new Upload({
      client: s3Client,
      params: params,
    });

    const s3UploadResponse = await upload.done();

    let updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: s3UploadResponse.Location },
      { 
        projection : {createdAt: 0, updatedAt: 0, followersCount: 0, followingsCount: 0, postsCount: 0, password: 0},
        new: true 
      },
    );

    const signedUrl = await generateSignedUrl(updatedUser.profilePic);
    updatedUser.profilePic = signedUrl;

    return res.status(200).json(updatedUser);
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const removeProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if(!user){
      return res.status(400).json({ message : "User not found." });
    }

    if(!user.profilePic) {
      return res.status(400).json({ message: "You dont have profile image." });
    }

    if(user.profilePic){
      const oldKey = user.profilePic.split('/').slice(3).join('/');
      const deleteParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: oldKey,
      };
      try{
        await s3Client.send(new DeleteObjectCommand(deleteParams));
      }catch (error) {
        
        throw new Error("Profile image updating error.");
      }
    }

    let updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: null },
      { 
        projection : {createdAt: 0, updatedAt: 0, followersCount: 0, followingsCount: 0, postsCount: 0, password: 0},
        new: true 
      },
    );

    return res.status(200).json(updatedUser);
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const checkAuth = async (req, res) => {
  try {
    return res.status(200).json(req.user);
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
};
