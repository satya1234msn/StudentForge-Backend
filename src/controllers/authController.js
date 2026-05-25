const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
} = require('../utils/jwtHelper');

// Register controller
const register = async (req, res, next) => {
  try {
    const { name, email, password, college, course, year } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Parse year as integer if present
    const parsedYear = year ? parseInt(year, 10) : null;

    // Create the user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        college,
        course,
        year: parsedYear
      }
    });

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    return res.status(201).json({
      message: 'User registered successfully!',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        college: user.college,
        course: user.course,
        year: user.year
      }
    });
  } catch (error) {
    next(error);
  }
};

// Login controller
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    return res.json({
      message: 'Login successful!',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        college: user.college,
        course: user.course,
        year: user.year,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        githubUrl: user.githubUrl,
        behanceUrl: user.behanceUrl,
        linkedinUrl: user.linkedinUrl,
        portfolioUrl: user.portfolioUrl,
        availabilityHours: user.availabilityHours,
        workStyle: user.workStyle,
        reliabilityScore: user.reliabilityScore,
        projectsCompleted: user.projectsCompleted
      }
    });
  } catch (error) {
    next(error);
  }
};

// Token refresh controller
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required.' });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired refresh token.' });
    }

    // Find corresponding user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(401).json({ error: 'User does not exist.' });
    }

    // Generate fresh access token
    const accessToken = generateAccessToken(user.id);

    return res.json({ accessToken });
  } catch (error) {
    next(error);
  }
};

// Logout controller
const logout = async (req, res, next) => {
  // In stateless JWT implementations, client discards token on logout
  return res.json({ message: 'Logged out successfully.' });
};

module.exports = {
  register,
  login,
  refresh,
  logout
};
