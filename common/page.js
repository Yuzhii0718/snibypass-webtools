const CealHostRulesDict = {};
const originalUrl = 'https://raw.githubusercontent.com/SpaceTimee/Cealing-Host/refs/heads/main/Cealing-Host.json';
let jsonUrl = originalUrl;

function updateMirrorPath() {
    const mirrorSelect = $('#mirrorSelect')[0];
    const mirrorUrl = mirrorSelect.value;
    if (mirrorUrl) {
        jsonUrl = mirrorUrl + originalUrl;
        $('#mirrorPath').val(jsonUrl);
        $('#err').text("🎉镜像已更新");
    } else {
        $('#err').text("⚠️使用默认镜像");
    }
    console.log("当前镜像：" + jsonUrl);
}

function getFastestMirror() {
    const select = document.getElementById('mirrorSelect');
    const options = Array.from(select.options);
    const urls = options.map(option => option.value);
    const domains = urls.map(url => {
        try {
            return url ? new URL(url).hostname : 'raw.githubusercontent.com';
        } catch (e) {
            console.error(`Invalid URL: ${url}`);
            return 'raw.githubusercontent.com';
        }
    }).filter(domain => domain !== null);

    document.getElementById('mirrorSpinner').style.display = 'inline-block';

    fetch('/ping-mirrors', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ domains })
    })
        .then(response => response.json())
        .then(data => {
            document.getElementById('mirrorSpinner').style.display = 'none';
            const fastestDomain = data.fastestDomain;
            const fastestOption = options.find(option => {
                try {
                    return new URL(option.value).hostname === fastestDomain;
                } catch (e) {
                    return false;
                }
            });
            if (fastestOption) {
                select.value = fastestOption.value;
                updateMirrorPath();
            }
        })
        .catch(error => {
            document.getElementById('mirrorSpinner').style.display = 'none';
            console.error('Error:', error);
            $('#err').text("⚠️获取镜像时出错，可能是网络问题：" + error.message);
        });
}

function processData(inputValue) {
    const cealHostName = "NO";
    const sharpProcessChecked = $('#sharpProcess').is(':checked');
    const dollorProcessChecked = $('#dollorProcess').is(':checked');

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
                if ((!sharpProcessChecked && domainString.startsWith('#')) || (!dollorProcessChecked && domainString.startsWith('$')) || domainString.startsWith('^')) return;

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

        const cealArgs = ` --host-rules="${cealHostRulesFragments.trimEnd(',')}" --host-resolver-rules="${cealHostResolverRulesFragments.trimEnd(',')}" --test-type --ignore-certificate-errors --disable-web-security`;

        return cealArgs;

    } catch (error) {
        console.error("处理过程中出错：", error);
        $('#err').text("⚠️处理数据时出错：" + error.message);
        return null;
    }
}

function fetchData() {
    $('#err').empty();

    $('#err').append('<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>');

    $('#err').append('正在加载数据');

    fetch(jsonUrl)
        .then(response => response.text())
        .then(data => {
            $('#in').val(data);
            $('#err').text("🎉抓取成功");
        })
        .catch(error => {
            console.error("加载 JSON 数据时出错：", error);
            $('#err').text("⚠️抓取数据失败！可能是网络问题，建议更换镜像后重试。" + error.message);
        });
    console.log("正在获取数据：" + jsonUrl)
}

function processDataFromin() {
    $('#err').empty();

    try {
        const inputValue = JSON.parse($('#in').val());
        const processedData = processData(inputValue);
        if (processedData) {
            $('#out').val(processedData);
            $('#err').text("🎉处理成功");
        }
    } catch (error) {
        console.error("输入数据解析时出错：", error);
        $('#err').text("⚠️输入数据解析失败：" + error.message);
    }
}

function copyResult() {
    const copyText = $('#out')[0];
    copyText.select();
    copyText.setSelectionRange(0, 99999); // For mobile devices
    navigator.clipboard.writeText(copyText.value).then(function () {
        $('#err').text("执行结果已复制到剪贴板");
    });
}

function openBrowser() {
    const browserPath = $('#browserPath').val();
    const params = $('#out').val().trim(); // 获取执行结果作为参数

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
            $('#err').text("⚠️浏览器已停止：" + error.message);
            // 向后端发送 /stop-browser 请求
            fetch('/stop-browser', {
                method: 'GET'
            })
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
            const select = $('#configFiles')[0];
            files.forEach(file => {
                const option = $('<option></option>')[0];
                option.value = file;
                option.textContent = file;
                select.appendChild(option);
            });
        })
        .catch(error => {
            alert(error.message);
            $('#err').text("⚠️处理时出错：" + error.message);
        });
}

function clearConfigFiles() {
    const select = document.getElementById('configFiles');
    while (select.firstChild) {
        select.removeChild(select.firstChild);
    }
}

function readConfig(fileName) {
    const configFile = $('#configFiles').val();
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
            $('#in').val(data);
            $('#err').text("🎉读取成功");
        })
        .catch(error => {
            alert(error.message);
            $('#err').text("⚠️读取失败: " + error.message);
        });
}

function saveConfig() {
    const content = $('#in').val();
    let configFileName = $('#configFileName').val();
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
            $('#err').text("🎉保存成功");
        })
        .catch(error => {
            alert(error.message);
            $('#err').text("⚠️保存失败: " + error.message);
        });
}

