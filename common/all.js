function copyResult() {
    var copyText = document.getElementById("out");
    copyText.select();
    copyText.setSelectionRange(0, 99999); // For mobile devices
    document.execCommand("copy");
    $('#err').text("执行结果已复制到剪贴板");
}

function openBrowser() {
    var browserPath = document.getElementById("browserPath").value;
    var params = document.getElementById("out").value.trim(); // 获取执行结果作为参数

    fetch('/open-browser', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ browserPath: browserPath, params: params })
    })
        .then(response => {
            response.json()
        })
        .then(data => {
            if (data.error) {
                console.error(`执行错误: ${data.error}`);
            } else {
                console.log(`stdout: ${data.stdout}`);
                console.error(`stderr: ${data.stderr}`);
            }
        })
        .catch(error => {
            console.error('请求失败')
            $('#err').text("浏览器已停止：" + error.message);
        });
}

function fetchConfigFiles() {
    fetch('/list-configs', {
        method: 'GET'
    })
        .then(async response => {
            if (!response.ok) {
                const text = await response.text();
                throw new Error(text);
            }
            return response.json();
        })
        .then(files => {
            const select = document.getElementById('configFiles');
            files.forEach(file => {
                const option = document.createElement('option');
                option.value = file;
                option.textContent = file;
                select.appendChild(option);
            });
        })
        .catch(error => {
            alert(error.message);
            document.getElementById('err').textContent = "处理时出错：" + error.message;
        });
}

function clearConfigFiles() {
    const select = document.getElementById('configFiles');
    while (select.firstChild) {
        select.removeChild(select.firstChild);
    }
}

function readConfig(fileName) {
    var configFile = document.getElementById("configFiles").value;
    fetch(`/read-config`, {
        method: 'post',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ configFile: configFile })
    })
        .then(async response => {
            if (!response.ok) {
                const text = await response.text();
                throw new Error(text);
            }
            return response.text();
        })
        .then(data => {
            document.getElementById('in').value = data;
            $('#err').text("读取成功");
        })
        .catch(error => {
            alert(error.message);
            $('#err').text("读取失败: " + error.message);
        });
}

function saveConfig() {
    const content = document.getElementById('in').value;
    let configFileName = document.getElementById('configFileName').value;
    if (configFileName) {
        if (!configFileName.endsWith('.json')) {
            configFileName += '.json';
        }
        if (!configFileName.startsWith('config-')) {
            configFileName = 'config-' + configFileName;
        }
    }
    fetch('/save-config', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: content, configFileName: configFileName })
    })
        .then(async response => {
            if (!response.ok) {
                const text = await response.text();
                throw new Error(text);
            }
            return response.text();
        })
        .then(response => {
            //先清空列表
            clearConfigFiles();
            //再获取列表
            fetchConfigFiles();
            $('#err').text("保存成功");
        })
        .catch(error => {
            alert(error.message);
            $('#err').text("保存失败: " + error.message);
        });
}

function delConfig() {
    const userConfirmed = confirm("确定要删除配置吗？");
    if (userConfirmed) {
        // 执行删除操作
        const select = document.getElementById('configFiles');
        const selectedOption = select.options[select.selectedIndex];
        if (selectedOption) {
            const fileName = document.getElementById('configFiles').value;
            fetch(`/del-config?fileName=${encodeURIComponent(fileName)}`, {
                method: 'GET'
            })
                .then(async response => {
                    if (!response.ok) {
                        const text = await response.text();
                        throw new Error(text);
                    }
                    return response.text();
                })
                .then(response => {
                    $('#err').text("配置已删除");
                    clearConfigFiles(); // 清空列表
                    fetchConfigFiles(); // 重新获取列表
                })
                .catch(error => {
                    alert(error.message);
                    $('#err').text("删除时出错：" + error.message);
                });
        } else {
            alert("请选择要删除的配置");
            $('#err').text("请选择要删除的配置");
        }
    }
}

// 常量
const CealHostRulesDict = {};
const jsonUrl = 'https://ghproxy.net/https://raw.githubusercontent.com/SpaceTimee/Cealing-Host/refs/heads/main/Cealing-Host.json';

