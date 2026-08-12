const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('Bot je aktivan!'));
app.listen(process.env.PORT || 3000, () => console.log('Web server je spreman.'));

const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionsBitField, 
    ChannelType,
    MessageFlags
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ================= === PODEŠAVANJA ====================
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    WELCOME_CHANNEL_ID: '1534981849775079435',
    RULES_CHANNEL_ID: '1534981980679180300',
    DONATIONS_CHANNEL_ID: '1534972479687364688',
    TICKET_PANEL_CHANNEL_ID: '1534983734539849950',
    STAFF_ROLE_ID: '1534972198886969434',
    
    CATEGORIES: {
        pitanja: '1534972382379249764',
        donacije: '1534972381032874115',
        staff: '1534972379674181834',
        unban: '1532208430176145439',
        org: '1534972383352328223',
        zalbe: '1535056821088161832',
        cheater: '1535056980690075678'
    },
    
    THUMBNAIL_URL: 'https://i.imgur.com/iswtxsc.png', 
    TICKET_IMAGE_URL: 'https://imgur.com/FOJT2Yo.png'
};
// ======================================================

client.once('ready', () => {
    console.log(`[USPEH] Bot je online kao: ${client.user.tag}`);
});

// 1. WELCOME PORUKA
client.on('guildMemberAdd', async (member) => {
    const channel = member.guild.channels.cache.get(CONFIG.WELCOME_CHANNEL_ID);
    if (!channel) return;

    const welcomeEmbed = new EmbedBuilder()
        .setColor('#00FFFF')
        .setThumbnail(CONFIG.THUMBNAIL_URL)
        .addFields(
            { name: 'Cuba Roleplay', value: `Dobrodošao/la, ${member}, na Cuba Roleplay! Nadamo se da ćeš uživati.` },
            { name: 'Pravila', value: `Sva pravila možete pronaći u kanalu <#${CONFIG.RULES_CHANNEL_ID}>` },
            { name: 'Donacije', value: `Više informacija o donacijama imate u kanalu <#${CONFIG.DONATIONS_CHANNEL_ID}>` },
            { name: 'TICKET', value: `Za bilo kakvu pomoć ili pitanje možete otvoriti ticket u kanalu <#${CONFIG.TICKET_PANEL_CHANNEL_ID}>` }
        )
        .setFooter({ text: 'Cuba Roleplay Team' })
        .setTimestamp();

    await channel.send({ embeds: [welcomeEmbed] });
});

// 2. KOMANDE (!setup-ticket I !close)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!setup-ticket') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

        const ticketPanelEmbed = new EmbedBuilder()
            .setColor('#1E1E1E')
            .setTitle('🎟️ CUBA ROLEPLAY - TICKET SISTEM')
            .setDescription(
                'Klikni na dugme ispod da otvoriš ticket:\n\n' +
                '❓ **Pitanja**\n' +
                '💸 **Donacije**\n' +
                '🛡️ **Prijava za staff**\n' +
                '🔨 **Unban**\n' +
                '👑 **Prijava za Org**\n' +
                '🚩 **Žalbe**\n' +
                '🚫 **Prijava Cheatera**'
            )
            .setImage(CONFIG.TICKET_IMAGE_URL);

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_pitanja').setLabel('Pitanja').setEmoji('❓').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ticket_donacije').setLabel('Donacije').setEmoji('💸').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('ticket_staff').setLabel('Prijava za staff').setEmoji('🛡️').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('ticket_unban').setLabel('Unban').setEmoji('🔨').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('ticket_org').setLabel('Prijava za Org').setEmoji('👑').setStyle(ButtonStyle.Primary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_zalbe').setLabel('Žalbe').setEmoji('🚩').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ticket_cheater').setLabel('Prijava Cheatera').setEmoji('🚫').setStyle(ButtonStyle.Danger)
        );

        await message.channel.send({ embeds: [ticketPanelEmbed], components: [row1, row2] });
        message.delete().catch(() => {});
    }

    if (message.content === '!close') {
        if (!message.member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('Samo članovi Staff tima mogu zatvoriti tiket!');
        }

        await message.channel.send('Tiket će biti obrisan za 5 sekundi...');
        setTimeout(() => {
            message.channel.delete().catch(() => {});
        }, 5000);
    }
});

