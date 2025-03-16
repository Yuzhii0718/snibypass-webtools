'use strict';
// Import libraries
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
let port = 11216;
const colors = require('colors-console')
const winston = require('winston');
require('winston-daily-rotate-file');
const net = require('net');
const ping = require('ping');

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Define path to the static files
const basePath = './';
const ruleDir = path.join(basePath, 'rules');
const logDir = path.join(basePath, 'logs');
const staticDir = path.join(basePath, 'static');
const configDir = path.join(basePath, 'config');
const defaultConfigPath = path.join(configDir, 'default.json');

// log
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const transport = new (winston.transports.DailyRotateFile)({
    filename: path.join(logDir, '%DATE%.log'),
    datePattern: 'YYYYMMDD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d'
});

const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(info => `${info.message}`)
    )
});

// Override console.log, console.info, console.error, console.warn
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
    transports: [
        transport,
        consoleTransport
    ]
});

console.log = function (message) {
    logger.log(message);
};
console.info = function (message) {
    logger.info(colors('green', 'INFO') + "  " + message);
};
console.error = function (message) {
    logger.error(colors('red', 'ERROR') + "  " + message);
};
console.warn = function (message) {
    logger.warn(colors('yellow', 'WARN') + "  " + message);
};

// Get a random port
function getRandomPort(callback) {
    const port = Math.floor(Math.random() * (65535 - 10000 + 1)) + 10000;
    const server = net.createServer();
    server.listen(port, () => {
        server.once('close', () => {
            callback(port);
        });
        server.close();
    });
    server.on('error', () => {
        getRandomPort(callback);
    });
}

// Read port from default.json
fs.readFile(defaultConfigPath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading default.json:', err);
    } else {
        try {
            const config = JSON.parse(data);
            if (config.port) {
                if (config.port === 'random') {
                    getRandomPort((randomPort) => {
                        port = randomPort;
                        startServer();
                    });
                } else {
                    port = config.port;
                    startServer();
                }
            } else {
                startServer();
            }
        } catch (parseErr) {
            console.error('Error parsing default.json:', parseErr);
            startServer();
        }
    }
});

// Start server
function startServer() {
    app.listen(port, () => {
        console.log && console.info(`snibypass is running at http://localhost:${port}/ . Press Ctrl+C to stop.`);
    });

    exec(`start http://localhost:${port}`, (error, stdout, stderr) => {
        if (error) {
            console.log && console.error('Can not open browser: ${error.message}');
            return;
        }
    });
}

// Exit process
process.on('SIGINT', () => {
    console.log && console.info('Good Bye!');
    process.exit();
});

// Functions
app.get('/list-rules', (req, res) => {
    fs.readdir(ruleDir, (err, files) => {
        if (err) {
            console.log && console.error('Can not read fake sni directory: ' + err.message);
            return res.status(500).send('无法读取伪造列表目录');
        }
        const ruleFiles = files.filter(file => file.startsWith('sni-') && file.endsWith('.json'));
        if (ruleFiles.length === 0) {
            console.log && console.error('No fake sni file found');
            return res.status(404).send('没有找到伪造列表文件');
        }
        res.send(ruleFiles.sort().reverse());
    });
});

app.post('/read-rule', (req, res) => {
    const { ruleFile } = req.body;
    if (!ruleFile) {
        console.log && console.error('No fake sni file name provided');
        return res.status(400).send('缺少文件名参数');
    }
    const filePath = path.join(ruleDir, ruleFile);
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.log && console.error('Can not read fake sni file: ' + err.message);
            return res.status(500).send('无法读取配置文件');
        }
        console.log && console.info('Read fake sni file: ' + ruleFile);
        res.send(data);
    });
});

app.post('/save-rule', (req, res) => {
    const content = req.body.content;
    const ruleFileName = req.body.ruleFileName;
    const date = new Date();
    const fileName = ruleFileName ? ruleFileName : `sni-${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}-${date.getTime()}.json`;
    const filePath = path.join(ruleDir, fileName);

    if (fileName === 'sni-default.json') {
        return res.status(400).send('"default" 是保留文件名，不能使用');
    }

    fs.mkdir(ruleDir, { recursive: true }, (err) => {
        if (err) {
            console.log && console.error('Can not create fake sni directory: ' + err.message);
            return res.status(500).send('无法创建伪造列表目录');
        }
        fs.writeFile(filePath, content, 'utf8', (err) => {
            if (err) {
                console.log && console.error('Can not save fake sni file: ' + err.message);
                return res.status(500).send('无法保存伪造列表文件');
            }
            console.log && console.info('Fake sni file ' + fileName + ' saved');
            res.send('伪造列表文件已保存');
        });
    });
});

app.get('/del-rule', (req, res) => {
    const fileName = req.query.fileName;
    if (!fileName) {
        console.log && console.error('No fake sni file name provided');
        return res.status(400).send('缺少文件名参数');
    }
    const filePath = path.join(ruleDir, fileName);
    fs.unlink(filePath, (err) => {
        if (err) {
            console.log && console.error('Can not delete faek sni file: ' + err.message);
            return res.status(500).send('无法删除伪造列表文件');
        }
        console.log && console.info('Delete faek sni file: ' + fileName);
        res.send('伪造列表文件已删除');
    });
});

app.post('/open-browser', (req, res) => {
    const { browserPath, params } = req.body;
    const command = `"${browserPath}" ${params}`;

    console.log && console.info('Browser opened');

    exec(command, (error, stdout, stderr) => {
        if (error) {
            res.json({ error: error.message });
            console.log && console.error('Can not open browser');
            return;
        }
        res.json({ stdout: stdout, stderr: stderr });
    });
});

app.get('/stop-browser', (req, res) => {
    console.log && console.info('Browser stopped');
});

app.get('/get-default', (req, res) => {
    const defaultPath = path.join(configDir, 'default.json');
    fs.readFile(defaultPath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading default.json:', err);
            res.status(500).send('Internal Server Error');
            return;
        }
        console.log && console.info('Read default.json');
        res.json(JSON.parse(data));
    });
});

app.get('/get-js', (req, res) => {
    const jsPath = path.resolve(staticDir, 'page.js');
    fs.readFile(jsPath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading page.js:', err);
            res.status(500).send('Internal Server Error');
            return;
        }
        console.log && console.info('page.js loaded');
        res.send(data);
    });
});

app.post('/ping-mirrors', async (req, res) => {
    const { domains } = req.body;
    let fastestDomain = null;
    let minAvgPing = Infinity;

    for (const domain of domains) {
        try {
            const result = await ping.promise.probe(domain);
            if (result.avg && result.avg < minAvgPing) {
                minAvgPing = result.avg;
                fastestDomain = domain;
            }
        } catch (error) {
            console.error(`Error pinging ${domain}:`, error);
        }
    }

    res.json({ fastestDomain });

    console.log && console.info('Ping mirrors');
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'snibypass.html'));
    console.log && console.info('html loaded');
});

app.get('/onlyweb', (req, res) => {
    res.sendFile(path.join(__dirname, 'snibypass-onlyWeb.html'));
    console.log && console.info('onlyWeb.html loaded');
});
