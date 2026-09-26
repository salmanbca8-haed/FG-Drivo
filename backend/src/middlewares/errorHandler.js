/**
 * Centralized Error Handler Middleware
 * Masks sensitive stack traces and credentials in production
 */
function errorHandler(err, req, res, next) {
  console.error('[API Error]', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    user: req.user ? req.user.id : 'anonymous'
  });

  const statusCode = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    success: false,
    error: isProd && statusCode === 500 ? 'Internal Server Error' : err.message || 'An unexpected error occurred.',
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  errorHandler
};
