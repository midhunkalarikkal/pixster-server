import { isDev } from '../utils/constants.js';

export const errorHandler = (error, req, res, _next) => {
    if (isDev) {
        console.error('Error:', error);
    }

    return res.status(500).json({
        message: 'Internal server error.',
    });
};
