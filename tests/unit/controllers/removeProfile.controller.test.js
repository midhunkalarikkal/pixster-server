import { beforeEach, describe, jest, it, expect } from '@jest/globals';

const mockFindById = jest.fn();
const mockFindByIdAndUpdate = jest.fn();
const mockS3Send = jest.fn();

jest.unstable_mockModule('../../../src/lib/redis.js', () => ({
    redis: {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
    },
}));

jest.unstable_mockModule('../../../src/models/user.model.js', () => ({
    default: {
        findById: mockFindById,
        findByIdAndUpdate: mockFindByIdAndUpdate,
    },
}));

jest.unstable_mockModule('../../../src/utils/aws.config.js', () => ({
    s3Client: {
        send: mockS3Send,
    },
    generateSignedUrl: jest.fn(),
}));

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
    DeleteObjectCommand: jest.fn().mockImplementation((params) => ({
        input: params,
    })),
}));

const { removeProfile } = await import('../../../src/controllers/auth.controller.js');

describe('removeProfile controller', () => {
    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            user: {
                _id: 'user123',
            },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        mockFindById.mockResolvedValue({
            _id: 'user123',
            profilePic: 'https://bucket.s3.amazonaws.com/pixsterUsersProfileImages/profile.jpg',
        });

        mockS3Send.mockResolvedValue({});

        mockFindByIdAndUpdate.mockResolvedValue({
            _id: 'user123',
            fullName: 'John Doe',
            userName: 'johndoe',
            email: 'john@gmail.com',
            profilePic: null,
        });
    });

    it('should return 400 when user does not exist', async () => {
        mockFindById.mockResolvedValue(null);

        await removeProfile(req, res);

        expect(mockFindById).toHaveBeenCalledWith('user123');

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'User not found.',
        });

        expect(mockS3Send).not.toHaveBeenCalled();
        expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should return 400 when user does not have a profile picture', async () => {
        mockFindById.mockResolvedValue({
            _id: 'user123',
            profilePic: null,
        });

        await removeProfile(req, res);

        expect(mockFindById).toHaveBeenCalledWith('user123');

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'You dont have profile image.',
        });

        expect(mockS3Send).not.toHaveBeenCalled();
        expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should remove the profile picture successfully', async () => {
        await removeProfile(req, res);

        expect(mockFindById).toHaveBeenCalledWith('user123');

        expect(mockS3Send).toHaveBeenCalledWith(
            expect.objectContaining({
                input: {
                    Bucket: process.env.AWS_S3_BUCKET_NAME,
                    Key: 'pixsterUsersProfileImages/profile.jpg',
                },
            }),
        );

        expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
            'user123',
            {
                profilePic: null,
            },
            {
                projection: {
                    createdAt: 0,
                    updatedAt: 0,
                    followersCount: 0,
                    followingsCount: 0,
                    postsCount: 0,
                    password: 0,
                },
                new: true,
            },
        );

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith({
            _id: 'user123',
            fullName: 'John Doe',
            userName: 'johndoe',
            email: 'john@gmail.com',
            profilePic: null,
        });
    });

    it('should return 500 when deleting the profile picture from S3 fails', async () => {
        mockS3Send.mockRejectedValue(new Error('S3 delete error'));

        await removeProfile(req, res);

        expect(mockS3Send).toHaveBeenCalledTimes(1);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });

        expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should return 500 when updating the user fails', async () => {
        mockFindByIdAndUpdate.mockRejectedValue(new Error('Database update error'));

        await removeProfile(req, res);

        expect(mockS3Send).toHaveBeenCalledTimes(1);

        expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
            'user123',
            {
                profilePic: null,
            },
            {
                projection: {
                    createdAt: 0,
                    updatedAt: 0,
                    followersCount: 0,
                    followingsCount: 0,
                    postsCount: 0,
                    password: 0,
                },
                new: true,
            },
        );

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });
    });

    it('should return 500 when finding the user fails', async () => {
        mockFindById.mockRejectedValue(new Error('Database error'));

        await removeProfile(req, res);

        expect(mockFindById).toHaveBeenCalledWith('user123');

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });

        expect(mockS3Send).not.toHaveBeenCalled();
        expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
    });
});
