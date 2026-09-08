require("dotenv").config();

const fs = require("fs");
const { randomUUID } = require("crypto");
const input = require("input");

const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

const SESSION_FILE = "./session.txt";

class TelegramService {
    constructor() {
        const savedSession = fs.existsSync(SESSION_FILE) ? fs.readFileSync(SESSION_FILE, "utf8") : "";

        this.client = new TelegramClient(
            new StringSession(savedSession),
            Number(process.env.apiId),
            process.env.apiHash,
            { connectionRetries: 5 }
        );

        this.loggedIn = false;
        this.savedChat = null;
    }

    async start() {
        await this.client.start({
            phoneNumber: process.env.phoneNumber,
            phoneCode: () => input.text("Code: "),
            onError: console.error
        });

        console.log("Logged in!");

        fs.writeFileSync(SESSION_FILE, this.client.session.save());

        const dialogs = await this.client.getDialogs();
        const dialog = dialogs.find(d => d.entity && d.entity.id && d.entity.id.toString() === process.env.dmID);

        if (!dialog)
            throw new Error("Chat not found in dialogs");

        this.savedChat = dialog;
        this.loggedIn = true;
    }

    async sendEncryptedFile(filePath, caption) {
        return this.client.sendFile(process.env.dmName, { file: filePath, caption });
    }

    async getMessage(id) {
        const msgs = await this.client.getMessages(this.savedChat.entity,{ ids: [Number(id)] });
        return msgs[0];
    }

	async deleteMessage(id, options = {}) {
		const result = await this.client.deleteMessages(
			this.savedChat.entity,
			[Number(id)],
			{
				revoke: true,
				...options
			}
		);

		return result;
	}

    async downloadMedia(media) {
        return this.client.downloadMedia(media, { outputFile: `downloads/${randomUUID()}` });
    }
}

module.exports = new TelegramService();