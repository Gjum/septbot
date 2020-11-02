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

const channel_local_id = '769382925283098634';
const channel_global_id = '769409279496421386';
const channel_snitch_id = '742871763758743574';
const relay_category_id = '770391959432593458';
const vcs_to_relay = [742831212711772265];

const options = {
    host: "mc.civclassic.com",
    port: 25565,
    username: config_type.username,
    password: config_type.password,
    version: "1.16.1",
};

let bot = mineflayer.createBot(options);
let lastDMSentToPlayer = null;
let lastVCBroadcast = null;
bindEvents(bot);

let nextChatTs = 0;
/** @param {string} msg */
function sendChat(msg) {
    const thisChatTimeout = Math.max(0, nextChatTs - Date.now())
    nextChatTs = Math.max(nextChatTs, Date.now()) + 1000
    setTimeout(() => {
        if (bot) bot.chat(msg)
    }, thisChatTimeout)
}

let channel_local, channel_global, relay_category, channel_snitch;
client.on('ready', () => {
    console.log(`The discord bot logged in! Username: ${client.user.username}!`)
    channel_local = client.channels.cache.get(channel_local_id);
    channel_global = client.channels.cache.get(channel_global_id);
    channel_snitch = client.channels.cache.get(channel_snitch_id);
    relay_category = client.channels.cache.get(relay_category_id);
    channelDeletion.start()
})


let channelDeletion = new cron.CronJob('00 00 10 * * *', () => {
    channelDeletionDebug()

});

