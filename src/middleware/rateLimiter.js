const rateLimitWindowMs = 60 * 1000; // 1 minute window
const rateLimitMaxRequests = 100;    // Maximum of 100 requests per minute per IP

const requestRecords = new Map();

const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();

  if (!requestRecords.has(ip)) {
    requestRecords.set(ip, []);
  }

  // Filter timestamps to only keep requests within the active window
  const requestTimestamps = requestRecords.get(ip).filter(
    (timestamp) => now - timestamp < rateLimitWindowMs
  );
  
  requestTimestamps.push(now);
  requestRecords.set(ip, requestTimestamps);

  if (requestTimestamps.length > rateLimitMaxRequests) {
    return res.status(429).json({
      error: 'Too many requests. Please slow down and try again later.'
    });
  }

  next();
};

module.exports = rateLimiter;
