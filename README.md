# Megadome Says

A discord bot that will create tweets in response to user reactions.

## Prerequisites

1. A Twitter Developer Account and API keys.
2. A Discord Bot Account and Access Token (and the bot is joined to your server).
3. A Cloud Firestore Service Account and Firebase collection called "Tweets"
4. A Discord emoji named `tweetThis`
5. A Debian/Ubuntu server that is newish..and has a newish Node/NPM installed.

## Setup

Something like this...

```
cd /var/lib/megadome-says`
git clone git@github.com:HUU/MegadomeSays.git .
npm ci
useradd -r discord-bots
chmod -R discord-bots:discord-bots .
```

Gather together all of the API secrets for Twitter, Discord, and Cloud Firestore and put them in `.env` within the app directory like so:

```
TWITTER_CONSUMER_SECRET=...
TWITTER_ACCESS_TOKEN_SECRET=...
DISCORD_TOKEN=...
FIREBASE_PRIVATE_KEY="..."
```
(be mindful of the quotes above, the GCP service account private key will contain special characters)

...then you just need to put this in `/etc/init.d/megadome-says`:

```
#! /bin/sh
#
### BEGIN INIT INFO
# Provides:             megadome-says
# Required-Start:       $network $local_fs $remote_fs
# Required-Stop:        $network $local_fs $remote_fs
# Default-Start:        2 3 4 5
# Default-Stop:         0 1 6
# Short-Description:    Megadome Says Discord Bot
# Description:          init script for the Megadome Says discord bot.
### END INIT INFO

PATH=/sbin:/bin:/usr/sbin:/usr/bin
NAME=megadome-says
DESC="Megadome Says Discord Bot"
PIDDIR=/run/$NAME
PIDFILE=$PIDDIR/$NAME.pid
DAEMON=/usr/bin/node
NODE_APP_DIR="/var/lib/megadome-says"
NODE_APP="bot.js"
USER=discord-bots
GROUP=discord-bots

. /lib/init/vars.sh
. /lib/lsb/init-functions

case "$1" in
  start)
        [ "$VERBOSE" != no ] && log_daemon_msg "Starting $DESC" "$NAME"
        [ -d $PIDDIR ] || install -o $USER -d $PIDDIR
        start-stop-daemon --start --quiet \
            --pidfile $PIDFILE \
            --chuid $USER:$GROUP \
            --chdir $NODE_APP_DIR \
            --exec $DAEMON \
            --make-pidfile \
            --background \
            -- $NODE_APP
        case "$?" in
                0|1) [ "$VERBOSE" != no ] && log_end_msg 0 ;;
                2) [ "$VERBOSE" != no ] && log_end_msg 1 ;;
        esac
        ;;
  stop)
        [ "$VERBOSE" != no ] && log_daemon_msg "Stopping $DESC" "$NAME"
        start-stop-daemon --stop --quiet \
                --pidfile $PIDFILE \
                --user $USER \
                --retry 5 \
                --signal TERM
        case "$?" in
                0|1)    rm -f $PIDFILE
                        [ "$VERBOSE" != no ] && log_end_msg 0
                        ;;
                2) [ "$VERBOSE" != no ] && log_end_msg 1 ;;
        esac
        ;;
  status)
        if start-stop-daemon --test --stop --quiet \
                --pidfile $PIDFILE \
                --user $USER \
                --exec $DAEMON
        then
                [ "$VERBOSE" != no ] && echo "$DESC is running."
                exit 0
        else
                [ "$VERBOSE" != no ] && echo "$DESC is not running"
                exit 3
        fi
        ;;
  force-reload)
        start-stop-daemon --stop --test --quiet \
                --pidfile $PIDFILE \
                --user $USER \
                --exec $DAEMON \
        && $0 restart || exit 0
        ;;
  restart)
        [ "$VERBOSE" != no ] && log_daemon_msg "Restarting $DESC" "$NAME"
        start-stop-daemon --stop --quiet \
                --signal TERM \
                --retry 5 \
                --pidfile $PIDFILE \
                --user $USER
        case "$?" in
                0|1)
                        [ -d $PIDDIR ] || install -o $USER -d $PIDDIR
                        rm -f $PIDFILE
                        start-stop-daemon --start --quiet \
                                --pidfile $PIDFILE \
                                --chuid $USER:$GROUP \
                                --chdir $NODE_APP_DIR \
                                --exec $DAEMON \
                                -- $NODE_APP
                        case "$?" in
                                0) [ "$VERBOSE" != no ] && log_end_msg 0 ;;
                                *) [ "$VERBOSE" != no ] && log_end_msg 1 ;;
                        esac
                        ;;
                *)
                        [ "$VERBOSE" != no ] && log_end_msg 0
                        ;;
        esac
        ;;
  *)
        N=/etc/init.d/$NAME
        echo "Usage: $N {start|stop|restart|force-reload}" >&2
        exit 3
        ;;
esac

exit 0
```

Good luck I hate this.