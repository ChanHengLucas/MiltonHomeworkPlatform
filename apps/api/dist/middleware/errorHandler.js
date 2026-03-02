"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
function errorHandler(logger) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return (err, req, res, _next) => {
        const status = err.statusCode ?? 500;
        const requestId = String(req.id ?? '');
        if (status >= 500) {
            logger.error({ err: err.stack, requestId }, '[API] Unexpected error');
        }
        else {
            logger.warn({ err: err.message, requestId }, '[API] Validation/client error');
        }
        res.status(status).json({
            error: err.message ?? 'Internal server error',
            ...(requestId && { requestId }),
            ...(status >= 500 && process.env.NODE_ENV === 'development' && { stack: err.stack }),
        });
    };
}
