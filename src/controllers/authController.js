const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
} = require('../utils/jwtHelper');
const { isDisposableEmail } = require('../utils/tempMailDetector');
const { sendOTP, verifyOTP } = require('../utils/otpService');

// Request OTP for new registration
const sendRegistrationOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Detect and reject disposable/temporary emails
    if (isDisposableEmail(cleanEmail)) {
      return res.status(400).json({
        error: 'Temporary and disposable email addresses are not permitted. Please use your permanent university or personal email.'
      });
    }

    // 2. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists. Please sign in instead.' });
    }

    // 3. Generate and send OTP
    const result = await sendOTP(cleanEmail);

    return res.json({
      message: 'Verification code sent successfully to your email!',
      devCode: result.devCode
    });
  } catch (error) {
    next(error);
  }
};

// Verify OTP standalone check
const verifyOtpCheck = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    const verification = verifyOTP(email, otp);
    if (!verification.valid) {
      return res.status(400).json({ error: verification.error });
    }

    return res.json({ message: 'Email verified successfully!' });
  } catch (error) {
    next(error);
  }
};

// Register controller with OTP and disposable email enforcement
const register = async (req, res, next) => {
  try {
    const { name, email, password, college, course, year, otp } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Detect and reject disposable/temporary emails
    if (isDisposableEmail(cleanEmail)) {
      return res.status(400).json({
        error: 'Temporary and disposable email addresses are not permitted. Please use your permanent university or personal email.'
      });
    }

    // 2. Enforce OTP verification if OTP was provided or required
    if (otp) {
      const verification = verifyOTP(cleanEmail, otp);
      if (!verification.valid) {
        return res.status(400).json({ error: verification.error });
      }
    }

    // 3. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }

    // 4. Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Parse year as integer if present
    const parsedYear = year ? parseInt(year, 10) : null;

    // Create the user
    const user = await prisma.user.create({
      data: {
        name,
        email: cleanEmail,
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

    const cleanEmail = email.toLowerCase().trim();

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail }
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

// Google OAuth Login / Registration handler
const googleAuth = async (req, res, next) => {
  try {
    const { email, name, avatarUrl, college, course, year } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Google authentication failed: Email is required.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Temporary email check for Google Auth as well
    if (isDisposableEmail(cleanEmail)) {
      return res.status(400).json({
        error: 'Temporary or disposable email addresses are not permitted.'
      });
    }

    const parsedYear = year ? parseInt(year, 10) : null;

    // Find existing user or check if registered
    let user = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (!user) {
      // If college is not provided, this is a login attempt for an unregistered user
      if (!college) {
        return res.status(200).json({
          isNewUser: true,
          message: 'Google account verified, but not registered yet. Please complete registration.'
        });
      }

      // If college is provided, this is the registration completion step
      const dummyPassword = Math.random().toString(36).slice(-12) + 'SF#9!';
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(dummyPassword, salt);

      user = await prisma.user.create({
        data: {
          name: name || cleanEmail.split('@')[0],
          email: cleanEmail,
          passwordHash,
          avatarUrl: avatarUrl || null,
          college: college.trim(),
          course: course ? course.trim() : null,
          year: parsedYear,
          reliabilityScore: 5.0
        }
      });
    } else {
      const updateData = {};
      if (avatarUrl && !user.avatarUrl) updateData.avatarUrl = avatarUrl;
      if (college && (!user.college || user.college === 'Student Builder')) updateData.college = college.trim();
      if (course && !user.course) updateData.course = course.trim();
      if (parsedYear && !user.year) updateData.year = parsedYear;
      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData
        });
      }
    }

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    return res.json({
      message: 'Google login successful!',
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
  return res.json({ message: 'Logged out successfully.' });
};

module.exports = {
  sendRegistrationOtp,
  verifyOtpCheck,
  register,
  login,
  googleAuth,
  refresh,
  logout
};