function delConfig() {
    const userConfirmed = confirm("确定要删除配置吗？");
    if (userConfirmed) {
        // 执行删除操作
        const select = $('#configFiles')[0];
        const selectedOption = select.options[select.selectedIndex];
        if (selectedOption) {
            const fileName = $('#configFiles').val();
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
                    $('#err').text("⚠️删除时出错：" + error.message);
                });
        } else {
            alert("请选择要删除的配置");
            $('#err').text("请选择要删除的配置");
        }
    }
}

function showUserAgreement() {
    const modal = $('#userAgreementModal')[0];
    const agreeButton = $('#agreeButton')[0];
    const disagreeButton = $('#disagreeButton')[0];
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

    disagreeButton.addEventListener('click', function () {
        window.location.href = 'about:blank';
        window.close();
    });
}

function showUserLisence() {
    const lisence = $('#lisence')[0];
    lisence.style.display = 'block';
}

function writeToUserAgreement(text) {
    $('#userAgreement').text(text);
    $('#lisence-text').html(text.replace(/\n/g, '<br>'));
}

function updateBrowserPath() {
    const browserSelect = $('#browserSelect')[0];
    const browserPath = $('#browserPath')[0];
    if (browserSelect.value === "custom") {
        browserPath.value = "";
        browserPath.readOnly = false;
    } else {
        browserPath.value = browserSelect.value;
        browserPath.readOnly = true;
    }
}

function updateInputPath() {
    const browserSelect = $('#browserSelect')[0];
    const browserPath = $('#browserPath')[0];
    if (browserSelect.options.length > 0) {
        browserPath.value = browserSelect.options[0].value;
        browserPath.readOnly = true;
    }
}

function updateProcessOptions() {
    const sharpProcessChecked = $('#sharpProcess').is(':checked');
    const dollorProcessChecked = $('#dollorProcess').is(':checked');

    const processOptions = {
        sharpProcess: sharpProcessChecked,
        dollorProcess: dollorProcessChecked
    };

    console.log("Process options updated:", processOptions);
    // 更新处理后的数据
    processDataFromin();
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

        // 从 json 获取配置
        const isDark = data.isDark;
        if (isDark) {
            toggleNightMode();
        }
        console.log("isDark: " + isDark);

        const showLisence = data.showLisence;
        if (showLisence) {
            showUserLisence();
        }
        const showAgreement = data.showAgreement;
        if (showAgreement) {
            showUserAgreement();
        }

        $('#sharpProcess').change(updateProcessOptions);
        $('#dollorProcess').change(updateProcessOptions);
        
        const sharpProcess = data.process.sharpProcess;
        const dollorProcess = data.process.dollorProcess;
        $('#sharpProcess').prop('checked', sharpProcess);
        $('#dollorProcess').prop('checked', dollorProcess);
        
        // 确保在设置 checked 属性之后调用 updateProcessOptions
        updateProcessOptions();

        // 传入信息
        const agreementText = data.agreementText;
        writeToUserAgreement(agreementText);

        const version = data.version;
        if (version) {
            $('#version').text(version).show();
            console.log("Version: " + version);
        } else {
            $('#ver-span').hide();
        }

        const tips = data.tips;
        if (tips) {
            $('#tips').text(tips).show();
        } else {
            $('#tip-span').hide();
        }

        const author = data.author;
        if (author) {
            $('#author').text(author).show();
        } else {
            $('#aut-span').hide();
        }

        // 动态生成浏览器选项
        const browserSelect = $('#browserSelect')[0];
        data.browsers.forEach(browser => {
            const option = document.createElement('option');
            option.value = browser.path;
            option.textContent = browser.name;
            if (browser.description) {
                option.title = browser.description;
            }
            browserSelect.appendChild(option);
        });

        // 动态生成镜像选项
        const mirrorSelect = $('#mirrorSelect')[0];
        data.mirrors.forEach(mirror => {
            const option = document.createElement('option');
            option.value = mirror.url;
            option.textContent = mirror.name;
            option.dataset.index = mirror.index; // 添加index到option的data属性
            mirrorSelect.appendChild(option);
        });

        // 设置默认选择的镜像
        const defaultMirrorIndex = data.mirrors.findIndex(mirror => mirror.index === data.defaultMirror);
        if (defaultMirrorIndex !== -1) {
            mirrorSelect.selectedIndex = defaultMirrorIndex;
        }

        // 监听镜像选择变化
        mirrorSelect.addEventListener('change', function () {
            const selectedOption = mirrorSelect.options[mirrorSelect.selectedIndex];
            if (selectedOption.dataset.index == 99) {
                const customUrl = prompt("请输入自定义镜像的 URL (格式: https://example.com/):");
                if (customUrl) {
                    selectedOption.value = customUrl;
                    selectedOption.textContent = `自定义 (${customUrl})`;
                    updateMirrorPath();
                } else {
                    alert("自定义镜像 URL 不能为空！");
                }
            } else {
                updateMirrorPath();
            }
        });

        // 初始化
        fetchConfigFiles();
        updateInputPath();
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

// 需要在页面加载完成后执行的代码
getDefault();
