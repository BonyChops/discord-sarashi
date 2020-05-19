const Discord = require('discord.js');
const client = new Discord.Client();
const fs = require('fs');
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
const accessTokens = JSON.parse(fs.readFileSync(__dirname+"/config.json", "utf-8"))
const accessTokenDiscord = accessTokens.discord.accessToken;
const puppeteer = require('puppeteer');
const Twitter = require('twitter');
let OSData = null;
let RaspberryPi = false;
try{ OSData = fs.readFileSync("/etc/os-release", "utf-8")}catch(error){ console.log("Failed to load OS Data.")};
if(OSData !== null){
    if(OSData.split("\n").filter(q => q.search(/ID\s*=\s*raspbian/) !== -1).length > 0){
        console.log("Boot in Raspberry Pi mode!");
        RaspberryPi = true;
    }
}
console.log("Loading...");
const twClient = new Twitter({
    consumer_key: accessTokens.twitter.consumerKey,
    consumer_secret: accessTokens.twitter.consumerSecret,
    access_token_key: accessTokens.twitter.accessToken,
    access_token_secret:  accessTokens.twitter.accessTokenSecret
});
let cacheMsg = false;

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', async(msg) => {
  if ((pos = msg.content.search(/^\!shareChat$/) !== -1)||(pos = msg.content.search(/^\!shareChat\s*.+?$/) !== -1)) {
    if(cacheMsg === false){
        msg.reply("起動したては無理です！");
    }else{
        await msg.delete();
        typing(msg.channel);
        await captureScreen(cacheMsg, msg.content.substr(pos+10).trim());
        msg.channel.stopTyping();
    }
  }else{
      cacheMsg = msg;
  }

});

client.login(accessTokenDiscord);

function typing(channel) {
    return new Promise(function (resolve) {

        channel.startTyping();

    });
}

const formatDate = (date, format) =>  {
    format = format.replace(/yyyy/g, date.getFullYear());
    format = format.replace(/MM/g, ('0' + (date.getMonth() + 1)).slice(-2));
    format = format.replace(/dd/g, ('0' + date.getDate()).slice(-2));
    format = format.replace(/HH/g, ('0' + date.getHours()).slice(-2));
    format = format.replace(/mm/g, ('0' + date.getMinutes()).slice(-2));
    format = format.replace(/ss/g, ('0' + date.getSeconds()).slice(-2));
    format = format.replace(/SSS/g, ('00' + date.getMilliseconds()).slice(-3));
    return format;
  };

const captureScreen = async(msg, twStatus = "") =>{
    console.log("Logging in...");
    let browser;
    if(!RaspberryPi){
        browser = await puppeteer.launch();
    }else{
        browser = await puppeteer.launch({
            headless: true,
            executablePath: '/usr/bin/chromium-browser'
        });
    }
    const page = await browser.newPage();
    const mouse = page.mouse;
    const width = 1600;
    const height = 950;
    const targetElementSelector = '.chatContent-a9vAAp';
    const targetElementToClose = '.dismiss-SCAH9H';
    const date = formatDate(new Date(), 'yyyyMMddHHmmssSSS');
    await page.setViewport({width: width, height: height});
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36');
    try{
        await page.goto(`https://discord.com/channels/${msg.guild.id}/${msg.channel.id}/${msg.id}`, {waitUntil: 'domcontentloaded'});
        await page.waitForNavigation()
        await page.type('input[type="email"]', accessTokens.discord.mail);
        await page.type('input[type="password"]', accessTokens.discord.password);
        page.click('button[type="submit"]');
        console.log("loged in");
        //await page.waitForNavigation({ waitUntil: 'networkidle0' });
        await await page.waitFor(targetElementSelector);
        await console.log("wait");
        await sleep(3000);
        await mouse.move(parseFloat(width - 20), parseFloat(20))
        for (let i = 0; i < 2; i++) {
            await mouse.click(parseFloat(width - 20), parseFloat(20), {
                button: 'left',
                clickCount: 1,
                delay: 0,
            });
            console.log("click");
            await sleep(700);
        }
        console.log("fin");
        //const afterCookies = await page.cookies();
        //fs.writeFileSync(__dirname+"/../cookie.json", JSON.stringify(afterCookies));
        const clip = await page.evaluate(s => {
            const el = document.querySelector(s)
            // エレメントの高さと位置を取得
            const { width, height, top: y, left: x } = el.getBoundingClientRect()
            return { width, height, x, y }
        }, targetElementSelector);
        clip.height += clip.y;
        clip.y = 0;
        await page.screenshot({clip, path: __dirname+`/image_cache/${date}.png`});
        await browser.close();
    }catch(error){
        msg.reply("無理でした");
    }

    // Load your image
    const image = await require('fs').readFileSync(__dirname+`/image_cache/${date}.png`);

    twClient.post('media/upload', {media: image}, function(error, media, response) {

      if (!error) {

        //console.log(media);

        const status = {
          status: twStatus,
          media_ids: media.media_id_string
        }

        twClient.post('statuses/update', status);

      }
    });
    try {
        fs.unlinkSync(__dirname+`/image_cache/${date}.png`);
        console.log('削除しました。');
    } catch (error) {
        throw error;
    }
    console.log("Successful!!!");
}