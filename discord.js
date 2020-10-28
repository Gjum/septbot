const Discord = require('discord.js');
const { Util } = require('discord.js');
const mineflayer = require('mineflayer');

const client = new Discord.Client();

/** @type {{
  "septbot" : {
    "client_token": string,
    "username": string,
    "password": string,
  }
}} */
const config = require("./resources/config.json");
const config_type = config.septbot;

const channel_local_id = '769382925283098634';
const channel_global_id = '769409279496421386';
const vcs_to_relay = [742831212711772265];

var options = {
    host: "mc.civclassic.com",
    port: 25565,
    username: config_type.username,
    password: config_type.password,
    version: "1.16.1",
};

let bot = mineflayer.createBot(options);
bindEvents(bot);

let channel_local, channel_global;
client.on('ready', () => {
    console.log(`The discord bot logged in! Username: ${client.user.username}!`)
    channel_local = client.channels.cache.get(channel_local_id);
    channel_global = client.channels.cache.get(channel_global_id);
})

client.on('message', message => {
    if (message.channel.id !== channel_local.id && message.channel.id !== channel_global.id) return
    if (message.author.id === client.user.id) return
    if (message.content.length > 600) {
        message.react('❌');
        return;
    }
    let clean_message = message.content.replace('§','')
    if (message.channel.id === channel_local.id) {
        bot.chat(`${message.author.username}: ${clean_message}`)
    } else if (message.channel.id === channel_global.id) {
        bot.chat(`/g ! ${message.author.username}: ${clean_message}`)
        message.react('✅');
    }
})

client.on('voiceStateUpdate', (oldMember, newMember) => {
    let newUserChannel = newMember.channel
    let oldUserChannel = oldMember.channel
    if (newUserChannel !== null && !vcs_to_relay.includes(parseInt(newUserChannel.id))) {
        return;
    }
    if(oldUserChannel === null && newUserChannel != null) {
        // todo : Spam protection for repeated reconnections
        if (!newMember.member.user.bot) {
            bot.chat(`[${newMember.member.user.username} joined voicechat!]`)
        }
    }
})

client.login(config_type.client_token)

function bindEvents(bot) {

    bot.on('error', function(err) {
        console.log('Error attempting to reconnect: ' + err.errno + '.');
        if (err.code === undefined) {
            console.log('Invalid credentials OR bot needs to wait because it relogged too quickly.');
            console.log('Will retry to connect in 30 seconds. ');
            setTimeout(relog, 30000);
        }
    });

    bot.on('end', function() {
        console.log("Bot has ended");
        setTimeout(relog, 6 * 1000);
    });

    bot.on('message', (jsonMsg, position) => {
        // todo : parse for discord commands (eg. %respond)
        let group_chat = jsonMsg.toString().match(/\[(\S+)\] (\S+): (.+)/)
        let local_chat = jsonMsg.toString().match(/^<(\S+)> (.+)/);
        let death_message = jsonMsg.toString().match(/^(\S+) was killed by (\S+) (?:with ){1,2}(.+)/);

        if (group_chat) {
            if (group_chat[2] === bot.username) return;
            if (group_chat[1] === "!") {
                channel_global.send(`\`[${group_chat[1]}]\` [**${group_chat[2]}**] ${Util.removeMentions(group_chat[3])}`);
            }
        } else if (local_chat) {
            channel_local.send(`[**${local_chat[1]}**] ${Util.removeMentions(local_chat[2])}`);
        } else if (death_message) {
            channel_local.send(`**${death_message[1]}** was killed by **${death_message[2]}** with ${death_message[3]}`);
        }
    })
}

function relog() {
    console.log("Attempting to reconnect...");
    bot = mineflayer.createBot(options);
    bindEvents(bot);
}
