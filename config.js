const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  twitter: {
    consumer_key: 'NAdHl6g9VtMLch6yQFm0t9vha' ,  
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token_key: '1386034701538897921-rkSFyDJrwHSXGy2wjlJhI5KbTqoENN',  
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  },
  discord: {
      application_id: '835604877480689724',
      public_key: '66cc8b72956d2801ff3ee7ca244e924a79ec19eabc4eafd5bc28279ad68c7561',
      token: process.env.DISCORD_TOKEN,
  },
  firebase: {
    type: 'service_account',
    project_id: 'carbide-atlas-286002',
    private_key_id: '54ee7cbf0f2ea827154ee52762ea28635dee89fe',
    private_key: process.env.FIREBASE_PRIVATE_KEY,
    client_email: 'megadome-says@carbide-atlas-286002.iam.gserviceaccount.com',
    client_id: '111750789377077480452',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/megadome-says%40carbide-atlas-286002.iam.gserviceaccount.com'
  }
}