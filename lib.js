const path = require('path');
const fetch = require('cross-fetch');
const FileType = require('file-type');
const Firebase = require('firebase-admin');

const UPLOAD_SEGMENT_SIZE = 1/*MB*/ * 1024 * 1024;

const TWITTER_MEDIA_COMMANDS = {
    Init: 'INIT',
    Append: 'APPEND',
    Finalize: 'FINALIZE',
    Status: 'STATUS',
};

const TWITTER_MEDIA_CATEGORY = {
    TweetImage: 'TweetImage',
    TweetVideo: 'TweetVideo',
    TweetGif: 'TweetGif',
};

const TWITTER_MEDIA_STATUS = {
    Pending: 'pending',
    InProgress: 'in_progress',
    Failed: 'failed',
    Succeeded: 'succeeded'
}

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.gif'];

const MIME_TO_MEDIA_CATEGORY = {
    'image/gif': TWITTER_MEDIA_CATEGORY.TweetGif,
    'image/jpeg': TWITTER_MEDIA_CATEGORY.TweetImage,
    'image/png': TWITTER_MEDIA_CATEGORY.TweetImage,
    'image/webp': TWITTER_MEDIA_CATEGORY.TweetImage,
}

var Sleep = function (ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

var ResolvePartialReaction = exports.ResolvePartialReaction = async function (reaction) {
    if (reaction.partial) {
        await reaction.fetch();
    }
};

var FetchTweetRecord = exports.FetchTweetRecord = async function (records, messageId) {
    return await records.doc(messageId).get();
}

var FetchTweetRecordByTwitterId = exports.FetchTweetRecord = async function (records, twitterId) {
    return (await records.where('Tweet', '==', `https://twitter.com/megadomesays/status/${twitterId}`).get())?.docs?.[0];
}

var CreateTweetRecord = exports.CreateTweetRecord = async function (records, messageId, sender, tweetUrl) {
    return await records.doc(messageId).set({
        HandledOn: Firebase.firestore.Timestamp.now(),
        Sender: sender,
        Tweet: tweetUrl
    });
}

var DeleteTweetRecord = exports.DeleteTweetRecord = async function (records, messageId) {
    return await records.doc(messageId).delete();
}

var NoTweetFound = exports.NoTweetFound = async function (records, reaction) {
    var record = await FetchTweetRecord(records, reaction.message.id);
    return !record.exists;
}

var GetKnownTweetUrl = exports.GetKnownTweetUrl = async function (records, reaction) {
    const record = await FetchTweetRecord(records, reaction.message.id);
    return ExtractTweetId(record.get('Tweet'));
}

const HumanErrorsByCode = {
    144: "That tweet no longer exists",
    170: "The message must contain some text (certain types of attachment are not supported)",
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
    } catch (error) {
        throw new Error(HumanizeTwitterError(error));
    }
}

var IsCompatibleAttachmentType = function (url) {
    const good_extension = SUPPORTED_EXTENSIONS.includes(path.extname(url).toLowerCase());
    if (!good_extension) {
        // this is gonna break lol; logging it so we can debug in prod
        console.log(`Did not process ${url} because the extension is not supported.`);
    }
    return good_extension;
}

var ExtractMediaAttachment = async function (url) {
    const result = await fetch(url);
    if (result.ok) {
        return await result.buffer();
    } else {
        throw new Error(`Failed to download attachment from discord (${result.status}): ${url}`);
    }
}

var PostTweet = exports.PostTweet = async function (records, twitter, upload_twitter, reaction) {
    let media_ids = [];
    if (reaction.message.attachments) {
        const attachments = reaction.message.attachments.first(4).map(attachment => attachment.url).filter(IsCompatibleAttachmentType);
        for (const attachment of attachments) {
            const buffer = await ExtractMediaAttachment(attachment);
            const mime_inference_result = await FileType.fromBuffer(buffer);
            media_ids.push((await UploadMedia(upload_twitter, buffer, mime_inference_result.mime)).media_id_string);
        }
    }
    const result = await ExecuteTwitterApiCall(async () => await twitter.post('statuses/update', { status: reaction.message.content, media_ids: media_ids.join(',') }));
    const url = `https://twitter.com/megadomesays/status/${result.id_str}`;
    await CreateTweetRecord(records, reaction.message.id, reaction.message.author.username, url);
    return url;
}

var ExtractTweetId = exports.ExtractTweetId = function (message) {
    const regex = /https:\/\/twitter\.com\/megadomesays\/status\/([0-9]+)/;
    const result = message.match(regex);
    if (result) {
        return result[1];
    } else {
        throw new Error(`Could not find a tweet to delete in ${message}"`);
    }
}

var DeleteTweet = exports.DeleteTweet = async function (records, twitter, id) {
    const result = await ExecuteTwitterApiCall(async () => await twitter.post(`statuses/destroy/${id}`));
    await DeleteTweetRecord(records, (await FetchTweetRecordByTwitterId(records, id)).id);
    return result;
}

var UploadMedia = exports.UploadMedia = async function (upload_twitter, buffer, mime) {

    if (!(mime in MIME_TO_MEDIA_CATEGORY)) {
        throw new Error(`Media upload failed; ${mime} is not a supported file type (must be one of ${Object.keys(MIME_TO_MEDIA_CATEGORY)})`);
    }

    // setup the media upload session; explicitly opt in to the modern async upload API by setting `media_category`
    const init = await ExecuteTwitterApiCall(async () => await upload_twitter.post(`media/upload`, {
        command: TWITTER_MEDIA_COMMANDS.Init,
        total_bytes: buffer.length,
        media_category: MIME_TO_MEDIA_CATEGORY[mime],
        media_type: mime,
    }));

    // initiate parallel uploads of UPLOAD_SEGMENT_SIZE chunks of the buffer
    let segment = 0;
    let start_byte = 0;
    let uploads = [];
    while (start_byte < buffer.length) {
        uploads.push(ExecuteTwitterApiCall(async () => await upload_twitter.post('media/upload', {
            command: TWITTER_MEDIA_COMMANDS.Append,
            media_id: init.media_id_string,
            segment_index: segment,
            media_data: buffer.toString('base64', start_byte, Math.min(start_byte + UPLOAD_SEGMENT_SIZE, buffer.length))
        })));
        segment++;
        start_byte += UPLOAD_SEGMENT_SIZE;
    }
    await Promise.all(uploads);

    // Send the finalize command, and then poll for asymc upload status until either succes or failure is reported.
    let finalize = await ExecuteTwitterApiCall(async () => await upload_twitter.post('media/upload', {
        command: TWITTER_MEDIA_COMMANDS.Finalize,
        media_id: init.media_id_string
    }));
    while (finalize?.processing_info?.state == TWITTER_MEDIA_STATUS.InProgress) {
        await Sleep(finalize.processing_info.check_after_secs * 1000);
        finalize = await ExecuteTwitterApiCall(async () => await upload_twitter.get('media/upload', {
            command: TWITTER_MEDIA_COMMANDS.Status,
            media_id: init.media_id_string
        }));
    }

    if (finalize?.processing_info?.state == TWITTER_MEDIA_STATUS.Failed) {
        throw new Error(`Media upload failed with error ${finalize.processing_info.error.name}: ${finalize.processing_info.error.message}"`);
    }

    return finalize;
}