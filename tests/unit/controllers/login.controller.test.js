import { beforeEach, describe, jest, it, expect } from '@jest/globals';

const mockFindOne = jest.fn();
const mockCompare = jest.fn();
const mockGenerateToken = jest.fn();
const mockGenerateSignedUrl = jest.fn();

const mockUser = {
    findOne: mockFindOne,
};

jest.unstable_mockModule('../../../src/models/user.model.js', () => ({
    default: mockUser,
}));

jest.unstable_mockModule('bcryptjs', () => ({
    default: {
        compare: mockCompare,
    },
}));

jest.unstable_mockModule('../../../src/lib/utils.js', () => ({
    generateToken: mockGenerateToken,
}));

jest.unstable_mockModule('../../../src/utils/aws.config.js', () => ({
    generateSignedUrl: mockGenerateSignedUrl,
    s3Client: {},
}));

jest.unstable_mockModule('jsonwebtoken', () => ({
    default: {
        verify: jest.fn(),
        sign: jest.fn(),
    },
}));

jest.unstable_mockModule('nodemailer', () => ({
    default: {
        createTransport: jest.fn(),
    },
}));

jest.unstable_mockModule('../../../src/lib/redis.js', () => ({
    redis: {
        get: jest.fn(),
        set: jest.fn(),
    },
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

jest.unstable_mockModule('../../../src/utils/constants.js', () => ({
    emailVerifiedTemplateFirst: '',
    otpEmailTemplateFirst: '',
    otpEmailTemplateLast: '',
}));

jest.unstable_mockModule('@aws-sdk/lib-storage', () => ({
    Upload: jest.fn(),
}));

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
    DeleteObjectCommand: jest.fn(),
}));

const { login } = await import('../../../src/controllers/auth.controller.js');

