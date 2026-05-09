const messages = {
  zh: {
    // Help
    helpTitle: 'shAI — AI 命令行助手',
    helpUsage: '用法：',
    helpDesc: '生成并执行 shell 命令',
    helpChatDesc: '通用问答模式（不生成命令）',
    helpConfigDesc: '交互式重新配置 API 设置',
    helpConfigShowDesc: '显示当前配置（密钥/URL 已脱敏）',
    helpCmdAddDesc: '添加自定义命令/脚本到 AI 上下文',
    helpCmdRmDesc: '移除自定义命令',
    helpCmdListDesc: '列出所有自定义命令',
    helpMemListDesc: '搜索/列出已保存的命令记忆',
    helpMemSaveDesc: '手动保存命令到记忆',
    helpMemRmDesc: '删除指定记忆',
    helpMemClearDesc: '清空所有记忆',
    helpPathAddDesc: '添加自定义 bin 目录',
    helpPathRmDesc: '移除自定义 bin 目录',
    helpPathListDesc: '列出自定义 bin 目录',
    helpOptions: '选项：',
    helpOptHelp: '显示帮助信息',
    helpOptVersion: '显示版本号',
    helpOptConfig: '显示当前配置',
    helpOptSetUrl: '设置 API URL',
    helpOptSetKey: '设置 API Key',
    helpOptSetModel: '设置模型名称',
    helpOptSetLang: '设置语言 (zh/en)',
    helpOptNoCtx: '不读取终端上下文',
    helpOptNoCheck: '跳过命令可用性检查',
    helpOptSave: '强制保存到记忆',
    helpExamples: '示例：',
    helpEx1: '查找大于100M的文件并按大小排序',
    helpEx2: '批量把当前目录jpg转为webp格式',
    helpEx3: '查看哪个进程在用8080端口',
    helpEx4: '统计git仓库中每个作者的提交数',
    helpEx5: '用ffmpeg把视频转为gif',
    helpEx6: '生成一个随机的16位密码',
    helpEx7: '这个报错什么意思',
    helpEx7Note: '结合终端上下文',
    helpEx8: '上条命令加上sudo重新执行',
    helpEx8Note: '结合终端历史',
    helpExPipe: '管道 + 问答',
    helpExChat: '通用问答',
    helpMemory: '记忆系统：',
    helpMem1: '复杂命令（含管道/多步/长命令）执行后自动保存',
    helpMem2: '生成命令后按 [s] 手动保存',
    helpMem3: '已保存的命令会作为 AI 参考，优先生成你习惯的写法',

    // Config
    configTitle: '🔧 shAI 初始化配置',
    configApiUrl: 'API URL',
    configApiKey: 'API Key',
    configModel: '模型',
    configLang: '语言',
    configNotSet: '未设置',
    configSaved: '✅ 配置已保存至',
    configNotFound: '未找到配置。运行 shai config 进行初始配置。',
    configFile: '配置文件',
    configUpdated: '已更新为',
    firstTimeConfig: '首次使用，请先配置 API：',

    // UI
    uiThinking: '⏳ 思考中...',
    uiConfirm: '[Enter] 执行  [s] 保存并执行  [e] 编辑  [n] 取消 > ',
    uiCancelled: '已取消。',
    uiSaved: '已保存到记忆',
    uiAutoSaved: '已自动保存到记忆',
    uiNoResult: 'AI 未返回任何内容',
    uiCmdNotFound: '命令 "{cmd}" 未在系统中找到',
    uiInstallSuggest: '建议安装：',
    uiCmdNotInPath: '命令 "{cmd}" 未在系统 PATH 中找到。',
    uiStillAdd: '仍将添加为自定义命令。',
    uiLearning: '📖 正在学习 {cmd} 的用法...',
    uiLearnedLines: '✅ 已获取 {cmd} 的帮助信息（{n} 行）',
    uiLearnFailed: '未能获取帮助信息，仅保存描述。',
    uiAdded: '✅ 已添加自定义命令:',
    uiRemoved: '✅ 已移除自定义命令:',
    uiNotFoundCmd: '未找到自定义命令:',
    uiCmdUsage: '用法：shai cmd add <名称> <说明>',
    uiCmdExample: '示例：shai cmd add deploy-prod "部署到生产环境的脚本，位于 ./scripts/deploy.sh"',
    uiUnknownSub: '未知子命令。可用：',
    uiCustomCmds: '自定义命令：',
    uiNoCustomCmds: '暂无自定义命令。使用 shai cmd add <名称> <说明> 添加。',
    uiHelpLearned: '📖 = 已学习用法',

    // Memory
    memSavedList: '已保存的记忆',
    memSearch: '搜索',
    memNoMatch: '未找到匹配"{kw}"的记忆。',
    memEmpty: '暂无保存的记忆。使用命令后按 [s] 保存。',
    memUsage: '使用 {n} 次',
    memSaveUsage: '用法：shai mem save <描述> <命令>',
    memSaveExample: '示例：shai mem save "重启nginx" "sudo systemctl restart nginx"',
    memSaveTip: '提示：也可以在命令生成后按 [s] 快捷保存。',
    memDeleted: '✅ 已删除记忆。',
    memNotFound: '未找到指定记忆。使用 shai mem list 查看编号。',
    memCleared: '✅ 已清空 {n} 条记忆。',
    memIsEmpty: '记忆为空。',

    // Path
    pathAddUsage: '用法：shai path add <目录路径>',
    pathRmUsage: '用法：shai path rm <目录路径>',
    pathEmpty: '暂无自定义 bin 路径。使用 shai path add <目录路径> 添加。',
    pathListTitle: '自定义 bin 路径：',

    // Chat
    chatUsage: '用法：shai chat <问题>',
    chatExample: '示例：shai chat git rebase 和 merge 有什么区别',
  },

  en: {
    helpTitle: 'shAI — AI Shell Assistant',
    helpUsage: 'Usage:',
    helpDesc: 'Generate and execute shell commands',
    helpChatDesc: 'General Q&A mode (no command generation)',
    helpConfigDesc: 'Interactive API configuration',
    helpConfigShowDesc: 'Show current configuration (masked)',
    helpCmdAddDesc: 'Add custom command/script to AI context',
    helpCmdRmDesc: 'Remove custom command',
    helpCmdListDesc: 'List all custom commands',
    helpMemListDesc: 'Search/list saved command memories',
    helpMemSaveDesc: 'Manually save a command to memory',
    helpMemRmDesc: 'Delete a specific memory',
    helpMemClearDesc: 'Clear all memories',
    helpPathAddDesc: 'Add custom bin directory',
    helpPathRmDesc: 'Remove custom bin directory',
    helpPathListDesc: 'List custom bin directories',
    helpOptions: 'Options:',
    helpOptHelp: 'Show help',
    helpOptVersion: 'Show version',
    helpOptConfig: 'Show current configuration',
    helpOptSetUrl: 'Set API URL',
    helpOptSetKey: 'Set API Key',
    helpOptSetModel: 'Set model name',
    helpOptSetLang: 'Set language (zh/en)',
    helpOptNoCtx: 'Skip terminal context',
    helpOptNoCheck: 'Skip command availability check',
    helpOptSave: 'Force save to memory',
    helpExamples: 'Examples:',
    helpEx1: 'find files larger than 100M and sort by size',
    helpEx2: 'batch convert jpg to webp in current directory',
    helpEx3: 'which process is using port 8080',
    helpEx4: 'count commits per author in git repo',
    helpEx5: 'convert video to gif with ffmpeg',
    helpEx6: 'generate a random 16-char password',
    helpEx7: 'what does this error mean',
    helpEx7Note: 'uses terminal context',
    helpEx8: 'rerun last command with sudo',
    helpEx8Note: 'uses shell history',
    helpExPipe: 'pipe + Q&A',
    helpExChat: 'general Q&A',
    helpMemory: 'Memory system:',
    helpMem1: 'Complex commands (pipes/multi-step/long) are auto-saved after execution',
    helpMem2: 'Press [s] to manually save after generation',
    helpMem3: 'Saved commands are used as AI reference for your preferred patterns',

    configTitle: '🔧 shAI Configuration',
    configApiUrl: 'API URL',
    configApiKey: 'API Key',
    configModel: 'Model',
    configLang: 'Language',
    configNotSet: 'not set',
    configSaved: '✅ Configuration saved to',
    configNotFound: 'No configuration found. Run shai config to set up.',
    configFile: 'Config file',
    configUpdated: 'updated to',
    firstTimeConfig: 'First time use, please configure API:',

    uiThinking: '⏳ Thinking...',
    uiConfirm: '[Enter] Run  [s] Save & Run  [e] Edit  [n] Cancel > ',
    uiCancelled: 'Cancelled.',
    uiSaved: 'Saved to memory',
    uiAutoSaved: 'Auto-saved to memory',
    uiNoResult: 'AI returned no content',
    uiCmdNotFound: 'Command "{cmd}" not found on system',
    uiInstallSuggest: 'Install suggestion:',
    uiCmdNotInPath: 'Command "{cmd}" not found in system PATH.',
    uiStillAdd: 'Will still add as custom command.',
    uiLearning: '📖 Learning usage of {cmd}...',
    uiLearnedLines: '✅ Got help info for {cmd} ({n} lines)',
    uiLearnFailed: 'Could not get help info, saving description only.',
    uiAdded: '✅ Added custom command:',
    uiRemoved: '✅ Removed custom command:',
    uiNotFoundCmd: 'Custom command not found:',
    uiCmdUsage: 'Usage: shai cmd add <name> <description>',
    uiCmdExample: 'Example: shai cmd add deploy-prod "Deploy to production via ./scripts/deploy.sh"',
    uiUnknownSub: 'Unknown subcommand. Available:',
    uiCustomCmds: 'Custom commands:',
    uiNoCustomCmds: 'No custom commands. Use shai cmd add <name> <description> to add.',
    uiHelpLearned: '📖 = usage learned',

    memSavedList: 'Saved memories',
    memSearch: 'search',
    memNoMatch: 'No memories matching "{kw}".',
    memEmpty: 'No saved memories. Press [s] after command generation to save.',
    memUsage: 'used {n} times',
    memSaveUsage: 'Usage: shai mem save <description> <command>',
    memSaveExample: 'Example: shai mem save "restart nginx" "sudo systemctl restart nginx"',
    memSaveTip: 'Tip: You can also press [s] after command generation to save.',
    memDeleted: '✅ Memory deleted.',
    memNotFound: 'Memory not found. Use shai mem list to see entries.',
    memCleared: '✅ Cleared {n} memories.',
    memIsEmpty: 'Memory is empty.',

    // Path
    pathAddUsage: 'Usage: shai path add <directory>',
    pathRmUsage: 'Usage: shai path rm <directory>',
    pathEmpty: 'No custom bin paths. Use shai path add <directory> to add one.',
    pathListTitle: 'Custom bin paths:',

    chatUsage: 'Usage: shai chat <question>',
    chatExample: 'Example: shai chat what is the difference between git rebase and merge',
  },
};

