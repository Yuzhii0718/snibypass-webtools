const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const app = express();
const port = 1126;

app.use(cors()); // 允许所有来源的跨域请求
app.use(express.json());

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

app.listen(port, () => {
    // console.log(`服务器正在运行在 http://localhost:${port}`);
    console.log(`服务器正在运行 Ctrl+C 停止`);
});