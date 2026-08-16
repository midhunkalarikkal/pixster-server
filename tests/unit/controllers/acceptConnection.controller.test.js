import { beforeEach, describe, jest, it, expect } from '@jest/globals';

const mockUserFindById = jest.fn();
const mockUserFindByIdAndUpdate = jest.fn();

const mockConnectionFindOne = jest.fn();
const mockConnectionSave = jest.fn();

const mockNotificationSave = jest.fn();
const mockNotificationPopulate = jest.fn();

const mockGenerateSignedUrl = jest.fn();

const mockGetReceiverSocketId = jest.fn();
const mockEmit = jest.fn();
const mockIoTo = jest.fn();

const mockNotificationConstructor = jest.fn().mockImplementation((data) => ({
    ...data,
    save: mockNotificationSave,
    populate: mockNotificationPopulate,
}));

jest.unstable_mockModule('../../../src/models/user.model.js', () => ({
    default: {
        findById: mockUserFindById,
        findByIdAndUpdate: mockUserFindByIdAndUpdate,
    },
}));

jest.unstable_mockModule('../../../src/models/connection.model.js', () => ({
    default: {
        findOne: mockConnectionFindOne,
    },
}));

jest.unstable_mockModule('../../../src/models/notification.model.js', () => ({
    default: mockNotificationConstructor,
}));

jest.unstable_mockModule('../../../src/utils/aws.config.js', () => ({
    generateSignedUrl: mockGenerateSignedUrl,
}));

jest.unstable_mockModule('../../../src/lib/socket.js', () => ({
    getReceiverSocketId: mockGetReceiverSocketId,
    io: {
        to: mockIoTo,
    },
}));

const { acceptConnection } = await import('../../../src/controllers/connection.controller.js');

