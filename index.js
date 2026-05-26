const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');

// 1. Render Port Binding (Server ko active rakhne ke liye)
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.write("AR Eid Assistant is Active!");
    res.end();
}).listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

// Cooldown Set (Ek bande ko baar baar reply jane se rokne ke liye)
const repliedUsers = new Set();
const phoneNumber = "923282937448"; 

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const client = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false // Pairing code use kar rahe hain is liye QR false hai
    });

    // 2. Pairing Code Logic
    if (!client.authState.creds.registered) {
        console.log(`\n⏳ Pairing code generate ho raha hai number ${phoneNumber} ke liye...\n`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 sec wait
        
        try {
            let code = await client.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join('-') || code;
            console.log(`\n====================================`);
            console.log(`👉 AAPKA WHATSAPP PAIRING CODE HAI: ${code.toUpperCase()}`);
            console.log(`====================================\n`);
        } catch (err) {
            console.error('Pairing code generate karne mein error aaya: ', err);
        }
    }

    client.ev.on('creds.update', saveCreds);

    // Connection Status Handler
    client.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed, reconnecting: ', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ AR Eid Assistant successfully connected via Pairing Code!');
        }
    });

    // Message Handler
    client.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const isGroup = sender.endsWith('@g.us');
        const textMsg = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();

        // Keywords
        const eidKeywords = ['eid', 'mubarak'];
        const hasEidKeyword = eidKeywords.some(word => textMsg.includes(word));

        // Cooldown check
        if (repliedUsers.has(sender)) return;

        // 🛑 PERSONAL CHAT LOGIC
        if (!isGroup && hasEidKeyword) {
            repliedUsers.add(sender);
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 Seconds Delay
            
            const personalMsg = `*🌙 Khair Mubarak!* ❤️\n\nAap ko aur aap ki family ko *Eid ul Adha* ki bohat bohat mubarak ho. Allah aap ki zindagi me khushiyan, sehat aur barkat ata farmaye. ✨\n\n_Yeh ek automated AI response hai. Main kaafi dino se offline hoon aur filhal maine apne WhatsApp ka control AI system ko diya hua hai, is liye tamam messages automatically manage ho rahe hain. 🤍_`;
            
            await client.sendMessage(sender, { text: personalMsg });
        }

        // 🛑 GROUP CHAT LOGIC
        if (isGroup && hasEidKeyword) {
            const targetNames = ['abdullah', 'abdullah rajpar', 'abdullah bhai'];
            const isTargeted = targetNames.some(name => textMsg.includes(name));

            if (isTargeted) {
                repliedUsers.add(sender);
                await new Promise(resolve => setTimeout(resolve, 3000)); // 3 Seconds Delay
                
                const groupMsg = `*🌙 Khair Mubarak!* ❤️\n\nBohat shukriya yaad rakhne ke liye! Aap sab ko bhi meri taraf se *Eid ul Adha Mubarak*. Allah aap sab ki ibadat aur qurbani qubool farmaye. ✨\n\n_Yeh ek automated AI response hai, taake koi msg miss na ho._`;
                
                await client.sendMessage(sender, { text: groupMsg });
            }
        }
    });
}

// Start bot
startBot();