function processData(inputValue) {
    const cealHostName = "NO";

    try {
        CealHostRulesDict[cealHostName] = [];

        let cealHostRulesFragments = '';
        let cealHostResolverRulesFragments = '';
        let nullSniNum = 0;
        inputValue.forEach(cealHostRule => {
            let cealHostDomainPairs = [];
            const cealHostSni = cealHostRule[1] === null || !cealHostRule[1].trim() ?
                `${cealHostName}${CealHostRulesDict[cealHostName].length}` : cealHostRule[1].trim();
            const cealHostIp = cealHostRule[2] && cealHostRule[2].trim() ? cealHostRule[2].trim() : "127.0.0.1";

            cealHostRule[0].forEach(cealHostDomain => {
                const domainString = cealHostDomain.toString().trim();
                if (domainString.startsWith('^') || domainString.startsWith('#') || domainString.startsWith('$')) return;

                const cealHostDomainPair = domainString.split('^', 2);
                cealHostDomainPairs.push([cealHostDomainPair[0].trim(), cealHostDomainPair[1]?.trim() || '']);
            });

            CealHostRulesDict[cealHostName].push({ cealHostDomainPairs, cealHostSni, cealHostIp });
        });

        CealHostRulesDict[cealHostName].forEach(({ cealHostDomainPairs, cealHostSni, cealHostIp }) => {
            const cealHostSniWithoutNull = cealHostSni || `${cealHostName}${++nullSniNum}`;
            let isValidCealHostDomainExist = false;

            cealHostDomainPairs.forEach(([cealHostIncludeDomain, cealHostExcludeDomain]) => {
                if (cealHostIncludeDomain.startsWith('$')) return;

                cealHostRulesFragments += `MAP ${cealHostIncludeDomain.replace('#', '')} ${cealHostSniWithoutNull}`;
                if (cealHostExcludeDomain) {
                    cealHostRulesFragments += `,EXCLUDE ${cealHostExcludeDomain}`;
                }
                cealHostRulesFragments += ',';
                isValidCealHostDomainExist = true;
            });

            if (isValidCealHostDomainExist) {
                cealHostResolverRulesFragments += `MAP ${cealHostSniWithoutNull} ${cealHostIp},`;
            }
        });

        const cealArgs = ` --host-rules="${cealHostRulesFragments.trimEnd(',')}" --host-resolver-rules="${cealHostResolverRulesFragments.trimEnd(',')}" --test-type --ignore-certificate-errors`;

        return cealArgs;

    } catch (error) {
        console.error("处理过程中出错：", error);
        $('#err').text("处理数据时出错：" + error.message);
        return null;
    }
}

function fetchData() {
    $('#err').empty();

    fetch(jsonUrl)
        .then(response => response.text())
        .then(data => {
            $('#in').val(data);
            $('#err').text("抓取成功");
        })
        .catch(error => {
            console.error("加载 JSON 数据时出错：", error);
            $('#err').text("抓取数据失败！可能是网络问题。" + error.message);
        });
}

function processDataFromin() {
    $('#err').empty();

    try {
        const inputValue = JSON.parse($('#in').val());
        const processedData = processData(inputValue);
        if (processedData) {
            $('#out').val(processedData);
            $('#err').text("处理成功");
        }
    } catch (error) {
        console.error("输入数据解析时出错：", error);
        $('#err').text("输入数据解析失败：" + error.message);
    }
}

function showUserAgreement() {
    const modal = document.getElementById('userAgreementModal');
    const agreeButton = document.getElementById('agreeButton');
    let countdown = 3;

    modal.style.display = 'block';

    const interval = setInterval(function () {
        countdown--;
        agreeButton.textContent = `同意 (${countdown})`;
        if (countdown === 0) {
            clearInterval(interval);
            agreeButton.disabled = false;
            agreeButton.textContent = '同意';
        }
    }, 1000);

    agreeButton.addEventListener('click', function () {
        modal.style.display = 'none';
    });
}

function writeToUserAgreement(text) {
    const userAgreementTextarea = document.getElementById('userAgreement');
    userAgreementTextarea.value = text;
}

async function getDefault() {
    try {
        const response = await fetch('/get-default');
        const data = await response.json();

        const googleip = data.googleip;
        const randomIp = googleip[Math.floor(Math.random() * googleip.length)];
        const defaultData = data.defaultData;
        const modifiedData = defaultData.replace('"NO"', `"${randomIp}"`);

        $('#in').val(modifiedData);
        $('#out').val(processData(JSON.parse(modifiedData)));
        $('#err').text("默认数据已加载");

        const isDark = data.isDark;
        if (isDark) {
            document.body.classList.toggle('night-mode');
        }

        // 传入信息
        const version = data.version;
        document.getElementById('version').textContent = version;
        const agreementText = data.agreementText;
        writeToUserAgreement(agreementText);
        const tips = data.tips;
        document.getElementById('tips').textContent = tips;

        // 动态生成浏览器选项
        const browserSelect = document.getElementById('browserSelect');
        data.browsers.forEach(browser => {
            const option = document.createElement('option');
            option.value = browser.path;
            option.textContent = browser.name;
            if (browser.description) {
                option.title = browser.description;
            }
            browserSelect.appendChild(option);
        });

        updateInputPath();
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

function updateBrowserPath() {
    const browserSelect = document.getElementById('browserSelect');
    const browserPath = document.getElementById('browserPath');
    if (browserSelect.value === "custom") {
        browserPath.value = "";
        browserPath.readOnly = false;
    } else {
        browserPath.value = browserSelect.value;
        browserPath.readOnly = true;
    }
}

function updateInputPath() {
    const browserSelect = document.getElementById('browserSelect');
    const browserPath = document.getElementById('browserPath');
    if (browserSelect.options.length > 0) {
        browserPath.value = browserSelect.options[0].value;
        browserPath.readOnly = true;
    }
}

// 需要在页面加载完成后执行的代码
getDefault();
clearConfigFiles();
fetchConfigFiles();
showUserAgreement();