describe('acceptConnection controller', () => {
    let req;
    let res;

    beforeEach(() => {
        jest.resetAllMocks();

        mockNotificationConstructor.mockImplementation((data) => ({
            ...data,
            save: mockNotificationSave,
            populate: mockNotificationPopulate,
        }));

        req = {
            user: {
                id: 'user123',
            },
            params: {
                toUserId: 'user456',
            },
            query: {
                status: 'accepted',
            },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        mockUserFindById.mockResolvedValue({
            _id: 'user456',
            fullName: 'Jane Doe',
        });

        mockConnectionFindOne
            .mockResolvedValueOnce({
                _id: 'connection123',
                fromUserId: 'user456',
                toUserId: 'user123',
                status: 'requested',
                save: mockConnectionSave,
            })
            .mockResolvedValueOnce({
                status: 'accepted',
            });

        mockConnectionSave.mockResolvedValue({
            _id: 'connection123',
            fromUserId: 'user456',
            toUserId: 'user123',
            status: 'accepted',
        });

        mockNotificationSave.mockResolvedValue({
            _id: 'notification123',
        });

        mockNotificationPopulate.mockResolvedValue({
            _id: 'notification123',
            fromUserId: {
                userName: 'john',
                fullName: 'John Doe',
                profilePic: null,
            },
        });

        mockUserFindByIdAndUpdate
            .mockResolvedValueOnce({
                _id: 'user123',
                followersCount: 1,
            })
            .mockReturnValueOnce({
                select: jest.fn().mockResolvedValue({
                    _id: 'user456',
                    fullName: 'Jane Doe',
                    profilePic: null,
                    followingsCount: 1,
                }),
            });

        mockGenerateSignedUrl.mockResolvedValue('https://signed-url.com/profile.jpg');

        mockGetReceiverSocketId.mockReturnValue(null);
        mockIoTo.mockReturnValue({
            emit: mockEmit,
        });
    });

    it('should return 400 when required parameters are missing', async () => {
        req.user.id = null;

        await acceptConnection(req, res);

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Invalid request.',
        });

        expect(mockUserFindById).not.toHaveBeenCalled();
    });

    it('should return 400 when accepting connection with yourself', async () => {
        req.params.toUserId = 'user123';

        await acceptConnection(req, res);

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Invalid request.',
        });

        expect(mockUserFindById).not.toHaveBeenCalled();
    });

    it('should return 400 when status is invalid', async () => {
        req.query.status = 'requested';

        await acceptConnection(req, res);

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Invalid request.',
        });

        expect(mockUserFindById).not.toHaveBeenCalled();
    });

    it('should return 400 when target user does not exist', async () => {
        mockUserFindById.mockResolvedValue(null);

        await acceptConnection(req, res);

        expect(mockUserFindById).toHaveBeenCalledWith('user456');

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'User not found.',
        });

        expect(mockConnectionFindOne).not.toHaveBeenCalled();
    });

    it('should return 400 when connection is already accepted', async () => {
        mockConnectionFindOne.mockReset();

        mockConnectionFindOne.mockResolvedValue({
            _id: 'connection123',
            fromUserId: 'user456',
            toUserId: 'user123',
            status: 'accepted',
            save: mockConnectionSave,
        });

        await acceptConnection(req, res);

        expect(mockConnectionFindOne).toHaveBeenCalledWith(
            {
                fromUserId: 'user456',
                toUserId: 'user123',
            },
            {
                status: 1,
            },
        );

        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Connection already exist.',
        });

        expect(mockConnectionSave).not.toHaveBeenCalled();
        expect(mockNotificationSave).not.toHaveBeenCalled();
    });

    it('should accept connection successfully', async () => {
        await acceptConnection(req, res);

        expect(mockUserFindById).toHaveBeenCalledWith('user456');

        expect(mockConnectionFindOne).toHaveBeenNthCalledWith(
            1,
            {
                fromUserId: 'user456',
                toUserId: 'user123',
            },
            {
                status: 1,
            },
        );

        expect(mockConnectionSave).toHaveBeenCalledTimes(1);

        expect(mockNotificationConstructor).toHaveBeenCalledWith({
            message: 'accepted your request',
            toUserId: 'user456',
            fromUserId: 'user123',
            notificationType: 'requestAccept',
        });

        expect(mockNotificationSave).toHaveBeenCalledTimes(1);

        expect(mockNotificationPopulate).toHaveBeenCalledWith({
            path: 'fromUserId',
            select: 'userName fullName profilePic',
        });

        expect(mockUserFindByIdAndUpdate).toHaveBeenNthCalledWith(
            1,
            'user123',
            {
                $inc: {
                    followersCount: 1,
                },
            },
            {
                new: true,
            },
        );

        expect(mockUserFindByIdAndUpdate).toHaveBeenNthCalledWith(
            2,
            'user456',
            {
                $inc: {
                    followingsCount: 1,
                },
            },
            {
                new: true,
            },
        );

        expect(mockConnectionFindOne).toHaveBeenNthCalledWith(
            2,
            {
                fromUserId: 'user123',
                toUserId: 'user456',
            },
            {
                _id: 0,
                status: 1,
            },
        );

        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith({
            message: "You have accepted Jane Doe's follow request",
            userData: expect.objectContaining({
                _id: 'user456',
                fullName: 'Jane Doe',
                profilePic: null,
                followingsCount: 1,
            }),
            connectionData: {
                status: 'accepted',
            },
            revConnectionData: expect.objectContaining({
                status: 'accepted',
            }),
        });
    });

    it('should generate a signed URL when the user has a profile picture', async () => {
        mockUserFindByIdAndUpdate
            .mockReset()
            .mockResolvedValueOnce({
                _id: 'user123',
                followersCount: 1,
            })
            .mockReturnValueOnce({
                select: jest.fn().mockResolvedValue({
                    _id: 'user456',
                    fullName: 'Jane Doe',
                    profilePic: 'profile-images/jane.jpg',
                    followingsCount: 1,
                }),
            });

        await acceptConnection(req, res);

        expect(mockGenerateSignedUrl).toHaveBeenCalledWith('profile-images/jane.jpg');

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                userData: expect.objectContaining({
                    profilePic: 'https://signed-url.com/profile.jpg',
                }),
            }),
        );
    });

    it('should emit socket event when receiver is connected', async () => {
        mockGetReceiverSocketId.mockReturnValue('socket123');

        await acceptConnection(req, res);

        expect(mockGetReceiverSocketId).toHaveBeenCalledWith('user456');

        expect(mockEmit).toHaveBeenCalledWith(
            'requestAccepted',
            expect.objectContaining({
                fromUserId: 'user123',
                connectionData: expect.anything(),
                revConnectionData: expect.anything(),
            }),
        );
    });

    it('should return 500 when a dependency fails', async () => {
        mockUserFindById.mockRejectedValue(new Error('Database error'));

        await acceptConnection(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });
    });

    it('should return 500 when saving the connection fails', async () => {
        mockConnectionSave.mockRejectedValue(new Error('Connection save error'));

        await acceptConnection(req, res);

        expect(mockConnectionSave).toHaveBeenCalledTimes(1);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });

        expect(mockNotificationSave).not.toHaveBeenCalled();
    });

    it('should return 500 when saving the notification fails', async () => {
        mockNotificationSave.mockRejectedValue(new Error('Notification save error'));

        await acceptConnection(req, res);

        expect(mockNotificationConstructor).toHaveBeenCalledWith({
            message: 'accepted your request',
            toUserId: 'user456',
            fromUserId: 'user123',
            notificationType: 'requestAccept',
        });

        expect(mockNotificationSave).toHaveBeenCalledTimes(1);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });
    });

    it('should return 500 when updating the user fails', async () => {
        mockUserFindByIdAndUpdate.mockReset();

        mockUserFindByIdAndUpdate.mockRejectedValue(new Error('User update error'));

        await acceptConnection(req, res);

        expect(mockUserFindByIdAndUpdate).toHaveBeenCalled();

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });
    });

    it('should return 500 when finding the reverse connection fails', async () => {
        mockConnectionFindOne.mockReset();

        mockConnectionFindOne
            .mockResolvedValueOnce({
                _id: 'connection123',
                fromUserId: 'user456',
                toUserId: 'user123',
                status: 'requested',
                save: mockConnectionSave,
            })
            .mockRejectedValueOnce(new Error('Connection lookup error'));

        await acceptConnection(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Internal server error.',
        });
    });
});
