ANMALASS Baileys

A powerful enhanced WhatsApp Web API library.

""Version" (https://img.shields.io/badge/version-1.0.0--beta.1-blue)"
""License" (https://img.shields.io/badge/license-MIT-green)"
""Module" (https://img.shields.io/badge/module-ESM-orange)"

ANMALASS Baileys is an independent Baileys-based fork that extends WhatsApp Web API capabilities with enhanced messaging, interactive features, protocol utilities, and session management.

Features

- WhatsApp Web socket connection
- Pairing code authentication
- Multi-file authentication state
- Advanced messaging utilities
- Native Flow and Type 6
- Button V2 and carousel
- Newsletter APIs
- LID mapping
- Jadibot session management
- Automatic reconnection
- Self-healing and runtime monitoring
- Extended protocol utilities

Installation

npm install @anmalass/baileys

Basic Usage

import makeWASocket, {
    useMultiFileAuthState
} from '@anmalass/baileys'

const { state, saveCreds } = await useMultiFileAuthState('./auth')

const sock = makeWASocket({
    auth: state
})

sock.ev.on('creds.update', saveCreds)

Default Pairing Code

ANMALYAA

Custom pairing codes must contain exactly 8 alphanumeric characters.

Package Information

Property| Value
Package| "@anmalass/baileys"
Version| "1.0.0-beta.1"
Module| ESM
Main| "lib/index.js"
Types| "lib/index.d.ts"
License| MIT

Development

npm install
npm run build
npm test
npm run lint

Disclaimer

ANMALASS Baileys is an independent community fork and is not affiliated with or endorsed by WhatsApp or Meta.

This is a beta release. Live WhatsApp compatibility and all extended features have not been fully verified. Use an isolated test account before production deployment.

Based on the Baileys ecosystem. Original copyright notices, upstream attribution, and applicable license terms are retained.

See "LICENSE" (LICENSE) for details.