function channelDeletionDebug(){
    relay_category.children.forEach(c => {
        c.messages.fetch({ limit: 1 }) .then(messages => {
            messages.forEach(m => {
                if (m) {
                    if ((Date.now() -  m.createdAt) / 1000 / 60 / 60 > 48) {
                        console.log("Deleting " + c.name);
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
    if (message.member.id === '145342519784374272' && message.content === "!relaypurge") { //temp
        channelDeletionDebug();
    }
    if (!(message.channel.type === "text" && message.channel.parent !== null && message.channel.parent.id === relay_category.id)
        && (message.channel.id !== channel_local.id) && (message.channel.id !== channel_global.id)) {
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
        for (const clean_line of clean_lines) {
            sendChat(`/g ! ${message.author.username}: ${clean_line}`)
        }
        message.react('✅');
    }
    fs.readFileSync('resources/newfriend_channels.txt', 'utf-8').split(/\r?\n/).forEach(function (line) {
        if (line.split(" ")[0] === message.channel.id) {
            for (const clean_line of clean_lines) {
                sendChat(`/tell ${line.split(" ")[1]} ${clean_line}`, () => { lastDMSentToPlayer = line.split(" ")[1]})
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
                try{
                    message.channel.startTyping()
                    let snitch_activity = {};
                    let messages;
                    if (args[1] < 100) {
                        messages = Array.from(await channel_snitch.messages.fetch({ limit: args[1] }));
                    } else {
                        if (args[1] % 100 != 0) {
                            messages = Array.from(await channel_snitch.messages.fetch({limit: args[1] % 100}));
                        } else {
                            messages = Array.from(await channel_snitch.messages.fetch({limit: 100}));
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
                        }
                    })
                    message.channel.send(`Collected ${count} snitch logs, from ${Object.keys(snitch_activity)[Object.keys(snitch_activity).length - 1]}`)
                    message.channel.send(graphActivity(snitch_activity));
                    message.channel.stopTyping()
                }catch(e){
                    console.log(e)
                }finally{
                    message.channel.stopTyping()
                }
                break;
            case 'tell':
                let sanitized_username =  args[1].toLowerCase().replace(/[^a-z\d-]/g, "");
                let channel_options = {
                    topic: 'A channel to message ' + args[1],
                    parent: relay_category,
                }
                let new_channel = await relay_category.guild.channels.create(sanitized_username, channel_options)
                fs.appendFileSync('resources/newfriend_channels.txt', new_channel.id + " " + args[1] + "\n");
        }
        return;
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
                    const {ctx} = chartInstance.chart
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
            options: { scales: { yAxes: [{ ticks: { suggestedMax: 100 } }] } }
        };
        const attachment = new MessageAttachment(canvas.renderToBufferSync(configuration));
        return attachment;
    }
})
client.on('message', message => {
    if (message.channel.type !== "text") return
    if (message.author.bot) return
    if (/dr[-_. ]*o[-_. ]*racle?/i.test(message.content))
        message.channel.send('Roleplay detected');
})

client.on('voiceStateUpdate', (oldMember, newMember) => {
    let newUserChannel = newMember.channel
    let oldUserChannel = oldMember.channel
    if (newUserChannel !== null && !vcs_to_relay.includes(parseInt(newUserChannel.id))) {
        return;
    }
    if (oldUserChannel === null && newUserChannel != null) {
        // todo : Spam protection for repeated reconnections
        if (!newMember.member.user.bot) {
            sendChat(`[${newMember.member.user.username} joined voicechat!]`)
        }
        let i = 0;
        newUserChannel.members.forEach(m => {
            if (!m.user.bot) {
                i++;
            }
        })
        if (i>= 7) {
            if (!lastVCBroadcast || (Date.now() -  lastVCBroadcast) / 1000 / 60 > 100) {
                bot.chat(`/g ! Join the ${i} players currently in the ${channel_local.guild.name} voice chat! https://discord.gg/pkBScuu`)
                lastVCBroadcast = Date.now();
            }
        }
    }
})

client.login(config_type.client_token)

function bindEvents(bot) {

    lastDMSentToPlayer = null;

    bot.on('error', function (err) {
        console.log('Error attempting to reconnect: ' + err.errno + '.');
        if (err.code === undefined) {
            console.log('Invalid credentials OR bot needs to wait because it relogged too quickly.');
            console.log('Will retry to connect in 30 seconds.');
            setTimeout(relog, 30000);
        }
    });

    bot.on('end', function () {
        console.log("Bot has ended");
        fs.readFileSync('resources/newfriend_channels.txt', 'utf-8').split(/\r?\n/).forEach(function (line) {
            let player_channel = client.channels.cache.get(line.split(" ")[0]);
            if (player_channel != undefined && player_channel.name.includes("🟢")) {
                let sanitized_username = line.split(" ")[1].toLowerCase().replace(/[^a-z\d-]/g, "");
                player_channel.setName(sanitized_username)
            }
        })
        setTimeout(relog, 6 * 1000);
    });

    bot.on('message', async (jsonMsg, position) => {
        let group_chat = jsonMsg.toString().match(/\[(\S+)\] (\S+): (.+)/)
        let local_chat = jsonMsg.toString().match(/^<(\S+)> (.+)/);
        let death_message = jsonMsg.toString().match(/^(\S+) was killed by (\S+) (?:with ){1,2}(.+)/);
        let new_player = jsonMsg.toString().match(/^(\S+) is brand new!/);
        let private_message = jsonMsg.toString().match(/^From (\S+): (.+)/);
        let joined_game = jsonMsg.toString().match(/^(\S+) has joined the game/);
        let left_game = jsonMsg.toString().match(/^(\S+) has left the game/);
        let ignoring = jsonMsg.toString().match(/.*that player is ignoring you./i);
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
            let sanitized_username = new_player[1].toLowerCase().replace(/[^a-z\d-]/g, "");
            let channel_options = {
                topic: 'A channel to message ' + new_player[1],
                parent: relay_category,
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
            let channel_exists = false;
            fs.readFileSync('resources/newfriend_channels.txt', 'utf-8').split(/\r?\n/).forEach(function (line) {
                if (line.split(" ")[1] === private_message[1]) {
                    let player_channel = client.channels.cache.get(line.split(" ")[0]);
                    if (player_channel) {
                        player_channel.send(`[**${private_message[1]}**] ${Util.removeMentions(private_message[2])}`);
                        channel_exists = true;
                    }
                }
            })
            if (!channel_exists) {
                console.log("Creating new channel");
                let sanitized_username = private_message[1].toLowerCase().replace(/[^a-z\d-]/g, "");
                let channel_options = {
                    topic: 'A channel to message ' + private_message[1],
                    parent: relay_category,
                }
                let new_channel = await relay_category.guild.channels.create(sanitized_username, channel_options)
                fs.appendFileSync('resources/newfriend_channels.txt', new_channel.id + " " + private_message[1] + "\n");
                await new_channel.send(private_message[0])
            }
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
                        return ;
                    }
                    let sanitized_username = joined_game[1].toLowerCase().replace(/[^a-z\d-]/g, "");
                    player_channel.send(joined_game[0])
                    player_channel.setName("🟢-" + sanitized_username)
                }
            })
        } else if (left_game) {
            fs.readFileSync('resources/newfriend_channels.txt', 'utf-8').split(/\r?\n/).forEach(function (line) {
                if (line.split(" ")[1] === left_game[1]) {
                    let player_channel = client.channels.cache.get(line.split(" ")[0]);
                    if (player_channel === undefined) {
                        return ;
                    }
                    let sanitized_username = left_game[1].toLowerCase().replace(/[^a-z\d-]/g, "");
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

function getRandomLine(filename) {
    var data = fs.readFileSync(filename, "utf8");
    var lines = data.split('\n');
    return lines[Math.floor(Math.random() * lines.length)];
}
