import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockFindOne = jest.fn();
const mockSave = jest.fn();

const mockGenSalt = jest.fn();
const mockHash = jest.fn();

const mockGenerateToken = jest.fn();
const mockGenerateOTP = jest.fn();

const mockRedisSet = jest.fn();

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn();

const mockValidateFullName = jest.fn();
const mockValidateUsername = jest.fn();
const mockValidateEmail = jest.fn();
const mockValidatePassword = jest.fn();

const mockUser = jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    this.save = mockSave;
});

mockUser.findOne = mockFindOne;

jest.unstable_mockModule('../../../src/models/user.model.js', () => ({
    default: mockUser,
}));

jest.unstable_mockModule('bcryptjs', () => ({
    default: {
        genSalt: mockGenSalt,
        hash: mockHash,
    },
}));

jest.unstable_mockModule('../../../src/lib/redis.js', () => ({
    redis: {
        set: mockRedisSet,
    },
}));

jest.unstable_mockModule('../../../src/lib/utils.js', () => ({
    generateToken: mockGenerateToken,
}));

jest.unstable_mockModule('../../../src/utils/helper.js', () => ({
    generateOTP: mockGenerateOTP,
    generateS3Key: jest.fn(),
}));

jest.unstable_mockModule('nodemailer', () => ({
    default: {
        createTransport: mockCreateTransport,
    },
}));

jest.unstable_mockModule('../../../src/utils/validator.js', () => ({
    validateFullName: mockValidateFullName,
    validateUsername: mockValidateUsername,
    validateEmail: mockValidateEmail,
    validatePassword: mockValidatePassword,
}));

jest.unstable_mockModule('../../../src/utils/constants.js', () => ({
    emailVerifiedTemplateFirst: '',
    otpEmailTemplateFirst: '<p>Your OTP is ',
    otpEmailTemplateLast: '</p>',
}));

const { signup } = await import('../../../src/controllers/auth.controller.js');

describe('signup controller', () => {
    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            body: {
                fullName: 'John Doe',
                userName: 'johndoe',
                email: 'john@example.com',
                password: 'Password123',
            },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        mockValidateFullName.mockReturnValue(null);
        mockValidateUsername.mockReturnValue(null);
        mockValidateEmail.mockReturnValue(null);
        mockValidatePassword.mockReturnValue(null);

        mockFindOne.mockResolvedValue(null);

        mockGenSalt.mockResolvedValue('salt');
        mockHash.mockResolvedValue('hashed-password');

        mockGenerateOTP.mockReturnValue('123456');

        mockRedisSet.mockResolvedValue('OK');

        mockCreateTransport.mockReturnValue({
            sendMail: mockSendMail,
        });

        mockSendMail.mockResolvedValue({});
        mockSave.mockResolvedValue({});
    });

    it('should create a user successfully', async () => {
        await signup(req, res);

        expect(mockFindOne).toHaveBeenCalledTimes(2);

        expect(mockGenSalt).toHaveBeenCalledWith(10);

        expect(mockHash).toHaveBeenCalledWith('Password123', 'salt');

        expect(mockSave).toHaveBeenCalledTimes(1);

        expect(mockGenerateToken).toHaveBeenCalled();

        expect(mockGenerateOTP).toHaveBeenCalled();

        expect(mockRedisSet).toHaveBeenCalledWith('otp:john@example.com', '123456', { ex: 300 });

        expect(mockSendMail).toHaveBeenCalledTimes(1);

        expect(res.status).toHaveBeenCalledWith(201);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Otp sent successfully to you email.',
        });
    });

    it('should return 400 when full name is invalid', async () => {
        mockValidateFullName.mockReturnValue('Invalid full name.');

        await signup(req, res);

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Invalid full name.',
        });

        expect(mockFindOne).not.toHaveBeenCalled();
        expect(mockSave).not.toHaveBeenCalled();
    });

    it('should return 400 when username is invalid', async () => {
        mockValidateUsername.mockReturnValue('Invalid username.');

        await signup(req, res);

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Invalid username.',
        });

        expect(mockFindOne).not.toHaveBeenCalled();
    });

    it('should return 400 when email is invalid', async () => {
        mockValidateEmail.mockReturnValue('Invalid email.');

        await signup(req, res);

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Invalid email.',
        });

        expect(mockFindOne).not.toHaveBeenCalled();
    });

    it('should return 400 when password is invalid', async () => {
        mockValidatePassword.mockReturnValue('Invalid password.');

        await signup(req, res);

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Invalid password.',
        });

        expect(mockFindOne).not.toHaveBeenCalled();
    });

    it('should return 400 when email already exists', async () => {
        mockFindOne.mockResolvedValueOnce({
            _id: 'existing-user-id',
            email: 'john@example.com',
        });

        await signup(req, res);

        expect(mockFindOne).toHaveBeenCalledWith({
            email: 'john@example.com',
        });

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Email already exists.',
        });

        expect(mockSave).not.toHaveBeenCalled();
    });

    it('should return 400 when username already exists', async () => {
        mockFindOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
            _id: 'existing-user-id',
            userName: 'johndoe',
        });

        await signup(req, res);

        expect(mockFindOne).toHaveBeenNthCalledWith(1, {
            email: 'john@example.com',
        });

        expect(mockFindOne).toHaveBeenNthCalledWith(2, {
            userName: 'johndoe',
        });

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Username already exists.',
        });

        expect(mockSave).not.toHaveBeenCalled();
    });

    it('should return 500 when an unexpected error occurs', async () => {
        mockFindOne.mockRejectedValue(new Error('Database error'));

        await signup(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });
    });
});
