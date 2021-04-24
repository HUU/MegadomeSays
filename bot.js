const Twitter = require('twitter-lite');
const Discord = require('discord.js');
require('discord-reply'); // in Discord.js 13 this won't be needed.
const Firebase = require('firebase-admin');
const Mutex = require('async-mutex').Mutex;

const config = require('./config');
const lib = require('./lib.js');

const twitterClient = new Twitter(config.twitter);
const discordClient = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
const firestore = Firebase.firestore(Firebase.initializeApp({credential: Firebase.credential.cert(config.firebase)}));
const records = firestore.collection('Tweets');
const handleOneReactionAtATime = new Mutex();

discordClient.on('ready', () => {
	console.log(`Logged in as ${discordClient.user.tag}.`);
});

discordClient.on('messageReactionAdd', async (reaction) => {
	try {
		await lib.ResolvePartialReaction(reaction);
		if (reaction.emoji.name == 'tweetThis') {
			await handleOneReactionAtATime.runExclusive(async () => {
				if (await lib.ReactionShouldBeTweeted(records, reaction)) {
					console.log(`${reaction.message.author.name}'s message "${reaction.message.content}" will be tweeted.`);
					const tweetUrl = await lib.PostTweet(records, twitterClient, reaction);
					reaction.message.lineReplyNoMention(tweetUrl);
					console.log(`Tweet sent, available at ${tweetUrl}.`);
				} else {
					console.log(`"${reaction.message.content}" has already been tweeted.`);
					reaction.message.lineReplyNoMention("This message has already been twote.")
				}
			});
		}
	}
	catch (error) {
		console.error('Something went wrong handling reaction: ', error);
		reaction.message.lineReplyNoMention(`I tried to tweet this but failed: ${error}.`);
	}
});

discordClient.login(config.discord.token);