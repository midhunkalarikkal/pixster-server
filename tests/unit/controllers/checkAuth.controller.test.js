import { beforeEach, describe, jest, it, expect } from '@jest/globals';

jest.unstable_mockModule('../../../src/lib/redis.js', () => ({
    redis: {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
    },
}));

const { checkAuth } = await import('../../../src/controllers/auth.controller.js');

describe('checkAuth controller', () => {
    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            user: {
                _id: 'user123',
                fullName: 'John Doe',
                userName: 'johndoe',
                email: 'john@gmail.com',
            },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
    });

    it('should return authenticated user successfully', async () => {
        await checkAuth(req, res);

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith(req.user);
    });

    it('should return 500 when sending the response fails', async () => {
        res.json
            .mockImplementationOnce(() => {
                throw new Error('Response error');
            })
            .mockImplementationOnce(() => {});

        await checkAuth(req, res);

        expect(res.status).toHaveBeenNthCalledWith(1, 200);
        expect(res.status).toHaveBeenNthCalledWith(2, 500);

        expect(res.json).toHaveBeenNthCalledWith(1, req.user);
        expect(res.json).toHaveBeenNthCalledWith(2, {
            message: 'Internal server error.',
        });
    });
});
