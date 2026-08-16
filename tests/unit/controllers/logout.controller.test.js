import { beforeEach, describe, jest, it, expect } from '@jest/globals';

jest.unstable_mockModule('../../../src/lib/redis.js', () => ({
    redis: {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
    },
}));

const { logout } = await import('../../../src/controllers/auth.controller.js');

describe('logout controller', () => {
    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {};

        res = {
            cookie: jest.fn(),
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
    });

    it('should logout successfully', () => {
        logout(req, res);

        expect(res.cookie).toHaveBeenCalledWith('jwt', '', { maxAge: 0 });

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Logged out successfully.',
        });
    });

    it('should return 500 when setting the cookie fails', () => {
        res.cookie.mockImplementation(() => {
            throw new Error('Cookie error');
        });

        logout(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });
    });
});
