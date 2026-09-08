require("dotenv").config();

const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

class DatabaseService {
    constructor() {
        this.dbFile = "./FileHost.db";
        this.db = null;
    }

    async start() {
        const dbExists = fs.existsSync(this.dbFile);

        this.db = new sqlite3.Database(this.dbFile, (err) => {
            if (err) {
                console.error("Failed to open database:", err);
                return;
            }
        });

        console.log(dbExists ? "Database opened." : "Database created.");

        this.db.serialize(() => {
			//this.db.run(`DROP TABLE IF EXISTS files`) // for testing
			
			this.db.run(`
				CREATE TABLE IF NOT EXISTS files (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					msg_id INTEGER NOT NULL,
					filename TEXT NOT NULL,
					file_size TEXT NOT NULL DEFAULT '0 B',
					directory TEXT NOT NULL DEFAULT 'NONE',
					encryptionKey TEXT NOT NULL,
					encryptionIV TEXT NOT NULL,
					encryptionTag TEXT NOT NULL,
					uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
				)
			`);
        });
    }

    createFile(msg_id, filename, file_size, directory = "NONE", key, iv, tag) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO files (msg_id, filename, file_size, directory, encryptionKey, encryptionIV, encryptionTag) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [msg_id, filename, file_size, directory, key, iv, tag],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id: this.lastID });
                }
            );
        });
    }

    getFile(id) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT * FROM files WHERE id = ?`,
                [id],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                }
            );
        });
    }

	getFiles(limit = 50, offset = 0, directory) {
		return new Promise((resolve, reject) => {
			const safeLimit = Math.min(limit, 50);

			this.db.all(
				`SELECT id, msg_id, filename, file_size, directory, uploaded_at
				FROM files
				WHERE (? IS NULL OR directory = ?)
				ORDER BY id DESC
				LIMIT ? OFFSET ?`,
				[directory ?? null, directory ?? null, safeLimit, offset],
				(err, rows) => {
					if (err) return reject(err);
					resolve(rows);
				}
			);
		});
	}
	
	getDirectories() {
		return new Promise((resolve, reject) => {
			this.db.all(`SELECT DISTINCT directory FROM files WHERE directory IS NOT NULL`,[],(err, rows) => {
				if (err) return reject(err);
				resolve(rows);
			})
		})
	}
	
	editFile(id, { filename, directory, msgid }) {
		return new Promise((resolve, reject) => {
			const updates = [];
			const params = [];
			if (filename !== undefined) {
				updates.push("filename = ?");
				params.push(filename);
			}
			if (directory !== undefined) {
				updates.push("directory = ?");
				params.push(directory);
			}
			if (msgid !== undefined) {
				//updates.push("msg_id = ?");
				//params.push(msgid);
			}
			if (updates.length === 0) {
				return resolve({ success: false, message: "No fields to update" });
			}
			params.push(id);
			this.db.run(
				`UPDATE files
				SET ${updates.join(", ")}
				WHERE id = ?`,
				params,
				function (err) {
					if (err) return reject(err);

					resolve({
						success: this.changes > 0,
						changes: this.changes
					});
				}
			);
		});
	}
	
	deleteFile(id) {
		return new Promise((resolve, reject) => {
			this.db.run(
				`DELETE FROM files WHERE id = ?`,
				[id],
				function (err) {
					if (err) return reject(err);

					resolve({
						success: this.changes > 0,
						changes: this.changes
					});
				}
			);
		});
	}
}

module.exports = new DatabaseService();