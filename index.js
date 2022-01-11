require('dotenv').config();
const ava = require('avalanche')
const fs = require('fs');
const createHash = require('create-hash')
const Discord = require('discord.js');

const Avalanche = ava.Avalanche;
const BinTools = ava.BinTools;
const Buffer = ava.Buffer; 

const bintools = BinTools.getInstance()
const myNetworkID = 1
const avalanche = new Avalanche("localhost", 9650, "http", myNetworkID)

function digestMessage(msgStr) {
    let mBuf = Buffer.from(msgStr, 'utf8')
    let msgSize = Buffer.alloc(4)
    msgSize.writeUInt32BE(mBuf.length, 0)
    let msgBuf = Buffer.from(`\x1AAvalanche Signed Message:\n${msgSize}${msgStr}`, 'utf8')
    return createHash('sha256').update(msgBuf).digest()
}

function verify(message, signature, address)
{
    const keypair = avalanche.XChain().keyChain().makeKey()
    const digest = digestMessage(message)
    const digestBuff = Buffer.from(digest.toString('hex'), 'hex')
    try {
        const signedBuff = bintools.cb58Decode(signature)
        const pubKey = keypair.recover(digestBuff, signedBuff)
        const addressBuff = keypair.addressFromPublicKey(pubKey)
        return bintools.addressToString('avax', 'P', addressBuff) === address
    } catch
    {
        return false;
    }
}

let validators = {}
try {
  let rawdata = fs.readFileSync('validators.json');
  validators = JSON.parse(rawdata);
} catch (err) {
  ;
}

let snapshot = {}
try {
  let rawdata = fs.readFileSync('snapshot.json');
  snapshot = JSON.parse(rawdata);
} catch (err) {
  ;
}

const bot = new Discord.Client();
const TOKEN = process.env.TOKEN;
bot.login(TOKEN);

bot.on('ready', () => {
  console.info(`Logged in as ${bot.user.tag}!`);
});

bot.on('message', msg => {
  try {
    if (msg.author.id === bot.user.id)
      return;
    let verificationChannel = msg.guild.channels.find(channel => channel.name === 'verification')
    if (msg.channel.id !== verificationChannel.id)
      return;
    let parts = msg.content.split(' ')
    if (parts.length != 5) throw new Error('verification message needs to be 5 tokens separated by a single space'); 
    let [nodeid, cchain, user, tx, sig] = parts
    if ( !(nodeid in snapshot)) throw new Error('nodeid is not in my snapshot of active validators'); 
    if ( cchain.search(/0x[0-9A-Fa-f]+/) == -1 ) throw new Error('cchain address is not in the format 0x[0-9A-Fa-f]+'); 
    if ( tx.search(/[1-9A-HJ-NP-Za-km-z]+/) == -1 && tx !== '0') throw new Error('validation transaction is not 0 or in the format [1-9A-HJ-NP-Za-km-z]+'); 
    if ( sig.search(/[1-9A-HJ-NP-Za-km-z]+/) == -1 ) throw new Error('signature is not in the format [1-9A-HJ-NP-Za-km-z]+');
    if (sig in validators) throw new Error('This signature has already been used by someone else');

    let beneficiary = snapshot[nodeid]
    message = nodeid + ' ' + cchain + ' ' + user + ' ' + tx
    if ( !verify(message, sig, beneficiary)) throw new Error('signature does not match validator beneficiary address');
    let validatorRole = msg.guild.roles.find(role => role.name === "Validator");
    msg.member.addRole(validatorRole).catch(console.error);
    validators[sig] = {'nodeid': nodeid, 'cchain': cchain, 'user': user, 'discord': msg.author.username, 'tx': tx}
    let data = JSON.stringify(validators);
    fs.writeFileSync('validators.json', data);
    msg.reply('successfully verified validator status');
  } catch (err)
  {
    msg.reply(err.toString());
  }
});