// 3. RUKOVANJE TIKETIMA
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith('ticket_')) {
        const categoryType = interaction.customId.replace('ticket_', '');
        
        const categoriesData = {
            'pitanja': { name: 'Pitanja / Pomoć', prefix: 'pitanja', catId: CONFIG.CATEGORIES.pitanja },
            'donacije': { name: 'Donacije', prefix: 'donacije', catId: CONFIG.CATEGORIES.donacije },
            'staff': { name: 'Prijava Za Staff', prefix: 'staff', catId: CONFIG.CATEGORIES.staff },
            'unban': { name: 'Zahtev za unban', prefix: 'unban', catId: CONFIG.CATEGORIES.unban },
            'org': { name: 'Prijava Org', prefix: 'prijava-org', catId: CONFIG.CATEGORIES.org },
            'zalbe': { name: 'Žalbe', prefix: 'zalba', catId: CONFIG.CATEGORIES.zalbe },
            'cheater': { name: 'Prijava Cheatera', prefix: 'cheater', catId: CONFIG.CATEGORIES.cheater }
        };

        const selected = categoriesData[categoryType];
        if (!selected) return;

        const cleanUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
        const channelName = `${selected.prefix}-${cleanUsername}`;

        const existingChannel = interaction.guild.channels.cache.find(c => c.name === channelName);
        if (existingChannel) {
            return interaction.reply({ 
                content: `Već imate otvoren ticket u kategoriji **${selected.name}**: ${existingChannel}`, 
                flags: MessageFlags.Ephemeral 
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const targetCategory = interaction.guild.channels.cache.get(selected.catId);

        const ticketChannel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: targetCategory ? targetCategory.id : null,
            permissionOverwrites: [
                {
                    id: interaction.guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel]
                },
                {
                    id: interaction.user.id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel, 
                        PermissionsBitField.Flags.SendMessages, 
                        PermissionsBitField.Flags.AttachFiles,
                        PermissionsBitField.Flags.ReadMessageHistory
                    ]
                },
                {
                    id: CONFIG.STAFF_ROLE_ID,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel, 
                        PermissionsBitField.Flags.SendMessages, 
                        PermissionsBitField.Flags.AttachFiles,
                        PermissionsBitField.Flags.ReadMessageHistory
                    ]
                }
            ]
        });

        const ticketEmbed = new EmbedBuilder()
            .setColor('#00FFFF')
            .setTitle(`🎟️ Tiket - ${selected.name}`)
            .setDescription(`Zdravo ${interaction.user} !\n\nStaff tim će ti odgovoriti uskoro.\nKoristi dugmad ispod ili komandu **!close** za upravljanje tiketom.`)
            .setImage(CONFIG.TICKET_IMAGE_URL);

        const controlButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('claim_ticket')
                .setLabel('Preuzmi tiket')
                .setEmoji('✋')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Zatvori tiket')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({ 
            content: `<@&${CONFIG.STAFF_ROLE_ID}> | Tiket otvorio: ${interaction.user}`,
            embeds: [ticketEmbed], 
            components: [controlButtons] 
        });

        await interaction.editReply({ content: `Vaš ticket (${selected.name}) je uspešno otvoren: ${ticketChannel}` });
    }

    // --- PREUZIMANJE TIKETA ---
    if (interaction.customId === 'claim_ticket') {
        if (!interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID)) {
            return interaction.reply({ 
                content: 'Samo članovi Staff tima mogu preuzeti tiket!', 
                flags: MessageFlags.Ephemeral 
            });
        }

        // Ažuriramo dugme na poruci da postane onemogućeno (disabled)
        const originalRow = interaction.message.components[0];
        const updatedRow = new ActionRowBuilder();

        originalRow.components.forEach(component => {
            const button = ButtonBuilder.from(component);
            if (button.data.custom_id === 'claim_ticket') {
                button.setDisabled(true);
                button.setLabel(`Preuzeo/la: ${interaction.user.username}`);
            }
            updatedRow.addComponents(button);
        });

        await interaction.update({ components: [updatedRow] });
        await interaction.followUp({ content: `✋ Tiket je preuzeo/la ${interaction.user}.` });
    }

    // --- ZATVARANJE TIKETA ---
    if (interaction.customId === 'close_ticket') {
        await interaction.reply({ content: 'Tiket će biti obrisan za 5 sekundi...' });
        setTimeout(() => {
            interaction.channel.delete().catch(() => {});
        }, 5000);
    }
});

client.login(CONFIG.TOKEN);
