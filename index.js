require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    SlashCommandBuilder,
    REST,
    Routes
} = require('discord.js');

const sqlite3 = require('sqlite3').verbose();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = '1503768728503058593';
const OWNER_ID = '1271802666044887154';

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const db = new sqlite3.Database('./duty.db');

// ====================== DATABASE ======================
db.run(`
    CREATE TABLE IF NOT EXISTS duties (
        userId TEXT PRIMARY KEY,
        username TEXT,
        totalTime INTEGER DEFAULT 0,
        startTime INTEGER DEFAULT 0,
        onDuty INTEGER DEFAULT 0
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS permissions (
        userId TEXT PRIMARY KEY,
        username TEXT,
        canWarn INTEGER DEFAULT 0
    )
`);

// ====================== READY ======================
client.once('ready', () => {
    console.log(`✅ Ulogovan kao ${client.user.tag}`);
});

// ====================== FORMAT TIME ======================
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
}

// ====================== INTERACTIONS ======================
client.on('interactionCreate', async interaction => {

    // ==================== BUTTONS ====================
    if (interaction.isButton()) {
        const userId = interaction.user.id;
        const username = interaction.user.username;
        const now = Math.floor(Date.now() / 1000);

        // START DUTY
        if (interaction.customId === 'start_duty') {
            db.get(`SELECT * FROM duties WHERE userId = ?`, [userId], (err, row) => {
                if (err) return console.error(err);

                if (!row) {
                    db.run(`INSERT INTO duties (userId, username, startTime, onDuty) VALUES (?, ?, ?, 1)`, [userId, username, now]);
                } else {
                    if (row.onDuty === 1) return interaction.reply({ content: '❌ Već si na dužnosti!', ephemeral: true });
                    db.run(`UPDATE duties SET startTime = ?, onDuty = 1, username = ? WHERE userId = ?`, [now, username, userId]);
                }

                const embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle('🟢 ULAZAK NA DUŽNOST')
                    .setDescription(`**${username}** je ušao na dužnost.`);

                interaction.reply({ embeds: [embed] });
            });
        }

        // END DUTY
        if (interaction.customId === 'end_duty') {
            db.get(`SELECT * FROM duties WHERE userId = ?`, [userId], (err, row) => {
                if (err) return console.error(err);
                if (!row || row.onDuty === 0) return interaction.reply({ content: '❌ Nisi na dužnosti!', ephemeral: true });

                const session = now - row.startTime;
                const newTotal = row.totalTime + session;

                db.run(`UPDATE duties SET totalTime = ?, onDuty = 0 WHERE userId = ?`, [newTotal, userId]);

                const embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('🔴 IZLAZAK SA DUŽNOSTI')
                    .setDescription(`**${username}** je izašao sa dužnosti.\n⏱️ Vrijeme: ${formatTime(session)}`);

                interaction.reply({ embeds: [embed] });
            });
        }
    }

    // ==================== SLASH COMMANDS ====================
    if (interaction.isChatInputCommand()) {

        // /poruka
        if (interaction.commandName === 'poruka') {
            if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: '❌ Nemaš permisiju.', ephemeral: true });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('start_duty').setLabel('Uđi na dužnost').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('end_duty').setLabel('Izađi sa dužnosti').setStyle(ButtonStyle.Danger)
            );

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('👮 SISTEM DUŽNOSTI')
                .setDescription('Klikni dugme ispod da započneš ili završiš dužnost.');

            return interaction.reply({ embeds: [embed], components: [row] });
        }

        // /scoreboard
        if (interaction.commandName === 'scoreboard') {
            db.all(`SELECT * FROM duties ORDER BY totalTime DESC LIMIT 10`, [], (err, rows) => {
                let desc = 'Nema podataka.';
                if (rows && rows.length > 0) {
                    desc = rows.map((r, i) => `#${i+1} - ${r.username} • ${formatTime(r.totalTime)}`).join('\n');
                }
                const embed = new EmbedBuilder()
                    .setColor(0xFFD700)
                    .setTitle('🏆 TOP 10 AKTIVNIH')
                    .setDescription(desc);
                interaction.reply({ embeds: [embed] });
            });
        }

        // /dodajsate
        if (interaction.commandName === 'dodajsate') {
            if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: '❌ Samo vlasnik može koristiti ovu komandu.', ephemeral: true });

            const target = interaction.options.getUser('korisnik');
            const sati = interaction.options.getInteger('sati');
            const minute = interaction.options.getInteger('minute') || 0;
            const secondsToAdd = (sati * 3600) + (minute * 60);

            db.get(`SELECT totalTime FROM duties WHERE userId = ?`, [target.id], (err, row) => {
                const current = row ? row.totalTime : 0;
                const newTotal = current + secondsToAdd;

                db.run(`INSERT INTO duties (userId, username, totalTime) VALUES (?, ?, ?) 
                        ON CONFLICT(userId) DO UPDATE SET totalTime = ?, username = ?`,
                    [target.id, target.username, newTotal, newTotal, target.username]);

                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('⏫ Sati dodani')
                    .setDescription(`**${target.username}** je dobio sate.\n**Dodano:** ${sati}h ${minute}m\n**Ukupno:** ${formatTime(newTotal)}`);

                interaction.reply({ embeds: [embed] });
            });
        }

        // /skinisate
        if (interaction.commandName === 'skinisate') {
            if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: '❌ Samo vlasnik može koristiti ovu komandu.', ephemeral: true });

            const target = interaction.options.getUser('korisnik');
            const sati = interaction.options.getInteger('sati');
            const minute = interaction.options.getInteger('minute') || 0;
            const secondsToRemove = (sati * 3600) + (minute * 60);

            db.get(`SELECT totalTime FROM duties WHERE userId = ?`, [target.id], (err, row) => {
                const current = row ? row.totalTime : 0;
                if (current < secondsToRemove) {
                    return interaction.reply({ content: `❌ Korisnik ima samo ${formatTime(current)}!`, ephemeral: true });
                }
                const newTotal = current - secondsToRemove;

                db.run(`UPDATE duties SET totalTime = ? WHERE userId = ?`, [newTotal, target.id]);

                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('⏬ Sati skinuti')
                    .setDescription(`**${target.username}** je ostao bez sati.\n**Skinuto:** ${sati}h ${minute}m\n**Novo ukupno:** ${formatTime(newTotal)}`);

                interaction.reply({ embeds: [embed] });
            });
        }

        // /dajpermisije
        if (interaction.commandName === 'dajpermisije') {
            if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: '❌ Samo vlasnik.', ephemeral: true });

            const target = interaction.options.getUser('korisnik');
            db.run(`INSERT INTO permissions (userId, username, canWarn) VALUES (?, ?, 1)
                   ON CONFLICT(userId) DO UPDATE SET canWarn = 1, username = ?`,
                [target.id, target.username, target.username]);

            interaction.reply({ content: `✅ **${target.username}** sada ima permisije za opomene.`, ephemeral: true });
        }

        // /opomena i /opomena2
        if (interaction.commandName === 'opomena' || interaction.commandName === 'opomena2') {
            const isPredOtkaz = interaction.commandName === 'opomena2';

            const hasPerm = interaction.user.id === OWNER_ID ||
                await new Promise(resolve => {
                    db.get(`SELECT canWarn FROM permissions WHERE userId = ?`, [interaction.user.id], (err, row) => {
                        resolve(row && row.canWarn === 1);
                    });
                });

            if (!hasPerm) return interaction.reply({ content: '❌ Nemaš permisiju za slanje opomena.', ephemeral: true });

            const target = interaction.options.getUser('korisnik');
            const trajanje = interaction.options.getString('trajanje');
            const razlog = interaction.options.getString('razlog');

            const embed = new EmbedBuilder()
                .setColor(isPredOtkaz ? 0xFF0000 : 0xFFAA00)
                .setTitle(isPredOtkaz ? "🚨 OPOMENA PRED OTKAZ" : "⚠️ OPOMENA")
                .setDescription(
                    `━━━━━━━━━━━━━━━━━━\n` +
                    `👤 **Igrač koji dobija opomenu:** ${target}\n` +
                    `📄 **Trajanje opomene:** ${trajanje}\n` +
                    `📝 **Razlog opomene:** ${razlog}\n` +
                    `👮 **Tko daje opomenu:** ${interaction.user}\n` +
                    `━━━━━━━━━━━━━━━━━━`
                )
                .setTimestamp();

            interaction.reply({ embeds: [embed] });
        }
    }
});

