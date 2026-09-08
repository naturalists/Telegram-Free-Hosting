# Telegram Free Hosting

> A lightweight, self-hosted file hosting service that stores encrypted file payloads in Telegram and keeps file metadata in SQLite.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-web%20server-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-metadata-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Telegram](https://img.shields.io/badge/Telegram-storage-26A5E4?logo=telegram&logoColor=white)](https://telegram.org/)

## Overview

**Telegram Free Hosting** is a small self-hosted file server built with Node.js.

Instead of keeping uploaded files permanently on the web server's local filesystem, the application:

1. Receives an upload through a simple web form.
2. Encrypts the file with **AES-256-GCM**.
3. Uploads the encrypted payload to a Telegram chat using Telegram's API client.
4. Stores the Telegram message ID, filename, directory, size, and encryption metadata in **SQLite**.
5. Downloads the encrypted payload from Telegram, decrypts it, and streams the original file back to the user.

A lightweight file manager is included for browsing, filtering, renaming, moving, downloading, and deleting stored files.

## Features

- **Telegram-backed storage** using a user Telegram session.
- **AES-256-GCM encryption** before files are sent to Telegram.
- **SQLite metadata database** for fast file lookup and directory filtering.
- **Browser-based upload UI** with custom filename and directory support.
- **File manager UI** with:
  - directory filtering
  - pagination
  - rename/move actions
  - deletion
  - direct download
- **Persistent Telegram session** stored locally in `session.txt`.
- Simple **Express.js REST-style endpoints** for file management.

## Architecture

```text
                    ┌───────────────────────┐
                    │      Web Browser      │
                    │ Upload / File Manager │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │     Express Server    │
                    │       server.js       │
                    └───────┬───────┬───────┘
                            │       │
               ┌────────────┘       └─────────────┐
               ▼                                  ▼
      ┌─────────────────┐               ┌─────────────────┐
      │ SQLite Database │               │ Telegram Client │
      │      db.js      │               │   telegram.js   │
      └─────────────────┘               └────────┬────────┘
                                                  │
                                                  ▼
                                      ┌─────────────────────┐
                                      │   Telegram Chat /   │
                                      │   Saved Messages*   │
                                      └─────────────────────┘

                     Upload path:
      Browser → Express → AES-256-GCM → Telegram + SQLite

                     Download path:
      Browser → Express → Telegram → AES-256-GCM decrypt → File download
```

\* The project looks up a Telegram dialog using `dmID` and sends files using `dmName`. Configure those values to point at the Telegram chat you want to use as storage.

## Requirements

- Node.js 18 or newer recommended
- A Telegram account
- Telegram API credentials:
  - `apiId`
  - `apiHash`
- A Telegram chat/dialog that the account can access
- A machine/server with persistent local storage for:
  - `FileHost.db`
  - `session.txt`
  - temporary `uploads/`
  - temporary `downloads/`

## Installation

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd Telegram-Free-Hosting-main
```

### 2. Install dependencies

The repository now includes a `package.json`, so install the declared dependencies with:

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
apiId=YOUR_TELEGRAM_API_ID
apiHash=YOUR_TELEGRAM_API_HASH
phoneNumber=YOUR_TELEGRAM_PHONE_NUMBER
dmID=YOUR_STORAGE_CHAT_ID
dmName=YOUR_STORAGE_CHAT_NAME
```

The application reads these variables directly from `process.env`.

### 4. Start the server

```bash
npm start
```

By default, the application listens on:

```text
http://localhost:830
```

On first startup, the Telegram client may prompt you for the login code in the terminal. Once authenticated, the Telegram session is saved to:

```text
session.txt
```

Keep this file private.

## Usage

### Upload a file

Open:

```text
http://localhost:830/
```

Provide:

- an optional filename
- an optional directory
- the file to upload

The server encrypts the file and uploads the encrypted payload to Telegram.

### Manage files

Open:

```text
http://localhost:830/files
```

The file manager supports:

- browsing all files
- filtering by directory
- downloading files
- renaming files
- changing directories
- deleting files

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/` | Upload page |
| `GET` | `/files` | File manager |
| `POST` | `/upload` | Upload and store a file |
| `GET` | `/download?id=...` | Download and decrypt a file |
| `GET` | `/api/files` | List files |
| `GET` | `/api/directories` | List directories |
| `PUT` | `/api/files/:id` | Update filename/directory |
| `DELETE` | `/api/files/:id` | Delete a file |

## Encryption

Uploaded files are encrypted locally before they are sent to Telegram.

The implementation uses:

```text
AES-256-GCM
```

For each uploaded file, the server generates:

- a random 256-bit encryption key
- a random 96-bit IV
- an authentication tag

The resulting encrypted file is uploaded to Telegram, while the encryption metadata is stored in SQLite alongside the Telegram message ID.

### Important security detail

The current implementation stores the encryption key, IV, and authentication tag in the SQLite database. Anyone who gains access to both the database and the Telegram storage account can potentially recover stored files.

The project should therefore be treated as a **self-hosted/private tool**, not as a hardened production storage platform.

## Authentication / Security Status

The access-control function is currently intentionally disabled:

```js
function checkPassword(input) {
    return true;
}
```

### Telegram chat selection

The application:

1. authenticates the Telegram user with the credentials from `.env`
2. loads available dialogs
3. searches for a dialog whose entity ID matches `dmID`
4. uses `dmName` when sending encrypted files

Make sure the configured account has access to the target chat.

### Port

The server currently uses a hard-coded port:

```js
app.listen(830, ...)
```

For deployment flexibility, consider switching this to an environment variable such as:

```env
PORT=830
```