describe('login controller', () => {
    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            body: {
                email: 'john@gmail.com',
                password: 'Password123',
            },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        mockFindOne.mockResolvedValue({
            _id: 'user123',
            fullName: 'John Doe',
            userName: 'johndoe',
            email: 'john@gmail.com',
            password: 'hashed-password',
            profilePic: null,
            about: 'Hello',
            public: true,
            isEmailVerifed: true,
            createdAt: '2026-08-16T00:00:00.000Z',
        });

        mockCompare.mockResolvedValue(true);

        mockGenerateSignedUrl.mockResolvedValue('https://example.com/profile.jpg');
    });

    it('should return 400 when email is missing', async () => {
        req.body.email = '';

        await login(req, res);

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Fill all fields.',
        });

        expect(mockFindOne).not.toHaveBeenCalled();
    });

    it('should return 400 when password is missing', async () => {
        req.body.password = '';

        await login(req, res);

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Fill all fields.',
        });

        expect(mockFindOne).not.toHaveBeenCalled();
    });

    it('should return 400 when email is invalid', async () => {
        req.body.email = 'john@yahoo.com';

        await login(req, res);

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Invalid email.',
        });

        expect(mockFindOne).not.toHaveBeenCalled();
    });

    it('should return 400 when user does not exist', async () => {
        mockFindOne.mockResolvedValue(null);

        await login(req, res);

        expect(mockFindOne).toHaveBeenCalledWith({
            email: 'john@gmail.com',
        });

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Invalid credentials.',
        });

        expect(mockCompare).not.toHaveBeenCalled();
    });

    it('should return 400 when password is incorrect', async () => {
        mockCompare.mockResolvedValue(false);

        await login(req, res);

        expect(mockFindOne).toHaveBeenCalledWith({
            email: 'john@gmail.com',
        });

        expect(mockCompare).toHaveBeenCalledWith('Password123', 'hashed-password');

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Invalid credentials',
        });

        expect(mockGenerateToken).not.toHaveBeenCalled();
    });

    it('should return 400 when email is not verified', async () => {
        mockFindOne.mockResolvedValue({
            _id: 'user123',
            fullName: 'John Doe',
            userName: 'johndoe',
            email: 'john@gmail.com',
            password: 'hashed-password',
            profilePic: null,
            about: 'Hello',
            public: true,
            isEmailVerifed: false,
            createdAt: '2026-08-16T00:00:00.000Z',
        });

        await login(req, res);

        expect(mockCompare).toHaveBeenCalledWith('Password123', 'hashed-password');

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Email not verified',
            verifyEmail: true,
        });

        expect(mockGenerateToken).not.toHaveBeenCalled();
    });

    it('should login successfully without profile picture', async () => {
        const user = {
            _id: 'user123',
            fullName: 'John Doe',
            userName: 'johndoe',
            email: 'john@gmail.com',
            password: 'hashed-password',
            profilePic: null,
            about: 'Hello',
            public: true,
            isEmailVerifed: true,
            createdAt: '2026-08-16T00:00:00.000Z',
        };

        mockFindOne.mockResolvedValue(user);

        await login(req, res);

        expect(mockFindOne).toHaveBeenCalledWith({
            email: 'john@gmail.com',
        });

        expect(mockCompare).toHaveBeenCalledWith('Password123', 'hashed-password');

        expect(mockGenerateToken).toHaveBeenCalledWith('user123', 'john@gmail.com', res);

        expect(mockGenerateSignedUrl).not.toHaveBeenCalled();

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith({
            _id: 'user123',
            fullName: 'John Doe',
            userName: 'johndoe',
            email: 'john@gmail.com',
            profilePic: null,
            about: 'Hello',
            public: true,
            createdAt: '2026-08-16T00:00:00.000Z',
        });
    });

    it('should generate signed URL when profile picture exists', async () => {
        const user = {
            _id: 'user123',
            fullName: 'John Doe',
            userName: 'johndoe',
            email: 'john@gmail.com',
            password: 'hashed-password',
            profilePic: 'profile/user123.jpg',
            about: 'Hello',
            public: true,
            isEmailVerifed: true,
            createdAt: '2026-08-16T00:00:00.000Z',
        };

        mockFindOne.mockResolvedValue(user);

        await login(req, res);

        expect(mockGenerateSignedUrl).toHaveBeenCalledWith('profile/user123.jpg');

        expect(mockGenerateToken).toHaveBeenCalledWith('user123', 'john@gmail.com', res);

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith({
            _id: 'user123',
            fullName: 'John Doe',
            userName: 'johndoe',
            email: 'john@gmail.com',
            profilePic: 'https://example.com/profile.jpg',
            about: 'Hello',
            public: true,
            createdAt: '2026-08-16T00:00:00.000Z',
        });
    });

    it('should return 500 when database query fails', async () => {
        mockFindOne.mockRejectedValue(new Error('Database error'));

        await login(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });

        expect(mockCompare).not.toHaveBeenCalled();

        expect(mockGenerateToken).not.toHaveBeenCalled();
    });

    it('should return 500 when password comparison fails', async () => {
        mockCompare.mockRejectedValue(new Error('Password comparison error'));

        await login(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });

        expect(mockGenerateToken).not.toHaveBeenCalled();
    });

    it('should return 500 when generating signed URL fails', async () => {
        const user = {
            _id: 'user123',
            fullName: 'John Doe',
            userName: 'johndoe',
            email: 'john@gmail.com',
            password: 'hashed-password',
            profilePic: 'profile/user123.jpg',
            about: 'Hello',
            public: true,
            isEmailVerifed: true,
            createdAt: '2026-08-16T00:00:00.000Z',
        };

        mockFindOne.mockResolvedValue(user);

        mockGenerateSignedUrl.mockRejectedValue(new Error('S3 error'));

        await login(req, res);

        expect(mockGenerateSignedUrl).toHaveBeenCalledWith('profile/user123.jpg');

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });

        expect(mockGenerateToken).not.toHaveBeenCalled();
    });
});
