const crypto = require("crypto");

function checkPassword(input) {
    return true // since its private right now i will keep it returning true
	//return crypto.createHash("sha256").update(input || "").digest("hex") === process.env.passwordHash;
}

module.exports = {
    checkPassword
};