const fs = require('fs');
const cron = require("cron");
const Discord = require('discord.js');
const { Util } = require('discord.js');
const { MessageAttachment } = require('discord.js')
const { CanvasRenderService } = require('chartjs-node-canvas');
const mineflayer = require('mineflayer');
const prefix = '~'
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
const primary_account = 'MtAugusta';
const trusted_users = [145342519784374272, 214874419301056512];

const channel_local_id = '769382925283098634';
const channel_local_mta_id = '775499408309354517';
const channel_global_id = '769409279496421386';
const channel_snitch_id = '742871763758743574';
const channel_debug_id = '775163751863156757';
const relay_category_id = '770391959432593458';
const info_channel_id = '776520454424231937';
const info_message_id = '776524752604364830';
const bill_channel_id = '756568587669602401';
const law_category_id = '756568405921759492';
const law_backup_channel_id = '778771147536728074';
const vcs_to_relay = [742831212711772265];


let bots = {};

let lastDMSentToPlayer = null;
let lastVCBroadcast = null;
let lastVCJoinBroadcasts = {};
let last_invite_channel = null;
let TPS = null;

let nextChatTs = 0;

multiBot();

function multiBot() {
    for (let key in config) {
        if (config.hasOwnProperty(key)) {
            let options = {
                host: "mc.civclassic.com",
                port: 25565,
                username: config[key].username,
                password: config[key].password,
                version: "1.16.1",
            };
            bots[key] = mineflayer.createBot(options);
            bindEvents(bots[key], key);
        }
    }
}

/** @param {string} msg
 * @param bot_selected
 */
function sendChat(msg, bot_selected = 'septbot') {
    const thisChatTimeout = Math.max(0, nextChatTs - Date.now())
    nextChatTs = Math.max(nextChatTs, Date.now()) + 1000
    console.log("DEBUG : In SendChat" + bot_selected)
    if (bots[bot_selected] === undefined) {
        console.log("undefined in sendchat :/")
    }
    setTimeout(() => {
        if (bots[bot_selected]) bots[bot_selected].chat(msg)
    }, thisChatTimeout)
}

let channel_local, channel_global, relay_category, channel_snitch, channel_debug, channel_local_mta, info_channel, law_category, law_backup_channel, bill_channel;
client.on('ready', () => {
    console.log(`The discord bot logged in! Username: ${client.user.username}!`)
    client.user.setActivity("CivWiki", { type: "WATCHING"})
    channel_local = client.channels.cache.get(channel_local_id);
    channel_local_mta = client.channels.cache.get(channel_local_mta_id);
    channel_global = client.channels.cache.get(channel_global_id);
    channel_snitch = client.channels.cache.get(channel_snitch_id);
    channel_debug = client.channels.cache.get(channel_debug_id)
    relay_category = client.channels.cache.get(relay_category_id);
    law_category = client.channels.cache.get(law_category_id);
    law_backup_channel = client.channels.cache.get(law_backup_channel_id);
    info_channel = client.channels.cache.get(info_channel_id);
    bill_channel = client.channels.cache.get(bill_channel_id);
    channelDeletion.start()
    channel_debug.send("Septbot started (manual restart or crash?)")
})

let channelDeletion = new cron.CronJob('00 00 10 * * *', () => {
    channelDeletionDebug()
});

function channelDeletionDebug() {
    relay_category.children.forEach(c => {
        c.messages.fetch({ limit: 1 }).then(messages => {
            messages.forEach(m => {
                if (m) {
                    if ((Date.now() - m.createdAt) / 1000 / 60 / 60 > 24) {
                        console.log("Deleting " + c.name);
                        deleteLineFromFile('resources/newfriend_channels.txt', c.id)
                        c.delete();
                    }
                }
            })
        }).catch(console.error);
    })
}


