// Quick poorly made bot for relaying chat
const Discord = require('discord.js')
const { Util } = require('discord.js')
const client = new Discord.Client()
const fs = require('fs');
config = require("./resources/config.json");
config_type = config.septbot;

let channel_local = '769382925283098634';
let channel_global = '769409279496421386';
let relay_category = '770391959432593458'
let vcs_to_relay = [742831212711772265]

const mineflayer = require('mineflayer')

var options = {
    host: "mc.civclassic.com",
    port: 25565,
    username: config_type.username,
    password: config_type.password,
    version: "1.16.1"
};

// todo :
// Auto delete relay channels which have not had activity in X days.
// allow arbitrary DM's
// https://github.com/AnIdiotsGuide/discordjs-bot-guide/blob/master/frequently-asked-questions.md

let bot = mineflayer.createBot(options);
bindEvents(bot);

client.on('ready', () => {
    console.log(`The discord bot logged in! Username: ${client.user.username}!`)
    channel_local = client.channels.cache.get(channel_local);
    channel_global = client.channels.cache.get(channel_global);
    relay_category = client.channels.cache.get(relay_category)
})

client.on('message', message => {
    if (!(message.channel.type === "text" && message.channel.parent !== null && message.channel.parent.id === relay_category.id)
    && (message.channel.id !== channel_local.id) && (message.channel.id !== channel_global.id)) {
            return
    }
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
    fs.readFileSync('resources/newfriend_channels.txt', 'utf-8').split(/\r?\n/).forEach(function(line){
        if (line.split(" ")[0] === message.channel.id ) {
            bot.chat(`/tell ${line.split(" ")[1]} ${clean_message}`)
        }
    })
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
            console.log('Will retry to connect in 30 seconds.');
            setTimeout(relog, 30000);
        }
    });

    bot.on('end', function() {
        console.log("Bot has ended");
        fs.readFileSync('resources/newfriend_channels.txt', 'utf-8').split(/\r?\n/).forEach(function(line){
            let player_channel = client.channels.cache.get(line.split(" ")[0]);
            if (player_channel != undefined && player_channel.name .includes("🟢")) {
                let sanitized_username = line.split[1].toLowerCase().replace(/[^a-z\d-]/,"");
                player_channel.setName(sanitized_username)
            }
        })
        setTimeout(relog, 6 * 1000);
    });

    bot.on('message', async(jsonMsg, position) => {
        let group_chat = jsonMsg.toString().match(/\[(\S+)\] (\S+): (.+)/)
        let local_chat = jsonMsg.toString().match(/^<(\S+)> (.+)/);
        let death_message = jsonMsg.toString().match(/^(\S+) was killed by (\S+) (?:with ){1,2}(.+)/);
        let new_player = jsonMsg.toString().match(/^(\S+) is brand new!/);
        let private_message = jsonMsg.toString().match(/^From (\S+): (.+)/);
        let joined_game = jsonMsg.toString().match(/^(\S+) has joined the game/);
        let left_game = jsonMsg.toString().match(/^(\S+) has left the game/);
        // todo : parse for discord commands (eg. %respond)

        if (group_chat) {
            if (group_chat[2] === bot.username) return;
            if (group_chat[1] === "!") {
                channel_global.send(`\`[${group_chat[1]}]\` [**${group_chat[2]}**] ${Util.removeMentions(group_chat[3])}`);
            }
        } else if (local_chat) {
            channel_local.send(`[**${local_chat[1]}**] ${Util.removeMentions(local_chat[2])}`);
        } else if (death_message) {
            channel_local.send(`**${death_message[1]}** was killed by **${death_message[2]}** with ${death_message[3]}`);
        } else if (new_player) {
            let sanitized_username = new_player[1].toLowerCase().replace(/[^a-z\d-]/,"");
            let channel_options = {
                topic: 'A channel to message ' + new_player[1],
                parent : relay_category,
            }
            let new_channel = await relay_category.guild.channels.create(sanitized_username, channel_options)
            let prompt;
            if (Math.floor(Math.random() * 4) + 1 !== 3) {
                await new_channel.send("This relay was randomly selected as __serious__. Please do not harass the newfriend.");
                prompt = getRandomLine('resources/message_prompts');
            } else {
                await new_channel.send("This relay was randomly selected as __meme__.");
                prompt = getRandomLine('resources/message_prompts_meme');
            }
            bot.chat(`/tell ${new_player[1]} ${prompt}`);
            await new_channel.send(`\`${prompt}\``);
            fs.appendFileSync('resources/newfriend_channels.txt', new_channel.id + " " + new_player[1] + "\n");
        } else if (private_message) {
            fs.readFileSync('resources/newfriend_channels.txt', 'utf-8').split(/\r?\n/).forEach(function(line){
                if (line.split(" ")[1] ===  private_message[1]) {
                    let player_channel = client.channels.cache.get(line.split(" ")[0]);
                    player_channel.send(`[**${private_message[1]}**] ${Util.removeMentions(private_message[2])}`);
                }
            })
        } else if (joined_game) {
            fs.readFileSync('resources/newfriend_channels.txt', 'utf-8').split(/\r?\n/).forEach(function(line){
                if (line.split(" ")[1] === joined_game[1]) {
                    console.log("matching");
                    let player_channel = client.channels.cache.get(line.split(" ")[0]);
                    let sanitized_username = joined_game[1].toLowerCase().replace(/[^a-z\d-]/,"");
                    //console.log(player_channel.name);
                    //player_channel.setName("bingus")
                    player_channel.send(joined_game[0])
                    player_channel.setName("🟢-" + sanitized_username)//.then(newChannel => console.log(`Channel's new name is ${newChannel.name}`)) .catch(console.error);
                }
            })
        } else if (left_game) {
            fs.readFileSync('resources/newfriend_channels.txt', 'utf-8').split(/\r?\n/).forEach(function(line){
                if (line.split(" ")[1] ===  left_game[1]) {
                    let player_channel = client.channels.cache.get(line.split(" ")[0]);
                    let sanitized_username = left_game[1].toLowerCase().replace(/[^a-z\d-]/,"");
                    console.log("left game")
                    player_channel.send(left_game[0])
                    player_channel.setName(sanitized_username)
                }
            })
        }
    })
}

function relog() {
    console.log("Attempting to reconnect...");
    bot = mineflayer.createBot(options);
    bindEvents(bot);
}

function getRandomLine(filename){
    var data = fs.readFileSync(filename, "utf8");
    var lines = data.split('\n');
    return lines[Math.floor(Math.random()*lines.length)];
}