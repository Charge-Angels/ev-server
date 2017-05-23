var Utils = require('../utils/Utils');
const nodemailer = require('nodemailer');

// https://nodemailer.com/smtp/
class EMail {
  constructor() {
    // Email
    this._emailConfig = Utils.getEmailConfig();

    // Set
    let nodeMailerParams = {
      host: this._emailConfig.smtp.host,
      port: this._emailConfig.smtp.port,
      secure: this._emailConfig.smtp.secure
    };
  
    // Credentials provided?    
    if (this._emailConfig.smtp.user) {
      // Add
      nodeMailerParams.auth = {
        user: this._emailConfig.smtp.user,
        pass: this._emailConfig.smtp.password
      };
    }

    // create reusable transporter object using the default SMTP transport
    this._transporter = nodemailer.createTransport(nodeMailerParams);
  }

  sendEmail(email) {
    // In promise
    return new Promise((fulfill, reject) => {
      // Call
      this._transporter.sendMail({
         from: (!email.from?this._emailConfig.from:email.from),
         to: email.to,
         cc: email.cc,
         bcc: (!email.cc?this._emailConfig.bcc:email.cc),
         subject: email.subject,
         text: email.text,
         html: email.html
      }, (err, info) => {
        console.log(err);
        console.log(info);
        // Error Handling
        if (err) {
          reject(err);
        } else {
          fulfill(info);
        }
      });
    });
  }
}

module.exports = EMail;
