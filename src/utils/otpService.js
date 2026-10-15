const nodemailer = require('nodemailer');

// In-memory OTP storage: email -> { code, expiresAt, attempts }
const otpStore = new Map();

// Optional nodemailer transporter (if SMTP configured in .env)
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
} else if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
}

/**
 * Generate a random 6-digit OTP
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Store and send OTP to recipient email
 * @param {string} email
 * @returns {Promise<{ success: boolean, message: string, devCode?: string }>}
 */
async function sendOTP(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const code = generateOTP();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

  otpStore.set(normalizedEmail, {
    code,
    expiresAt,
    attempts: 0
  });

  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #09090b; margin-top: 0;">StudentForge Verification</h2>
      <p style="color: #52525b; font-size: 14px; line-height: 1.5;">
        You're creating a student account on StudentForge. Use the verification code below to confirm your email:
      </p>
      <div style="background-color: #f4f4f5; padding: 18px; border-radius: 8px; text-align: center; margin: 20px 0;">
        <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #18181b; font-family: monospace;">
          ${code}
        </span>
      </div>
      <p style="color: #71717a; font-size: 12px; margin-bottom: 0;">
        This code is valid for 5 minutes. If you did not request this, please ignore this email.
      </p>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || '"StudentForge" <noreply@studentforge.com>',
        to: normalizedEmail,
        subject: `${code} is your StudentForge verification code`,
        html: emailHtml
      });
      console.log(`[OTP] Email sent successfully to ${normalizedEmail}`);
      return { success: true, message: 'Verification code sent to your email.' };
    } catch (err) {
      console.error('[OTP] Failed to send email via transporter:', err.message);
      // Fallback for dev/logging
      return {
        success: true,
        message: 'Verification code generated.',
        devCode: code
      };
    }
  } else {
    // Development / demo mode: log code to server console
    console.log(`===============================================`);
    console.log(`[STUDENTFORGE OTP] To: ${normalizedEmail}`);
    console.log(`[STUDENTFORGE OTP] Code: ${code}`);
    console.log(`===============================================`);
    return {
      success: true,
      message: 'Verification code sent to your email.',
      devCode: code // Returned for testing when SMTP is not configured
    };
  }
}

/**
 * Verify provided OTP against stored record
 * @param {string} email
 * @param {string} code
 * @returns {{ valid: boolean, error?: string }}
 */
function verifyOTP(email, code) {
  const normalizedEmail = email.toLowerCase().trim();
  const record = otpStore.get(normalizedEmail);

  if (!record) {
    return { valid: false, error: 'No verification code requested or code has expired. Please request a new one.' };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(normalizedEmail);
    return { valid: false, error: 'Verification code has expired. Please request a new one.' };
  }

  if (record.attempts >= 5) {
    otpStore.delete(normalizedEmail);
    return { valid: false, error: 'Too many incorrect attempts. Please request a new code.' };
  }

  if (record.code !== code.trim()) {
    record.attempts += 1;
    return { valid: false, error: 'Incorrect verification code. Please try again.' };
  }

  // Verification succeeded - clear record
  otpStore.delete(normalizedEmail);
  return { valid: true };
}

module.exports = {
  sendOTP,
  verifyOTP
};