// ====================== REGISTER COMMANDS ======================
const commands = [
    new SlashCommandBuilder().setName('poruka').setDescription('Prikaži duty panel'),
    new SlashCommandBuilder().setName('scoreboard').setDescription('Top 10 aktivnih'),
    new SlashCommandBuilder()
        .setName('dodajsate')
        .setDescription('Dodaj sate dužnosti')
        .addUserOption(o => o.setName('korisnik').setDescription('Korisnik').setRequired(true))
        .addIntegerOption(o => o.setName('sati').setDescription('Koliko sati').setRequired(true).setMinValue(1))
        .addIntegerOption(o => o.setName('minute').setDescription('Koliko minuta').setRequired(false).setMinValue(0).setMaxValue(59)),
    new SlashCommandBuilder()
        .setName('skinisate')
        .setDescription('Skini sate dužnosti')
        .addUserOption(o => o.setName('korisnik').setDescription('Korisnik').setRequired(true))
        .addIntegerOption(o => o.setName('sati').setDescription('Koliko sati').setRequired(true).setMinValue(1))
        .addIntegerOption(o => o.setName('minute').setDescription('Koliko minuta').setRequired(false).setMinValue(0).setMaxValue(59)),
    new SlashCommandBuilder()
        .setName('dajpermisije')
        .setDescription('Daj permisije za opomene')
        .addUserOption(o => o.setName('korisnik').setDescription('Korisnik').setRequired(true)),
    new SlashCommandBuilder()
        .setName('opomena')
        .setDescription('Pošalji opomenu')
        .addUserOption(o => o.setName('korisnik').setDescription('Korisnik').setRequired(true))
        .addStringOption(o => o.setName('trajanje').setDescription('Trajanje opomene').setRequired(true))
        .addStringOption(o => o.setName('razlog').setDescription('Razlog').setRequired(true)),
    new SlashCommandBuilder()
        .setName('opomena2')
        .setDescription('Pošalji opomenu pred otkaz')
        .addUserOption(o => o.setName('korisnik').setDescription('Korisnik').setRequired(true))
        .addStringOption(o => o.setName('trajanje').setDescription('Trajanje').setRequired(true))
        .addStringOption(o => o.setName('razlog').setDescription('Razlog').setRequired(true))
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Slash komande registrovane.');
    } catch (err) {
        console.error('❌ Greška pri registraciji komandi:', err);
    }
})();

client.login(TOKEN);