let currentLang = 'en';

export function setLanguage(lang) {
  currentLang = (lang && messages[lang]) ? lang : 'en';
}

export function getLanguage() {
  return currentLang;
}

/**
 * Get translated text. Supports template variable substitution: t('key', { cmd: 'jq', n: 5 })
 */
export function t(key, vars = {}) {
  let text = messages[currentLang]?.[key] || messages.en[key] || key;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return text;
}

export function getHelpText(version) {
  const L = currentLang;
  return `
${t('helpTitle')} v${version}

${t('helpUsage')}
  shai <${L === 'zh' ? '自然语言描述' : 'natural language'}>          ${t('helpDesc')}
  shai chat <${L === 'zh' ? '问题' : 'question'}>            ${t('helpChatDesc')}
  shai config                 ${t('helpConfigDesc')}
  shai config show            ${t('helpConfigShowDesc')}
  shai cmd add <${L === 'zh' ? '名称' : 'name'}> <${L === 'zh' ? '说明' : 'desc'}>  ${t('helpCmdAddDesc')}
  shai cmd rm <${L === 'zh' ? '名称' : 'name'}>          ${t('helpCmdRmDesc')}
  shai cmd list               ${t('helpCmdListDesc')}
  shai mem list [${L === 'zh' ? '关键词' : 'keyword'}]      ${t('helpMemListDesc')}
  shai mem save <${L === 'zh' ? '描述' : 'desc'}> <${L === 'zh' ? '命令' : 'cmd'}>   ${t('helpMemSaveDesc')}
  shai mem rm <${L === 'zh' ? '编号' : 'id'}>            ${t('helpMemRmDesc')}
  shai mem clear              ${t('helpMemClearDesc')}
  shai path add <${L === 'zh' ? '目录' : 'dir'}>        ${t('helpPathAddDesc')}
  shai path rm <${L === 'zh' ? '目录' : 'dir'}>         ${t('helpPathRmDesc')}
  shai path list              ${t('helpPathListDesc')}

${t('helpOptions')}
  -h, --help                  ${t('helpOptHelp')}
  -v, --version               ${t('helpOptVersion')}
  --config                    ${t('helpOptConfig')}
  --set-url <url>             ${t('helpOptSetUrl')}
  --set-key <key>             ${t('helpOptSetKey')}
  --set-model <model>         ${t('helpOptSetModel')}
  --set-lang <zh|en>          ${t('helpOptSetLang')}
  --no-context                ${t('helpOptNoCtx')}
  --no-check                  ${t('helpOptNoCheck')}
  --save                      ${t('helpOptSave')}

${t('helpExamples')}
  shai ${t('helpEx1')}
  shai ${t('helpEx2')}
  shai ${t('helpEx3')}
  shai ${t('helpEx4')}
  shai ${t('helpEx5')}
  shai ${t('helpEx6')}
  shai ${t('helpEx7')}                  ← ${t('helpEx7Note')}
  shai ${t('helpEx8')}          ← ${t('helpEx8Note')}
  some_cmd 2>&1 | shai chat ${L === 'zh' ? '这个报错什么意思' : 'what does this error mean'}  ← ${t('helpExPipe')}
  shai chat ${L === 'zh' ? 'git rebase 和 merge 有什么区别' : 'difference between git rebase and merge'}  ← ${t('helpExChat')}

${t('helpMemory')}
  • ${t('helpMem1')}
  • ${t('helpMem2')}
  • ${t('helpMem3')}
`;
}
