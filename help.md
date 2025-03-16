# 核心代码说明

```js
// 初始化指定名称(NO)的规则字典为空数组
CealHostRulesDict[cealHostName] = [];

// 初始化两个字符串变量，用于存储生成的映射规则
let cealHostRulesFragments = '';        // 存储域名到SNI的映射规则(--host-rules参数)
let cealHostResolverRulesFragments = ''; // 存储SNI到IP的映射规则(--host-resolver-rules参数)
let nullSniNum = 0;                     // 用于自动为空SNI生成编号

// 第一轮处理：遍历输入的每条规则，提取并标准化域名、SNI和IP
inputValue.forEach(cealHostRule => {
    let cealHostDomainPairs = [];       // 存储处理后的域名对(包含/排除域名对)
    
    // 处理SNI名称：如果为空则自动生成一个名称
    const cealHostSni = cealHostRule[1] === null || !cealHostRule[1].trim() ?
        `${cealHostName}${CealHostRulesDict[cealHostName].length}` : cealHostRule[1].trim();
    
    // 处理IP地址：如果为空则使用默认值127.0.0.1
    const cealHostIp = cealHostRule[2] && cealHostRule[2].trim() ? cealHostRule[2].trim() : "127.0.0.1";

    // 处理每个域名规则
    cealHostRule[0].forEach(cealHostDomain => {
        const domainString = cealHostDomain.toString().trim();
        
        // 根据用户选择的复选框，过滤特殊前缀的域名规则
        // #开头：注释域名规则；$开头：特殊功能域名；^用于分隔包含/排除域名
        if ((!sharpProcessChecked && domainString.startsWith('#')) || 
            (!dollorProcessChecked && domainString.startsWith('$')) || 
            domainString.startsWith('^')) return;

        // 使用^分割域名，获取包含域名和排除域名(如果有)
        const cealHostDomainPair = domainString.split('^', 2);
        cealHostDomainPairs.push([cealHostDomainPair[0].trim(), cealHostDomainPair[1]?.trim() || '']);
    });

    // 将处理后的域名对、SNI和IP添加到规则字典
    CealHostRulesDict[cealHostName].push({ cealHostDomainPairs, cealHostSni, cealHostIp });
});

// 第二轮处理：根据规则字典构建最终的映射字符串
CealHostRulesDict[cealHostName].forEach(({ cealHostDomainPairs, cealHostSni, cealHostIp }) => {
    // 确保SNI名称非空，必要时生成一个新的唯一名称
    const cealHostSniWithoutNull = cealHostSni || `${cealHostName}${++nullSniNum}`;
    let isValidCealHostDomainExist = false;

    // 处理每个域名对，构建域名到SNI的映射规则
    cealHostDomainPairs.forEach(([cealHostIncludeDomain, cealHostExcludeDomain]) => {
        // 跳过$开头的特殊功能域名
        if (cealHostIncludeDomain.startsWith('$')) return;

        // 构建格式: MAP 域名 SNI名称
        cealHostRulesFragments += `MAP ${cealHostIncludeDomain.replace('#', '')} ${cealHostSniWithoutNull}`;
        
        // 如果存在排除域名，添加EXCLUDE规则
        if (cealHostExcludeDomain) {
            cealHostRulesFragments += `,EXCLUDE ${cealHostExcludeDomain}`;
        }
        cealHostRulesFragments += ',';
        isValidCealHostDomainExist = true;
    });

    // 如果存在有效域名映射，则构建SNI到IP的映射规则
    if (isValidCealHostDomainExist) {
        cealHostResolverRulesFragments += `MAP ${cealHostSniWithoutNull} ${cealHostIp},`;
    }
});
```
