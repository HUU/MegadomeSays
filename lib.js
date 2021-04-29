const Firebase = require('firebase-admin');

var ResolvePartialReaction = exports.ResolvePartialReaction = async function(reaction) {
	if (reaction.partial) {
		await reaction.fetch();
	}
};

var FetchTweetRecord = exports.FetchTweetRecord = async function(records, messageId) {
    return await records.doc(messageId).get();
}

var CreateTweetRecord = exports.CreateTweetRecord = async function(records, messageId, sender, tweetUrl) {
    return await records.doc(messageId).set({
        HandledOn: Firebase.firestore.Timestamp.now(),
        Sender: sender,
        Tweet: tweetUrl
    });
}

var NoTweetFound = exports.NoTweetFound = async function(records, reaction) {
    var record = await FetchTweetRecord(records, reaction.message.id);
    return !record.exists;
}

var GetKnownTweetUrl = exports.GetKnownTweetUrl = async function(records, reaction) {
    var record = await FetchTweetRecord(records, reaction.message.id);
var GetKnownTweetUrl = exports.GetKnownTweetUrl = async function(records, reaction) {
    var record = await FetchTweetRecord(records, reaction.message.id);
    return ExtractTweetId(record.get('Tweet'));
}
    var tweetId = await ExtractTweetId(tweetUrl)
    return tweetId;
}

const HumanErrorsByCode = {
    144: "That tweet no longer exists",
    170: "The message must contain some text (images, attachments, etc are not supported)",
    186: "That message is too long for a tweet",
    187: "We've already tweeted the exact same text previously",
}

var HumanizeTwitterError = function (error) {
    if (error?.errors) {
        return error.errors.map((e) => HumanErrorsByCode[e?.code] ?? e?.message).join('; ');
    } else {
        return JSON.stringify(error);
    }
}

var ExecuteTwitterApiCall = async function (fn) {
    try {
        return await fn();
    } catch(error) {
        throw new Error(HumanizeTwitterError(error));
    }
}

var PostTweet = exports.PostTweet = async function(records, twitter, reaction) {
    const result = await ExecuteTwitterApiCall(async () => await twitter.post('statuses/update', { status: reaction.message.content }));
	const url = `https://twitter.com/megadomesays/status/${result.id_str}`;
    await CreateTweetRecord(records, reaction.message.id, reaction.message.author.username, url);
    return url;
}

var ExtractTweetId = exports.ExtractTweetId = function(message) {
    const regex = /https:\/\/twitter\.com\/megadomesays\/status\/([0-9]+)/;
    const result = message.match(regex);
    if (result) {
        return result[1];
    } else {
        throw new Error(`Could not find a tweet to delete in ${message}"`);
    }
}

var DeleteTweet = exports.DeleteTweet = async function (twitter, id) {
    return await ExecuteTwitterApiCall(async () => await twitter.post(`statuses/destroy/${id}`));
}