client.on('message', message => {
    if (!message.member) {
        return;
    }
    if ((message.channel.type === "text" && message.channel.parent !== null && message.channel.parent.id === law_category.id)) {
        if (message.channel.id === law_backup_channel.id) {
            return
        }
        law_backup_channel.send(`\`${message.author.username}:${message.author.discriminator} (${message.author.id}) sent :\``)
        if (message.content.length !== 0) {
            law_backup_channel.send(Util.removeMentions(message.content))
        }
        //todo : save attachements
        //todo : save edits and reactions
        if (message.channel.id === bill_channel_id) {
            const must_contain = ["[bill vote]", "[bill result]", "aye", "nay", "yes", "no"]
            if (!must_contain.some(v => message.content.toLowerCase().includes(v))) {
                message.delete();
                law_backup_channel.send(`${message.author.toString()} your message in ${message.channel.toString()} does not appear to be a valid legal message. Valid messages may include \"[Bill Vote]\", \"Aye\" or \"Nay\"`)
                return;
            }
        }
    }
    if ((!(message.channel.type === "text" && message.channel.parent !== null && message.channel.parent.id === relay_category.id)
       && message.channel.id !== channel_local.id && message.channel.id !== channel_global.id && message.channel.id !== channel_local_mta.id) || (message.member.roles.cache.some(role => role.name === 'SeptBot'))) {
        return;
    }
    if (message.content[0] === prefix) return;
    if (message.author.id === client.user.id) return
    if (message.content.length > 600) {
        message.react('❌');
        return;
    }
    let clean_lines = message.content.replace(/§/g, '').split('\n')
    if (message.channel.id === channel_local.id) {
        for (const clean_line of clean_lines) {
            sendChat(`${message.author.username}: ${clean_line}`)
        }
    } else if (message.channel.id === channel_global.id) {
        console.log("DEBUG : message sent in channel_global")
        if ((trusted_users.includes(parseInt(message.author.id)) && clean_lines[0] === ":" ) ) {
            clean_lines = clean_lines.substring(1)
            for (const clean_line of clean_lines) {
                sendChat(`/g ! ${clean_line}`)
            }
        } else {
            for (const clean_line of clean_lines) {
                sendChat(`/g ! ${message.author.username}: ${clean_line}`)
            }
        }
    } else if (message.channel.id === channel_local_mta.id) {
        for (const clean_line of clean_lines) {
            sendChat(`${message.author.username}: ${clean_line}`, "mtatree")
        }
    }
    fs.readFileSync('resources/newfriend_channels.txt', 'utf-8').split(/\r?\n/).forEach(function (line) {
        if (line.split(" ")[0] === message.channel.id) {
            for (const clean_line of clean_lines) {
                sendChat(`/tell ${line.split(" ")[1]} ${clean_line}`, () => { lastDMSentToPlayer = line.split(" ")[1] })
            }
        }
    })
})

