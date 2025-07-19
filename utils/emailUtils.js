const nodemailer = require("nodemailer");
require("dotenv").config();

// Create a transporter object using Brevo's SMTP settings
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST, // Brevo SMTP server
  port: process.env.EMAIL_PORT, // Brevo SMTP port (587 for TLS, 465 for SSL)
  secure: process.env.EMAIL_PORT === "465", // Use true for SSL on port 465
  auth: {
    user: process.env.EMAIL_USER, // Brevo SMTP username
    pass: process.env.EMAIL_PASS, // Brevo SMTP key (password)
  },
});

const sendEmail = (to, subject, htmlContent ) => {
  const mailOptions = {
    from: process.env.SENDING_EMAIL,
    to,
    subject,
    html: htmlContent,
  };

  return transporter
    .sendMail(mailOptions)
    .then((info) => {
      console.log("Email sent:", info.response);
    })
    .catch((error) => {
      console.error("Error sending email:", error);
    });
};

module.exports = sendEmail;
