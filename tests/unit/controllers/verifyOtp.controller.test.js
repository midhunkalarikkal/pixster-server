import { beforeEach, describe, jest, it, expect } from '@jest/globals';

const mockJwtVerify = jest.fn();

const mockRedisGet = jest.fn();

const mockFindOneAndUpdate = jest.fn();

const mockGenerateToken = jest.fn();

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn();

jest.unstable_mockModule('jsonwebtoken', () => ({
    default: {
        verify: mockJwtVerify,
    },
}));

jest.unstable_mockModule('../../../src/lib/redis.js', () => ({
    redis: {
        get: mockRedisGet,
    },
}));

const mockUser = {
    findOneAndUpdate: mockFindOneAndUpdate,
};

jest.unstable_mockModule('../../../src/models/user.model.js', () => ({
    default: mockUser,
}));

jest.unstable_mockModule('../../../src/lib/utils.js', () => ({
    generateToken: mockGenerateToken,
}));

jest.unstable_mockModule('nodemailer', () => ({
    default: {
        createTransport: mockCreateTransport,
    },
}));

jest.unstable_mockModule('../../../src/utils/constants.js', () => ({
    emailVerifiedTemplateFirst: '<p>Welcome ',
    otpEmailTemplateFirst: '',
    otpEmailTemplateLast: '',
}));

jest.unstable_mockModule('../../../src/utils/helper.js', () => ({
    generateOTP: jest.fn(),
    generateS3Key: jest.fn(),
}));

jest.unstable_mockModule('../../../src/utils/validator.js', () => ({
    validateEmail: jest.fn(),
    validateFullName: jest.fn(),
    validatePassword: jest.fn(),
    validateUsername: jest.fn(),
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

const { verifyOtp } = await import('../../../src/controllers/auth.controller.js');

describe('verifyOtp controller', () => {
    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            body: {
                otp: '123456',
            },
            cookies: {
                jwt: 'valid-jwt-token',
            },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        mockJwtVerify.mockReturnValue({
            email: 'john@example.com',
            userId: 'user123',
        });

        mockRedisGet.mockResolvedValue('123456');

        mockFindOneAndUpdate.mockResolvedValue({
            _id: 'user123',
            fullName: 'John Doe',
            email: 'john@example.com',
        });

        mockCreateTransport.mockReturnValue({
            sendMail: mockSendMail,
        });

        mockSendMail.mockResolvedValue({});

        mockGenerateToken.mockReturnValue(undefined);
    });

    it('should return 404 when OTP is not found', async () => {
        mockRedisGet.mockResolvedValue(null);

        await verifyOtp(req, res);

        expect(mockJwtVerify).toHaveBeenCalledWith('valid-jwt-token', process.env.JWT_SECRET);

        expect(mockRedisGet).toHaveBeenCalledWith('otp:john@example.com');

        expect(res.status).toHaveBeenCalledWith(404);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Something went wrong, please try again',
        });

        expect(mockFindOneAndUpdate).not.toHaveBeenCalled();

        expect(mockSendMail).not.toHaveBeenCalled();

        expect(mockGenerateToken).not.toHaveBeenCalled();
    });

    it('should return 400 when OTP is incorrect', async () => {
        mockRedisGet.mockResolvedValue('654321');

        await verifyOtp(req, res);

        expect(mockRedisGet).toHaveBeenCalledWith('otp:john@example.com');

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Incorrect Otp',
        });

        expect(mockFindOneAndUpdate).not.toHaveBeenCalled();

        expect(mockSendMail).not.toHaveBeenCalled();

        expect(mockGenerateToken).not.toHaveBeenCalled();
    });

    it('should verify OTP successfully', async () => {
        await verifyOtp(req, res);

        expect(mockJwtVerify).toHaveBeenCalledWith('valid-jwt-token', process.env.JWT_SECRET);

        expect(mockRedisGet).toHaveBeenCalledWith('otp:john@example.com');

        expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
            {
                _id: 'user123',
            },
            {
                isEmailVerifed: true,
            },
        );

        expect(mockCreateTransport).toHaveBeenCalledWith({
            service: 'gmail',
            auth: {
                user: process.env.OFFICIAL_EMAIL,
                pass: process.env.OFFICIALEMAIL_PASS,
            },
        });

        expect(mockSendMail).toHaveBeenCalledWith({
            from: process.env.OFFICIAL_EMAIL,
            to: 'john@example.com',
            subject: '🎉 Welcome to Pixster – Account Created Successfully',
            html: expect.stringContaining('John Doe'),
        });

        expect(mockGenerateToken).toHaveBeenCalledWith('user123', 'john@example.com', res);

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Email verified successfully',
        });
    });

    it('should return 500 when JWT verification fails', async () => {
        mockJwtVerify.mockImplementation(() => {
            throw new Error('Invalid token');
        });

        await verifyOtp(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });

        expect(mockRedisGet).not.toHaveBeenCalled();

        expect(mockFindOneAndUpdate).not.toHaveBeenCalled();

        expect(mockSendMail).not.toHaveBeenCalled();

        expect(mockGenerateToken).not.toHaveBeenCalled();
    });

    it('should return 500 when Redis throws an error', async () => {
        mockRedisGet.mockRejectedValue(new Error('Redis connection failed'));

        await verifyOtp(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });

        expect(mockFindOneAndUpdate).not.toHaveBeenCalled();

        expect(mockSendMail).not.toHaveBeenCalled();

        expect(mockGenerateToken).not.toHaveBeenCalled();
    });

    it('should return 500 when updating the user fails', async () => {
        mockFindOneAndUpdate.mockRejectedValue(new Error('Database error'));

        await verifyOtp(req, res);

        expect(mockFindOneAndUpdate).toHaveBeenCalled();

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });

        expect(mockSendMail).not.toHaveBeenCalled();

        expect(mockGenerateToken).not.toHaveBeenCalled();
    });

    it('should return 500 when sending the email fails', async () => {
        mockSendMail.mockRejectedValue(new Error('Email sending failed'));

        await verifyOtp(req, res);

        expect(mockFindOneAndUpdate).toHaveBeenCalled();

        expect(mockSendMail).toHaveBeenCalled();

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });

        expect(mockGenerateToken).not.toHaveBeenCalled();
    });
});