client.on('message', async message => {
    if (message.content[0] !== prefix) return;
    else {
        let args = message.content.replace("~", "").split(" ");
        switch (args[0]) {
            case 'snitchreport':
                try {
                    message.channel.startTyping()
                    let snitch_activity = {};
                    let player_activity = {};
                    let messages;
                    if (args[1] < 100) {
                        messages = Array.from(await channel_snitch.messages.fetch({ limit: args[1] }));
                    } else {
                        if (args[1] % 100 != 0) {
                            messages = Array.from(await channel_snitch.messages.fetch({ limit: args[1] % 100 }));
                        } else {
                            messages = Array.from(await channel_snitch.messages.fetch({ limit: 100 }));
                        }
                        for (let i = 1; i < args[1] / 100; i++) {
                            let lastId = messages[messages.length - 1][messages[messages.length - 1].length - 1].id;
                            let moreMessages = Array.from(await channel_snitch.messages.fetch({
                                limit: 100,
                                before: lastId
                            }));
                            messages = messages.concat(moreMessages);
                        }
                    }
                    let count = 0;
                    //snitch_activity is ordered newest -> oldest
                    messages.forEach(log => {
                        if (log[1].author.id === '533255321414795267' && /(is at)/.test(log[1].content)) {
                            let clean_log = log[1].content.replace(/([*`])|( is at)/g, "").split(" ");
                            let date = log[1].createdAt.toString().split(' ').slice(0, 4).join(" ");
                            if (!(date in snitch_activity)) {
                                snitch_activity[date] = {};
                                snitch_activity[date] = [[clean_log[2], clean_log[3] + clean_log[4]]];
                                count++;
                            } else {
                                snitch_activity[date].push([clean_log[2], clean_log[3] + clean_log[4]]);
                                count++;
                            }
                            if (!(clean_log[2] in player_activity)) {
                                player_activity[clean_log[2]] = 1;
                            } else {
                                player_activity[clean_log[2]]++;
                            }
                        }
                    })
                    let embed = new Discord.MessageEmbed()
                        .setTitle(`Snitch activity`)
                        .setDescription(`For the last ${count} logs`)
                        .addField(`Top players for this period`, topActivity(player_activity))
                        .attachFiles(graphActivity(snitch_activity))
                        .setImage("attachment://image.png");
                    message.channel.send(embed)
                    message.channel.stopTyping()
                } catch (e) {
                    console.log(e)
                } finally {
                    message.channel.stopTyping()
                }
                break;
            case 'tell':
                let new_channel = await createRelayChannel(message, args[1]);
                if (!new_channel) {
                    return
                }
                message.channel.send("Created a new relay")
            case 'invite':
                last_invite_channel = message.channel
                if (!trusted_users.includes(parseInt(message.author.id))) {
                    return;
                }
                let player = args[1];
                let group_preset = args[2];
                fs.readFileSync('resources/group_presets', 'utf-8').split(/\r?\n/).forEach(function (line) {
                    let l = line.split(" ")
                    let preset_line = l[0];
                    if (group_preset === preset_line) {
                        for (let i = 1; i < l.length; i+=2) {
                            message.channel.send(`Invited ${player} to ${l[i]} ${l[i+1]}`)
                            sendChat(`/nlip ${l[i]} ${player} ${l[i+1]}`)
                        }
                    }
                })
                break
            case 'relaypurge':
                if (!trusted_users.includes(parseInt(message.author.id))) {
                    return;
                }
                channelDeletionDebug();
                break
        }
    }
    function graphActivity({ ...data }) {
        //softmax - %age
        let max = 0;
        for (date of Object.keys(data)) {
            max += data[date].length;
        }
        for (date of Object.keys(data)) {
            data[date] = data[date].length * 100 / max;
        }
        const canvas = new CanvasRenderService(800, 800, (ChartJS) => {
            ChartJS.plugins.register({
                beforeDraw: (chartInstance) => {
                    const { ctx } = chartInstance.chart
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, 800, 800);
                }
            });
        });
        const configuration = {
            type: 'bar',
            data: {
                labels: Object.keys(data).reverse(),
                datasets: [{ label: 'Snitch Activity', data: Object.values(data).reverse(), backgroundColor: '#2f2fc4' }]
            },
        };
        const attachment = new Discord.MessageAttachment(canvas.renderToBufferSync(configuration), "image.png");
        return attachment;
    }
    function topActivity({ ...data }) {
        data.zero = 0;
        let sorted = [];
        let max = ['zero', 'zero', 'zero'];
        let count = 0;
        for (entry of Object.keys(data)) {
            if (data[entry] > data[max[0]]) {
                max[0] = entry;
            }
            count += data[entry];
        }
        for (entry of Object.keys(data)) {
            if (data[entry] < data[max[0]] && data[entry] > data[max[1]]) {
                max[1] = entry;
            }
        }
        for (entry of Object.keys(data)) {
            if (data[entry] < data[max[1]] && data[entry] > data[max[2]]) {
                max[2] = entry;
            }
        }
        for (entry of max) {
            sorted.push(Math.round(data[entry] * 100 / count)+ '% ' + entry);
        }
        return sorted.join('\n');
    }
})
client.on('message', message => {
    if (message.channel.type !== "text") return
    if (message.author.id === client.user.id) return
    if (/R[o*]le *pl[a*]y[: ]*detected/i.test(message.content))
        message.channel.send('Get on with it');
})

client.on('voiceStateUpdate', (oldMember, newMember) => {
    let newUserChannel = newMember.channel
    let oldUserChannel = oldMember.channel
    if (newUserChannel !== null && !vcs_to_relay.includes(parseInt(newUserChannel.id))) {
        return;
    }
    if ((oldUserChannel === null || !vcs_to_relay.includes(parseInt(oldUserChannel.id))) && newUserChannel != null) {
        if (newMember.member.user.bot) {
            return;
        }
        if (lastVCJoinBroadcasts[newMember.member.user.id] !== undefined ) {
            if ((Date.now() - lastVCJoinBroadcasts[newMember.member.user.id]) / 1000 / 60 < 10) {
                return
            }
        }
        lastVCJoinBroadcasts[newMember.member.user.id] = Date.now();
        sendChat(`[${newMember.member.user.username} joined voicechat!]`)
        let i = 0;
        newUserChannel.members.forEach(m => {
            if (!m.user.bot) {
                i++;
            }
        })
        if (i >= 7) {
            if (!lastVCBroadcast || (Date.now() - lastVCBroadcast) / 1000 / 60 > 100) {
                sendChat(`/g ! Join the ${i} players currently in the ${channel_local.guild.name} voice chat! https://discord.gg/pkBScuu`)
                lastVCBroadcast = Date.now();
            }
        }
    }
})

client.login(config_type.client_token)

function bindEvents(bot, key) {
    lastDMSentToPlayer = null;

    bot.on('spawn', function () {
        if (bot.username !== primary_account) {
            return;
        }
        setInterval(update_stats, 4*60*1000);
        setTimeout(update_stats, 1000*5);
    });

    bot.on('error', function (err) {
        console.log('Error attempting to reconnect: ' + err.errno + '.');
        if (err.code === undefined) {
            console.log('Invalid credentials OR bot needs to wait because it relogged too quickly.');
            console.log('Will retry to connect in 30 seconds.');
            if (!key) {
                return ;
            }
            setTimeout(function() {relog(key)}, 30000 + (getRandomArbitrary(0,60) * 10));
        }
    });

    bot.on('end', function () {
        if (bot.username === primary_account) {
            info_channel.messages.fetch(info_message_id).then(msg => {
                msg.edit("Server and/or bot is restarting or offline \:(")
            })
        }
        console.log("Bot has ended");
        fs.readFileSync('resources/newfriend_channels.txt', 'utf-8').split(/\r?\n/).forEach(function (line) {
            let player_channel = client.channels.cache.get(line.split(" ")[0]);
            if (player_channel !== undefined && player_channel.name.includes("🟢")) {
                let sanitized_username = line.split(" ")[1].toLowerCase().replace(/[^a-z\d-]/g, "");
                player_channel.setName(sanitized_username)
            }
        })
        setTimeout(function() {relog(key)}, 6 * 1000 + (getRandomArbitrary(0,60) * 10));
    });

    bot._client.on("playerlist_header", data => {
        TPS = data['footer'].match(/§9(\d*\.?\d*) TPS/)[1]
    })

    bot.on('message', async (jsonMsg, position) => {
        let group_chat = jsonMsg.toString().match(/\[(\S+)\] (\S+): (.+)/)
        let local_chat = jsonMsg.toString().match(/^<(\S+)> (.+)/);
        let death_message = jsonMsg.toString().match(/^(\S+) was killed by (\S+) (?:with ){1,2}(.+)/);
        let new_player = jsonMsg.toString().match(/^(\S+) is brand new!/);
        let private_message = jsonMsg.toString().match(/^From (\S+): (.+)/);
        let sent_private_message = jsonMsg.toString().match(/^To (\S+): (.+)/);
        let joined_game = jsonMsg.toString().match(/^(\S+) has joined the game/);
        let left_game = jsonMsg.toString().match(/^(\S+) has left the game/);
        let ignoring = jsonMsg.toString().match(/.*that player is ignoring you./i);
        let player_already_member = jsonMsg.toString().match(/^Player is already a member./i);
        let never_played_before = jsonMsg.toString().match(/^The player has never played before/i);

        if (local_chat) {
            if (bot.username !== primary_account) {
                channel_local_mta.send(`[**${local_chat[1]}**] ${Util.removeMentions(local_chat[2])}`);
            } else {
                channel_local.send(`[**${local_chat[1]}**] ${Util.removeMentions(local_chat[2])}`);
            }
        }
        if (bot.username !== primary_account) {
            return
        }
        if (group_chat) {
            //if (group_chat[2] === bot.username) return;
            if (group_chat[1] === "!") {
                channel_global.send(`\`[${group_chat[1]}]\` [**${group_chat[2]}**] ${Util.removeMentions(group_chat[3])}`);
            }
        } else if (death_message) {
            channel_local.send(`**${death_message[1]}** was killed by **${death_message[2]}** with ${death_message[3]}`);
        } else if (new_player) {
            let new_channel = await createRelayChannel(null, new_player[1])
            if (!new_channel) {
                return
            }
            new_channel.setName("🟢-" + sanitizeUsernameForDiscord(new_player[1]))
            if (Math.floor(Math.random() * 4) + 1 === 1) {
                await sleep(Math.floor(Math.random() * (30 - 10) + 10) * 1000)
            }
            let prompt;
            if (Math.floor(Math.random() * 10) + 1 !== 3) {
                await new_channel.send("This relay was randomly selected as __serious__. Please do not harass the newfriend.");
                prompt = getRandomLine('resources/message_prompts');
            } else {
                await new_channel.send("This relay was randomly selected as __meme__.");
                prompt = getRandomLine('resources/message_prompts_meme');
            }
            const wait_times = [0, 15, 30] // in seconds
            let messsage_wait_time = wait_times[Math.floor(Math.random() * wait_times.length)];
            if (messsage_wait_time !== 0 ) {
                await new_channel.send(`waiting ${messsage_wait_time} seconds before sending prompt...`)
            }
            setTimeout(async function(){
                sendChat(`/tell ${new_player[1]} ${prompt}`);
                await new_channel.send(`\`${prompt}\``);
                // To Do : only send this reminder if the newfriend has not responded already
                if (Math.floor(Math.random() * 2) + 1 !== 1) {
                    setTimeout(async function(){
                        let reminder = `If you need any help ${new_player[1]} you can respond to messages with /r`
                        await sendChat(`/tell ${new_player[1]} ${reminder}`);
                        await new_channel.send(`\`${reminder}\``);
                    }, 5*1000);
                }
            }, messsage_wait_time * 1000)
        } else if (private_message) {
            await send_message_in_relay(private_message)
        } else if (sent_private_message) {
            await send_message_in_relay(sent_private_message)
        } else if (ignoring && lastDMSentToPlayer) {
            fs.readFileSync('resources/newfriend_channels.txt', 'utf-8').split(/\r?\n/).forEach(function (line) {
                if (line.split(" ")[1] === lastDMSentToPlayer) {
                    let player_channel = client.channels.cache.get(line.split(" ")[0]);
                    player_channel.send(`${lastDMSentToPlayer} is ignoring this bot. Try using a different account to contact the player.`);
                }
            })
        } else if (joined_game) {
            fs.readFileSync('resources/newfriend_channels.txt', 'utf-8').split(/\r?\n/).forEach(function (line) {
                if (line.split(" ")[1] === joined_game[1]) {
                    let player_channel = client.channels.cache.get(line.split(" ")[0]);
                    if (player_channel === undefined) {
                        return;
                    }
                    let sanitized_username = joined_game[1].toLowerCase().replace(/[^a-z\d-]/g, "");
                    player_channel.send(joined_game[0])
                    player_channel.setName("🟢-" + sanitized_username)
                    //todo : check if newly joined player who momentarily disconnected, if so resend prompt
                }
            })
        } else if (left_game) {
            fs.readFileSync('resources/newfriend_channels.txt', 'utf-8').split(/\r?\n/).forEach(function (line) {
                if (line.split(" ")[1] === left_game[1]) {
                    let player_channel = client.channels.cache.get(line.split(" ")[0]);
                    if (player_channel === undefined) {
                        return;
                    }
                    let sanitized_username = left_game[1].toLowerCase().replace(/[^a-z\d-]/g, "");
                    player_channel.send(left_game[0])
                    player_channel.setName(sanitized_username)
                }
            })
        } else if (player_already_member && last_invite_channel) {
            last_invite_channel.send(player_already_member[0])
        } else if (never_played_before && last_invite_channel) {
            last_invite_channel.send(never_played_before[0])
        }

        async function send_message_in_relay(msg) {
            let channel_exists = false;
            fs.readFileSync('resources/newfriend_channels.txt', 'utf-8').split(/\r?\n/).forEach(function (line) {
                if (line.split(" ")[1] === msg[1]) {
                    let player_channel = client.channels.cache.get(line.split(" ")[0]);
                    if (player_channel) {
                        player_channel.send(`[**${msg[1]}**] ${Util.removeMentions(msg[2])}`);
                        channel_exists = true;
                    }
                }
            })
            if (!channel_exists) {
                let new_channel = await createRelayChannel(null, msg[1])
                if (!new_channel) {
                    return
                }
                await new_channel.send(msg[0])
            }
        }
    })

    function update_stats() {
        let message = "**CivClassic Server Info** (updated every 4 minutes)\n"
        let online_players = bot.players
        if (online_players === null ){
            message += "```Server or bot is currently offline :(```"
        } else {
            message += "TPS: " + TPS + "\n" + "**" + Object.keys(online_players).length + " online players**\n"
            for (let player in online_players) {
                message += online_players[player]['username'].replace('_', "\\_") + '\n';
            }
        }
        info_channel.messages.fetch(info_message_id).then(msg => {
            msg.edit(message)
        })
    }
}

function relog(key) {
    console.log("Attempting to reconnect...");
    console.log("bot= " + key)
    if (config.hasOwnProperty(key)) {
        let options = {
            host: "mc.civclassic.com",
            port: 25565,
            username: config[key].username,
            password: config[key].password,
            version: "1.16.1",
        };
        bots[key] = mineflayer.createBot(options);
        bindEvents(bots[[key]], key);
    }
}

async function createRelayChannel(message, username){
    let response_channel
    if (message) {
        response_channel = message.channel;
    } else {
        response_channel = channel_debug;
    }
    if (relay_category.children.size >= 50) {
        await response_channel.send(`Could not create a channel for ${username}, relay category exceeds 50 channels`)
        return
    }
    let player_channel_found = false
    fs.readFileSync('resources/newfriend_channels.txt', 'utf-8').split(/\r?\n/).forEach(function (line) {
        if (line.split(" ")[1] === username) {
            let player_channel = client.channels.cache.get(line.split(" ")[0]);
            if (player_channel) {
                player_channel_found = true;
            }
        }
    })
    if (player_channel_found) {
        await response_channel.send(`Channel for ${username} already exists`)
        return
    }
    let channel_options = {
        topic: 'A channel to message ' + username,
        parent: relay_category,
    }
    let new_channel = await relay_category.guild.channels.create(sanitizeUsernameForDiscord(username), channel_options)
    fs.appendFileSync('resources/newfriend_channels.txt', new_channel.id + " " + username + "\n");
    return new_channel;

}

function sanitizeUsernameForDiscord(username) {
    return username.toLowerCase().replace(/[^a-z\d-]/g, "");
}

function getRandomLine(filename) {
    let data = fs.readFileSync(filename, "utf8");
    let lines = data.split('\n');
    let rand =  lines[Math.floor(Math.random() * lines.length)];
    if (rand === undefined || rand === null || rand === '') {
        return getRandomLine(filename);
    } else {
        return rand;
    }
}

function deleteLineFromFile(filename, channel_id) {
    let new_file = '';
    let data = fs.readFileSync(filename, "utf8");
    let lines = data.split('\n');
    lines.forEach((line) => {
        if (line.split(" ")[0] !== channel_id) {
            new_file += line + "\n"
        }
    });
    fs.writeFileSync('resources/newfriend_channels.txt', new_file.replace(/\n$/, ""), {encoding:'utf8',flag:'w'})
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}
