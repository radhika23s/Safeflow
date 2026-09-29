/**
 * Email Service — DEMO MODE
 * ==========================
 * OAuth2 refresh token has expired. Email is non-critical for the fraud demo.
 * All functions are stubbed to no-ops so the server starts cleanly.
 * Re-enable by replacing the stubs with the original nodemailer implementation
 * once a fresh OAuth2 token is obtained.
 */

async function sendEmail(to, subject, text, html) {
    console.log(`[EMAIL STUB] Would send "${subject}" to ${to} (email disabled — OAuth token expired)`);
}

async function sendRegisterEmail(userEmail, name) {
    console.log(`[EMAIL STUB] Welcome email skipped for ${name} <${userEmail}>`);
}

async function sendTransactionEmail(userEmail, name, amount, toaccount) {
    console.log(`[EMAIL STUB] Transaction email skipped for ${name} — ₹${amount} to ${toaccount}`);
}

async function sendtransactionfailedEmail(userEmail, name, amount, toaccount) {
    console.log(`[EMAIL STUB] Failed-txn email skipped for ${name} — ₹${amount} to ${toaccount}`);
}

module.exports = { sendEmail, sendRegisterEmail, sendTransactionEmail, sendtransactionfailedEmail };