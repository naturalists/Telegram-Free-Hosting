require('dotenv').config();

const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { randomUUID } = require("crypto");

const telegram = require("./telegram");
const database = require("./db");
const { checkPassword } = require("./auth");
const { formatBytes } = require("./utils");

const app = express();
const upload = multer({ dest: "./uploads" });

telegram.start().catch(console.error);
database.start().catch(console.error)

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
	if (!checkPassword(req.query.pass)) return res.status(403).send({password: checkPassword(req.query.pass)});
	res.sendFile("index.html",{root:"./public"})
});

app.get('/files', (req, res) => {
	if (!checkPassword(req.query.pass)) return res.status(403).send({password: checkPassword(req.query.pass)});
	res.sendFile("files.html",{root:"./public"})
});

app.get('/api/files', async(req, res) => {
	if (!checkPassword(req.query.pass)) return res.status(403).send({password: checkPassword(req.query.pass)});
	res.json(await database.getFiles(req.query.limit || 50, req.query.offset || 0, req.query.directory))
})

app.get('/api/directories', async (req, res) => {
	if (!checkPassword(req.query.pass)) return res.status(403).send({password: checkPassword(req.query.pass)});
	res.json((await database.getDirectories()).map(r => r.directory))
});

app.put('/api/files/:id', async(req, res) => {
	if (!checkPassword(req.query.pass)) return res.status(403).send({password: checkPassword(req.query.pass)});
	try {
		res.json(await database.editFile(req.params.id,req.body));
	} catch(err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
	}
})

app.delete('/api/files/:id', async(req, res) => {
	if (!checkPassword(req.query.pass)) return res.status(403).send({password: checkPassword(req.query.pass)});
	try {
		const filedata = await database.getFile(req.params.id)
		telegram.deleteMessage(filedata.msg_id)
		res.json(await database.deleteFile(req.params.id))
	} catch(err) {
		res.status(500).json({
			success: false,
			error: err.message
		})
	}
})

app.post("/upload", upload.single("file"), async (req, res) => {
	if (!checkPassword(req.body.pass) || !telegram.loggedIn || !req.file) return res.status(403).send({pass: checkPassword(req.body.pass), loggedin: telegram.loggedIn, file: req.file == null});
	try {
		const target = path.join('./uploads', randomUUID());
		fs.renameSync(req.file.path, target);
		const input = fs.createReadStream(target);
		const output = fs.createWriteStream(target + '.enc');
		const key = crypto.randomBytes(32);
		const iv = crypto.randomBytes(12);
		const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
		input.pipe(cipher).pipe(output);
		output.on('finish', async() => {
			try {
				fs.unlinkSync(target)
				const tag = cipher.getAuthTag().toString("hex")
				const file = await telegram.sendEncryptedFile(target + ".enc", req.ip);
				console.log(formatBytes(req.file.size))
				database.createFile(file.id, req.body.filename || req.file.originalname, formatBytes(req.file.size), req.body.directory || "NONE", key.toString('hex'), iv.toString('hex'), tag)
				if(req.query.response)
				{
					res.json({success: true, id: file.id})
				} else {
					res.redirect(`/files?pass=${req.body.pass}`)
				}
				fs.unlinkSync(target + ".enc")
			} catch(err) {
				console.log(err)
				res.send(err)
				fs.unlinkSync(target + ".enc")
			}
		});
	} catch(err) {
        console.error(err);
        res.status(500).send(err);
	}
});

app.get("/download", async (req, res) => {
	if (!checkPassword(req.query.pass) || !telegram.loggedIn || telegram.savedChat == null || !req.query.id) return res.status(403).send({pass: checkPassword(req.query.pass), loggedin: telegram.loggedIn, savedchat: telegram.savedChat != null, id: req.query.id != null});
	try {
		const filedata = await database.getFile(req.query.id)
		const msg = await telegram.getMessage(filedata.msg_id);
		const path = await telegram.downloadMedia(msg.media);
		const input = fs.createReadStream(path);
		const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(filedata.encryptionKey, 'hex'), Buffer.from(filedata.encryptionIV, 'hex'));
		decipher.setAuthTag(Buffer.from(filedata.encryptionTag, 'hex'));
		decipher.on('error', err => {
			res.destroy(err);
		});
		outputpath = `downloads/${randomUUID()}`;
		input.pipe(decipher).pipe(fs.createWriteStream(outputpath)).on('finish', () => {
			res.download(outputpath, filedata.filename, () => {
				fs.unlinkSync(outputpath);
			});
		});
	} catch(err) {
		console.log(err)
		res.status(404).send("File not found")
	};
});

app.listen(830, () => console.log('Server running on http://localhost:830'));