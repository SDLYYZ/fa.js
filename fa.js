const http = require('http'),
      url = require('url'),
      querystring = require('querystring'),
      child_process = require('child_process'),
      util = require('util'),
      path = require('path'),
      os = require('os'),
      crypto = require("crypto");
      fs = require('fs');

const config = {
    listenAddress: '0.0.0.0',
    listenPort: 8081,
    sayCommand: '/usr/bin/say',
    ffmpegCommand: '/usr/local/bin/ffmpeg',
    queryMaxLength: 1024,
    uid: 70,
    gid: 20
};

const execFileAsync = util.promisify(child_process.execFile);
const unlinkAsync = util.promisify(fs.unlink);

http.createServer(async (req, res) => {
    try {
        const parsedUrl = url.parse(req.url);
        const parsedQuery = querystring.parse(parsedUrl.query);

        if (parsedQuery.text.length > config.queryMaxLength) {
            throw new Error('Too long');
        }

        const randomID = crypto.randomBytes(16).toString('hex'),
              aiffFile = path.join(os.tmpdir(), `${randomID}.aiff`);
    
        await execFileAsync(config.sayCommand, ['-o', aiffFile, '-v', parsedQuery.voice, parsedQuery.text]);
        const convertResult = await execFileAsync(
            config.ffmpegCommand,
            ['-i', aiffFile, '-f', 'mp3', '-acodec', 'libmp3lame', '-ab', '192000', '-ar', '44100', '-'],
            {
                encoding: 'buffer',
                maxBuffer: 32 * 1024 * 1024
            }
        );

        const mp3Data = convertResult.stdout;

        await unlinkAsync(aiffFile);
 
        res.writeHead(200, {
            'Content-Type': 'audio/mp3',
            'Content-Length': mp3Data.length
        });
    
        res.end(mp3Data);
    } catch (e) {
        res.writeHead(500, {
            'Content-Type': 'text/plain'
        });

        res.end(e.stack);
    }
}).listen(config.listenPort, config.listenAddress, function() {
    console.error(`Listening on ${config.listenAddress}:${config.listenPort}.`);
});
