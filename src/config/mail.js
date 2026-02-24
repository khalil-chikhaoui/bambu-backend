import nodemailer from "nodemailer";

export const getTransporter = () => {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,         
    secure: false, 
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });
};

const emailWrapper = (content, footerNote) => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #212c25; line-height: 1.6; font-size: 15px; max-width: 650px; margin: 0; padding: 20px;">
    
    <div style="padding-bottom: 30px;">
      ${content}
    </div>
    
    <hr style="border: none; border-top: 1px solid #e1e7e3; margin: 0 0 20px 0;" />
    <div style="font-size: 12px; color: #5f7564; line-height: 1.5;">
      <p style="margin: 0 0 8px 0;">${footerNote}</p>
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} Bambu Strategic Consulting. All rights reserved.</p>
    </div>
  </div>
`;

// Reusable Signature using exact Brand colors
const getDefaultSignature = (language) => {
  const isFr = language === "fr";
  const tagline = isFr ? "Conseil Stratégique" : "Strategic Consulting";

  return `
    <div style="margin-top: 40px; padding-top: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table style="border-collapse: collapse; margin: 0;">
        <tr>
          <td style="padding-right: 15px; border-right: 2px solid #027800; vertical-align: middle;">
            <strong style="color: #027800; font-size: 18px; letter-spacing: 1px; margin: 0;">BAMBU</strong><br/>
            <span style="color: #5f7564; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">${tagline}</span>
          </td>
          <td style="padding-left: 15px; font-size: 13px; color: #35443a; line-height: 1.5; vertical-align: middle;">
            <a href="https://bambu-services.com" style="color: #027800; text-decoration: none; font-weight: 500;">bambu-services.com</a><br/>
            <a href="mailto:contact@bambu-services.com" style="color: #35443a; text-decoration: none;">contact@bambu-services.com</a><br/>
            <span style="color: #5f7564;">+49 174 9568415</span>
          </td>
        </tr>
      </table>
    </div>
  `;
};

const contactSubjectLables = {
  volunteer: "Volunteer (Bénévole)",
  application: "Application (Candidature)",
  partnership: "Partnership (Partenariat)",
  info: "Information (Informations)",
  service: "Service (Prestation)",
  other: "Other (Autre)"
};

export const getContactTemplates = (data) => {
  const { firstName, lastName, subject, message, language, email } = data;
  const isFr = language === "fr";

  const doNotReplyNote = isFr
    ? "Ceci est un e-mail automatique, merci de ne pas y répondre."
    : "This is an automated email, please do not reply.";

  const adminFooterNote = "Bambu System Notification - Internal Use Only.";
  const displaySubject = contactSubjectLables[subject] || subject;

  return {
    // ---------------------------------------------------------
    // 1. FOR THE USER (With Signature)
    // ---------------------------------------------------------
    user: {
      subject: isFr
        ? "Bambu - Accusé de réception de votre message"
        : "Bambu - We have received your message",
      html: emailWrapper(`
        <p style="margin-top: 0;">${isFr ? `Bonjour ${firstName},` : `Dear ${firstName},`}</p>
        
        <p>${
          isFr
            ? "Nous vous remercions d'avoir contacté Bambu."
            : "Thank you for contacting Bambu."
        }</p>
        
        <p>${
          isFr
            ? "Nous avons bien reçu votre message. Notre équipe va l'examiner attentivement et reviendra vers vous dans les plus brefs délais."
            : "We have successfully received your message. Our team will review your inquiry and get back to you as soon as possible."
        }</p>
        
        ${getDefaultSignature(language)}
      `, doNotReplyNote),
    },

    // ---------------------------------------------------------
    // 2. FOR THE ADMIN (No signature needed)
    // ---------------------------------------------------------
    admin: {
      subject: `New Contact message: ${displaySubject} from ${firstName} ${lastName}`,
      html: emailWrapper(`
        <h3 style="margin-top: 0; color: #050a05; font-size: 18px;">New Contact Submission</h3>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e1e7e3; width: 100px; color: #5f7564; font-weight: 500;">Name:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #e1e7e3; color: #050a05; font-weight: 600;">${firstName} ${lastName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e1e7e3; color: #5f7564; font-weight: 500;">Email:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #e1e7e3; color: #027800;"><a href="mailto:${email}" style="color: #027800; text-decoration: none;">${email}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e1e7e3; color: #5f7564; font-weight: 500;">Subject:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #e1e7e3; color: #050a05;">${displaySubject}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e1e7e3; color: #5f7564; font-weight: 500;">Language:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #e1e7e3; color: #050a05; text-transform: uppercase;">${language}</td>
          </tr>
        </table>
        
        <h4 style="margin: 0 0 10px 0; color: #026300; font-size: 14px;">Message:</h4>
        <div style="background-color: #f6f8f6; border: 1px solid #e1e7e3; border-radius: 6px; padding: 15px; color: #212c25; white-space: pre-wrap; font-family: inherit;">${message}</div>
      `, adminFooterNote),
    },
  };
};