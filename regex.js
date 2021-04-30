/*
    Regex Fragment                     | Meaning
    ==============================================
    (?<emoji>                          | Named Capture Group emoji...
             <                         | matches the character < literally (case sensitive)
              \:                       | \: matches the character : literally (case sensitive)
                [a-zA-Z0-9]            | Match a single character present in the list below [a-zA-Z0-9]
                           +           | + matches the previous token between one and unlimited times (greedy)
                            \:         | \: matches the character : literally (case sensitive)
                              \d       | matches a digit (equivalent to [0-9])
                                {18}   | matches the previous token exactly 18 times
                                    >  | matches the character > literally (case sensitive)
                                     ) | ...end of Named Capture Group

    Example string: test <:tweetThis:835610520488247346>
*/
global.discord_emoji_regex = /(?<emoji><\:[a-zA-Z0-9]+\:\d{18}>)/;

/*
    Regex Fragment       | Meaning
    ==============================================
    (?<at>               | Named Capture Group emoji...
          <              | matches the character < literally (case sensitive)
           \@            | \@ matches the character @ literally (case sensitive)
             \!          | \! matches the character ! literally (case sensitive)
               \d        | matches a digit (equivalent to [0-9])
                 {18}    | matches the previous token exactly 18 times
                     >   | matches the character > literally (case sensitive)
                      )  | ...end of Named Capture Group

    Example string: test <@!393183902736449546>
*/
global.discord_at_regex = /(?<at><\@\!\d{18}>)/;

var IdentifyRegexInMessage = exports.IdentifyRegexInMessage = async function(regex, message) {
    const result = message.match(regex);
    if (result) {
        console.log(`Found a match for ${regex} in ${message}`);
        return true;
    } else {
        console.log(`Could not find a match for ${regex} in ${message}`);
        return false;
    }  
}

var StripRegexMatchFromMessage = exports.StripRegexMatchFromMessage = async function () {
    return message.replace(regex)
}