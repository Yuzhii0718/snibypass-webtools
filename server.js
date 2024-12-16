'use strict';
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const port = 1126;
const colors = require('colors-console')

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const basePath = './';
const configDir = path.join(basePath, 'snibypass', 'config');

app.get('/list-configs', (req, res) => {
    fs.readdir(configDir, (err, files) => {
        if (err) {
            return res.status(500).send('无法读取配置目录');
        }
        const configFiles = files.filter(file => file.startsWith('config-') && file.endsWith('.json'));
        if (configFiles.length === 0) {
            return res.status(404).send('没有找到配置文件');
        }
        res.send(configFiles.sort().reverse());
    });
});

app.post('/read-config', (req, res) => {
    const { configFile } = req.body;
    if (!configFile) {
        return res.status(400).send('缺少文件名参数');
    }
    const filePath = path.join(configDir, configFile);
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('无法读取配置文件');
        }
        res.send(data);
    });
});

app.post('/save-config', (req, res) => {
    const content = req.body.content;
    const configFileName = req.body.configFileName;
    const date = new Date();
    const fileName = configFileName ? configFileName : `config-${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}-${date.getTime()}.json`;
    const filePath = path.join(configDir, fileName);

    fs.mkdir(configDir, { recursive: true }, (err) => {
        if (err) {
            return res.status(500).send('无法创建配置目录');
        }
        fs.writeFile(filePath, content, 'utf8', (err) => {
            if (err) {
                return res.status(500).send('无法保存配置文件');
            }
            res.send('配置文件已保存');
        });
    });
});

app.get('/del-config', (req, res) => {
    const fileName = req.query.fileName;
    if (!fileName) {
        return res.status(400).send('缺少文件名参数');
    }
    const filePath = path.join(configDir, fileName);
    fs.unlink(filePath, (err) => {
        if (err) {
            return res.status(500).send('无法删除配置文件');
        }
        res.send('配置文件已删除');
    });
});

app.post('/open-browser', (req, res) => {
    const { browserPath, params } = req.body;
    const command = `"${browserPath}" ${params}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            res.json({ error: error.message });
            return;
        }
        res.json({ stdout: stdout, stderr: stderr });
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'snibypass.html'));
});

app.listen(port, () => {
    console.log && console.info(colors('green', 'INFO') +"  " + `snibypass is running at http://localhost:${port}/ . Press Ctrl+C to stop.`);
});

exec(`start http://localhost:${port}`, (error, stdout, stderr) => {
    if (error) {
        console.log && console.error(colors('red', 'ERROR') +"  " + 'Can not open browser: ${error.message}');
        return;
    }
});

process.on('SIGINT', () => {
    console.log && console.info(colors('green', 'INFO') +"  " + 'good bye!');
    process.exit();
});