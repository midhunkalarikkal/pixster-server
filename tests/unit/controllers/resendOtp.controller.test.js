import { beforeEach, describe, jest, it, expect } from '@jest/globals';

const mockFindOne = jest.fn();
const mockGenerateToken = jest.fn();
const mockGenerateOTP = jest.fn();
const mockRedisSet = jest.fn();
const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn();

const mockUser = {
    findOne: mockFindOne,
};

jest.unstable_mockModule('../../../src/models/user.model.js', () => ({
    default: mockUser,
}));

jest.unstable_mockModule('../../../src/lib/utils.js', () => ({
    generateToken: mockGenerateToken,
}));

jest.unstable_mockModule('../../../src/utils/helper.js', () => ({
    generateOTP: mockGenerateOTP,
    generateS3Key: jest.fn(),
}));

jest.unstable_mockModule('../../../src/lib/redis.js', () => ({
    redis: {
        set: mockRedisSet,
    },
}));

jest.unstable_mockModule('nodemailer', () => ({
    default: {
        createTransport: mockCreateTransport,
    },
}));

jest.unstable_mockModule('../../../src/utils/constants.js', () => ({
    emailVerifiedTemplateFirst: '',
    otpEmailTemplateFirst: '<p>Your OTP is',
    otpEmailTemplateLast: '</p>',
}));

jest.unstable_mockModule('../../../src/utils/validator.js', () => ({
    validateEmail: jest.fn(),
    validateFullName: jest.fn(),
    validatePassword: jest.fn(),
    validateUsername: jest.fn(),
}));

jest.unstable_mockModule('bcryptjs', () => ({
    default: {
        genSalt: jest.fn(),
        hash: jest.fn(),
        compare: jest.fn(),
    },
}));

jest.unstable_mockModule('jsonwebtoken', () => ({
    default: {
        verify: jest.fn(),
        sign: jest.fn(),
    },
}));

jest.unstable_mockModule('@aws-sdk/lib-storage', () => ({
    Upload: jest.fn(),
}));

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
    DeleteObjectCommand: jest.fn(),
}));

jest.unstable_mockModule('../../../src/utils/aws.config.js', () => ({
    generateSignedUrl: jest.fn(),
    s3Client: {},
}));

const { resendOtp } = await import('../../../src/controllers/auth.controller.js');

describe('resendOtp controller', () => {
    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            body: {
                email: 'john@gmail.com',
            },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        mockFindOne.mockResolvedValue({
            _id: 'user123',
            email: 'john@gmail.com',
            fullName: 'John Doe',
        });

        mockGenerateOTP.mockReturnValue('123456');

        mockGenerateToken.mockReturnValue(undefined);

        mockRedisSet.mockResolvedValue('OK');

        mockCreateTransport.mockReturnValue({
            sendMail: mockSendMail,
        });

        mockSendMail.mockResolvedValue({});
    });

    it('should return 400 when email is missing', async () => {
        req.body.email = '';

        await resendOtp(req, res);

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Invalid request',
        });

        expect(mockFindOne).not.toHaveBeenCalled();

        expect(mockGenerateToken).not.toHaveBeenCalled();

        expect(mockGenerateOTP).not.toHaveBeenCalled();
    });

    it('should return 404 when user does not exist', async () => {
        mockFindOne.mockResolvedValue(null);

        await resendOtp(req, res);

        expect(mockFindOne).toHaveBeenCalledWith({
            email: 'john@gmail.com',
        });

        expect(res.status).toHaveBeenCalledWith(404);

        expect(res.json).toHaveBeenCalledWith({
            message: 'User not found',
        });

        expect(mockGenerateToken).not.toHaveBeenCalled();

        expect(mockGenerateOTP).not.toHaveBeenCalled();

        expect(mockRedisSet).not.toHaveBeenCalled();

        expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should resend OTP successfully', async () => {
        await resendOtp(req, res);

        expect(mockFindOne).toHaveBeenCalledWith({
            email: 'john@gmail.com',
        });

        expect(mockGenerateToken).toHaveBeenCalledWith('user123', 'john@gmail.com', res);

        expect(mockGenerateOTP).toHaveBeenCalledTimes(1);

        expect(mockRedisSet).toHaveBeenCalledWith('otp:john@gmail.com', '123456', { ex: 300 });

        expect(mockCreateTransport).toHaveBeenCalledWith({
            service: 'gmail',
            auth: {
                user: process.env.OFFICIAL_EMAIL,
                pass: process.env.OFFICIALEMAIL_PASS,
            },
        });

        expect(mockSendMail).toHaveBeenCalledWith({
            from: process.env.OFFICIAL_EMAIL,
            to: 'john@gmail.com',
            subject: 'Your Pixster OTP Code - Verify Your Account',
            html: '<p>Your OTP is 123456 </p>',
        });

        expect(res.status).toHaveBeenCalledWith(201);

        expect(res.json).toHaveBeenCalledWith({
            success: true,
            message: 'Otp sent successfully to you email.',
        });
    });

    it('should return 500 when finding the user fails', async () => {
        mockFindOne.mockRejectedValue(new Error('Database error'));

        await resendOtp(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });

        expect(mockGenerateToken).not.toHaveBeenCalled();

        expect(mockGenerateOTP).not.toHaveBeenCalled();

        expect(mockRedisSet).not.toHaveBeenCalled();

        expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should return 500 when generating OTP fails', async () => {
        mockGenerateOTP.mockImplementation(() => {
            throw new Error('OTP generation failed');
        });

        await resendOtp(req, res);

        expect(mockGenerateToken).toHaveBeenCalled();

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });

        expect(mockRedisSet).not.toHaveBeenCalled();

        expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should return 500 when Redis fails', async () => {
        mockRedisSet.mockRejectedValue(new Error('Redis error'));

        await resendOtp(req, res);

        expect(mockGenerateOTP).toHaveBeenCalled();

        expect(mockRedisSet).toHaveBeenCalledWith('otp:john@gmail.com', '123456', { ex: 300 });

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });

        expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should return 500 when sending email fails', async () => {
        mockSendMail.mockRejectedValue(new Error('Email sending failed'));

        await resendOtp(req, res);

        expect(mockGenerateOTP).toHaveBeenCalled();

        expect(mockRedisSet).toHaveBeenCalledWith('otp:john@gmail.com', '123456', { ex: 300 });

        expect(mockSendMail).toHaveBeenCalled();

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });
    });

    it("should use the user's email when generating the token", async () => {
        req.body.email = 'different@gmail.com';

        mockFindOne.mockResolvedValue({
            _id: 'user123',
            email: 'john@gmail.com',
            fullName: 'John Doe',
        });

        await resendOtp(req, res);

        expect(mockGenerateToken).toHaveBeenCalledWith('user123', 'john@gmail.com', res);

        expect(mockRedisSet).toHaveBeenCalledWith('otp:different@gmail.com', '123456', { ex: 300 });

        expect(mockSendMail).toHaveBeenCalledWith(
            expect.objectContaining({
                to: 'different@gmail.com',
            }),
        );
    });
});
