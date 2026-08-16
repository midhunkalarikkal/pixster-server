import { beforeEach, describe, jest, it, expect } from '@jest/globals';

const mockVerify = jest.fn();
const mockFindById = jest.fn();
const mockGenSalt = jest.fn();
const mockHash = jest.fn();
const mockSave = jest.fn();

jest.unstable_mockModule('../../../src/lib/redis.js', () => ({
    redis: {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
    },
}));

jest.unstable_mockModule('jsonwebtoken', () => ({
    default: {
        verify: mockVerify,
    },
}));

jest.unstable_mockModule('bcryptjs', () => ({
    default: {
        genSalt: mockGenSalt,
        hash: mockHash,
    },
}));

jest.unstable_mockModule('../../../src/models/user.model.js', () => ({
    default: {
        findById: mockFindById,
    },
}));

const { resetPassword } = await import('../../../src/controllers/auth.controller.js');

describe('resetPassword controller', () => {
    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            body: {
                password: 'NewPassword123',
            },
            cookies: {
                jwt: 'valid-jwt-token',
            },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        mockVerify.mockReturnValue({
            userId: 'user123',
        });

        mockFindById.mockResolvedValue({
            _id: 'user123',
            password: 'old-hashed-password',
            save: mockSave,
        });

        mockGenSalt.mockResolvedValue('salt123');

        mockHash.mockResolvedValue('new-hashed-password');

        mockSave.mockResolvedValue({
            _id: 'user123',
            password: 'new-hashed-password',
        });
    });

    it('should return 404 when password is missing', async () => {
        req.body.password = '';

        await resetPassword(req, res);

        expect(res.status).toHaveBeenCalledWith(404);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Invalid request',
        });

        expect(mockVerify).not.toHaveBeenCalled();
        expect(mockFindById).not.toHaveBeenCalled();
    });

    it('should return 404 when user does not exist', async () => {
        mockFindById.mockResolvedValue(null);

        await resetPassword(req, res);

        expect(mockVerify).toHaveBeenCalledWith('valid-jwt-token', process.env.JWT_SECRET);

        expect(mockFindById).toHaveBeenCalledWith({
            _id: 'user123',
        });

        expect(res.status).toHaveBeenCalledWith(404);

        expect(res.json).toHaveBeenCalledWith({
            message: 'No user found',
        });

        expect(mockGenSalt).not.toHaveBeenCalled();
        expect(mockHash).not.toHaveBeenCalled();
    });

    it('should reset password successfully', async () => {
        const user = {
            _id: 'user123',
            password: 'old-hashed-password',
            save: mockSave,
        };

        mockFindById.mockResolvedValue(user);

        await resetPassword(req, res);

        expect(mockVerify).toHaveBeenCalledWith('valid-jwt-token', process.env.JWT_SECRET);

        expect(mockFindById).toHaveBeenCalledWith({
            _id: 'user123',
        });

        expect(mockGenSalt).toHaveBeenCalledWith(10);

        expect(mockHash).toHaveBeenCalledWith('NewPassword123', 'salt123');

        expect(user.password).toBe('new-hashed-password');

        expect(mockSave).toHaveBeenCalledTimes(1);

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith({
            success: true,
            message: 'Password reseted successfully',
        });
    });

    it('should return 500 when JWT verification fails', async () => {
        mockVerify.mockImplementation(() => {
            throw new Error('Invalid token');
        });

        await resetPassword(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });

        expect(mockFindById).not.toHaveBeenCalled();
        expect(mockGenSalt).not.toHaveBeenCalled();
        expect(mockHash).not.toHaveBeenCalled();
    });

    it('should return 500 when finding the user fails', async () => {
        mockFindById.mockRejectedValue(new Error('Database error'));

        await resetPassword(req, res);

        expect(mockFindById).toHaveBeenCalledWith({
            _id: 'user123',
        });

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });

        expect(mockGenSalt).not.toHaveBeenCalled();
        expect(mockHash).not.toHaveBeenCalled();
    });

    it('should return 500 when generating salt fails', async () => {
        mockGenSalt.mockRejectedValue(new Error('Salt generation failed'));

        await resetPassword(req, res);

        expect(mockGenSalt).toHaveBeenCalledWith(10);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });

        expect(mockHash).not.toHaveBeenCalled();
        expect(mockSave).not.toHaveBeenCalled();
    });

    it('should return 500 when hashing password fails', async () => {
        mockHash.mockRejectedValue(new Error('Hashing failed'));

        await resetPassword(req, res);

        expect(mockHash).toHaveBeenCalledWith('NewPassword123', 'salt123');

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });

        expect(mockSave).not.toHaveBeenCalled();
    });

    it('should return 500 when saving the user fails', async () => {
        mockSave.mockRejectedValue(new Error('Database save failed'));

        await resetPassword(req, res);

        expect(mockSave).toHaveBeenCalledTimes(1);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });
    });
});
