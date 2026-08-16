import { beforeEach, describe, jest, it, expect } from '@jest/globals';

const mockFindById = jest.fn();
const mockFindByIdAndUpdate = jest.fn();
const mockGenerateS3Key = jest.fn();
const mockGenerateSignedUrl = jest.fn();
const mockS3Send = jest.fn();
const mockUploadDone = jest.fn();

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

jest.unstable_mockModule('../../../src/utils/helper.js', () => ({
    generateOTP: jest.fn(),
    generateS3Key: mockGenerateS3Key,
}));

jest.unstable_mockModule('../../../src/utils/aws.config.js', () => ({
    generateSignedUrl: mockGenerateSignedUrl,
    s3Client: {
        send: mockS3Send,
    },
}));

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
    DeleteObjectCommand: jest.fn().mockImplementation((params) => ({
        input: params,
    })),
}));

jest.unstable_mockModule('@aws-sdk/lib-storage', () => ({
    Upload: jest.fn().mockImplementation(() => ({
        done: mockUploadDone,
    })),
}));

const { updateProfile } = await import('../../../src/controllers/auth.controller.js');

describe('updateProfile controller', () => {
    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            file: {
                originalname: 'profile.jpg',
                mimetype: 'image/jpeg',
                buffer: Buffer.from('image-data'),
            },
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
            profilePic: null,
        });

        mockGenerateS3Key.mockReturnValue('pixsterUsersProfileImages/user123-profile.jpg');

        mockUploadDone.mockResolvedValue({
            Location:
                'https://bucket.s3.amazonaws.com/pixsterUsersProfileImages/user123-profile.jpg',
        });

        mockFindByIdAndUpdate.mockResolvedValue({
            _id: 'user123',
            fullName: 'John Doe',
            userName: 'johndoe',
            email: 'john@gmail.com',
            profilePic:
                'https://bucket.s3.amazonaws.com/pixsterUsersProfileImages/user123-profile.jpg',
        });

        mockGenerateSignedUrl.mockResolvedValue('https://signed-url.com/profile.jpg');

        mockS3Send.mockResolvedValue({});
    });

    it('should return 400 when profile picture is missing', async () => {
        req.file = null;

        await updateProfile(req, res);

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Profile pic is required',
        });

        expect(mockFindById).not.toHaveBeenCalled();
        expect(mockUploadDone).not.toHaveBeenCalled();
    });

    it('should return 400 when user does not exist', async () => {
        mockFindById.mockResolvedValue(null);

        await updateProfile(req, res);

        expect(mockFindById).toHaveBeenCalledWith('user123');

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'User not found.',
        });

        expect(mockUploadDone).not.toHaveBeenCalled();
        expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should update profile successfully when user has no existing profile picture', async () => {
        await updateProfile(req, res);

        expect(mockFindById).toHaveBeenCalledWith('user123');

        expect(mockGenerateS3Key).toHaveBeenCalledWith({
            folder: 'pixsterUsersProfileImages',
            userId: 'user123',
            originalname: 'profile.jpg',
        });

        expect(mockUploadDone).toHaveBeenCalledTimes(1);

        expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
            'user123',
            {
                profilePic:
                    'https://bucket.s3.amazonaws.com/pixsterUsersProfileImages/user123-profile.jpg',
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

        expect(mockGenerateSignedUrl).toHaveBeenCalledWith(
            'https://bucket.s3.amazonaws.com/pixsterUsersProfileImages/user123-profile.jpg',
        );

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith({
            _id: 'user123',
            fullName: 'John Doe',
            userName: 'johndoe',
            email: 'john@gmail.com',
            profilePic: 'https://signed-url.com/profile.jpg',
        });
    });

    it('should delete the old profile picture before uploading the new one', async () => {
        mockFindById.mockResolvedValue({
            _id: 'user123',
            profilePic: 'https://bucket.s3.amazonaws.com/pixsterUsersProfileImages/old-profile.jpg',
        });

        await updateProfile(req, res);

        expect(mockS3Send).toHaveBeenCalledTimes(1);

        expect(mockS3Send).toHaveBeenCalledWith(
            expect.objectContaining({
                input: {
                    Bucket: process.env.AWS_S3_BUCKET_NAME,
                    Key: 'pixsterUsersProfileImages/old-profile.jpg',
                },
            }),
        );

        expect(mockUploadDone).toHaveBeenCalledTimes(1);
    });

    it('should return 500 when deleting the old profile picture fails', async () => {
        mockFindById.mockResolvedValue({
            _id: 'user123',
            profilePic: 'https://bucket.s3.amazonaws.com/pixsterUsersProfileImages/old-profile.jpg',
        });

        mockS3Send.mockRejectedValue(new Error('S3 delete error'));

        await updateProfile(req, res);

        expect(mockS3Send).toHaveBeenCalledTimes(1);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });

        expect(mockUploadDone).not.toHaveBeenCalled();
        expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should return 500 when S3 upload fails', async () => {
        mockUploadDone.mockRejectedValue(new Error('S3 upload error'));

        await updateProfile(req, res);

        expect(mockUploadDone).toHaveBeenCalledTimes(1);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });

        expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should return 500 when updating the user fails', async () => {
        mockFindByIdAndUpdate.mockRejectedValue(new Error('Database update error'));

        await updateProfile(req, res);

        expect(mockFindByIdAndUpdate).toHaveBeenCalled();

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });

        expect(mockGenerateSignedUrl).not.toHaveBeenCalled();
    });

    it('should return 500 when generating signed URL fails', async () => {
        mockGenerateSignedUrl.mockRejectedValue(new Error('Signed URL error'));

        await updateProfile(req, res);

        expect(mockFindByIdAndUpdate).toHaveBeenCalled();

        expect(mockGenerateSignedUrl).toHaveBeenCalled();

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });
    });
});
