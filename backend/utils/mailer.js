'use strict';

// Sends email through SMTP (Gmail App Password, Mailtrap, ...).
// Without SMTP: development prints the message to the console; production refuses to send.
function createMailer({ host, port = 587, user, pass, from, production = false } = {}, logger = console) {
  if (host && user && pass) {
    const nodemailer = require('nodemailer');
    const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    return {
      configured: true,
      send: ({ to, subject, text }) => transport.sendMail({ from: from || user, to, subject, text }),
    };
  }
  if (production) {
    return { configured: false, async send() { throw new Error('SMTP is not configured.'); } };
  }
  return {
    configured: true,
    async send({ to, subject, text }) {
      logger.log(`[DEV MAIL - chưa cấu hình SMTP] To: ${to} | ${subject}\n${text}`);
    },
  };
}

module.exports = { createMailer };
