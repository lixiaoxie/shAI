# shAI

[![npm version](https://img.shields.io/npm/v/shai-cli.svg)](https://www.npmjs.com/package/shai-cli)
[![CI](https://github.com/lixiaoxie/shAI/actions/workflows/ci.yml/badge.svg)](https://github.com/lixiaoxie/shAI/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**AI-powered shell command assistant** — describe what you want in natural language, get the right command.

[中文](#中文说明) | [English](#english)

---

## English

### Install

```bash
# From npm (recommended)
npm install -g shai-cli

# From GitHub Packages
npm install -g @lixiaoxie/shai-cli --registry=https://npm.pkg.github.com

# From source
git clone https://github.com/lixiaoxie/shAI.git
cd shAI && npm link
```

### Quick Start

```bash
# First run will guide you through API configuration
shai find all files larger than 100M
```

### Features

- **Natural language → shell commands** — just describe what you want
- **Streaming output** — real-time display of AI thinking process (supports reasoning models)
- **Chat mode** — `shai chat` for general Q&A without command generation
- **Pipe support** — `some_cmd 2>&1 | shai chat what does this error mean`
- **Command validation** — checks if generated commands exist on your system
- **Install suggestions** — recommends brew/apt/pip/npm for missing tools
- **Custom commands** — register your own scripts/tools for AI to use
- **Memory system** — auto-saves complex commands, learns your preferences
- **Terminal context** — reads tmux pane / shell history for context-aware responses
- **i18n** — supports English and Chinese (`--set-lang en|zh`)
- **Zero dependencies** — pure Node.js, no npm packages required

### Usage

```bash
# Command mode (default) — generates shell commands
shai find files larger than 100M and sort by size
shai which process is using port 8080
shai count commits per author in git repo
shai generate a random 16-char password

# Chat mode — general Q&A
shai chat what is the difference between git rebase and merge
some_cmd 2>&1 | shai chat what does this error mean

# Configuration
shai config                     # Interactive setup
shai --set-url <url>            # Set API URL
shai --set-key <key>            # Set API Key
shai --set-model <model>        # Set model
shai --set-lang en              # Set language
shai --config                   # Show current config

# Custom commands
shai cmd add deploy "Deploy script: ./scripts/deploy.sh prod"
shai cmd list
shai cmd rm deploy

# Memory
shai mem list                   # List saved commands
shai mem list docker            # Search memories
shai mem save "restart nginx" "sudo systemctl restart nginx"
shai mem rm 1
shai mem clear
```

### How It Works

```
User input → AI generates command (streaming) → Validate commands → [Enter] Run / [s] Save & Run / [e] Edit / [n] Cancel
```

### Configuration

Config file: `~/.shai/config.json`

```json
{
  "api_url": "https://api.openai.com/v1/chat/completions",
  "api_key": "sk-...",
  "model": "gpt-4o-mini",
  "lang": "en"
}
```

Compatible with any OpenAI-compatible API (Ollama, DeepSeek, Qwen, etc.).

### Requirements

- Node.js ≥ 18
- Zero npm dependencies

---

## 中文说明

### 安装

```bash
# 从 npm 安装（推荐）
npm install -g shai-cli

# 从 GitHub Packages 安装
npm install -g @lixiaoxie/shai-cli --registry=https://npm.pkg.github.com

# 从源码安装
git clone https://github.com/lixiaoxie/shAI.git
cd shAI && npm link
```

### 快速开始

```bash
# 首次运行会引导配置 API
shai 查找当前目录下所有大于100M的文件
```

### 功能特性

- **自然语言 → Shell 命令** — 描述你想做的事，自动生成命令
- **流式输出** — 实时显示 AI 思考过程（支持 DeepSeek 等推理模型）
- **问答模式** — `shai chat` 通用问答，不生成命令
- **管道支持** — `some_cmd 2>&1 | shai chat 这个报错什么意思`
- **命令验证** — 自动检查生成的命令是否存在
- **安装建议** — 缺失工具自动推荐 brew/apt/pip/npm 安装方式
- **自定义命令** — 注册自定义脚本，AI 会自动学习用法
- **记忆系统** — 自动保存复杂命令，学习你的使用偏好
- **终端上下文** — 读取 tmux / shell history 提供上下文感知
- **中英双语** — `--set-lang zh|en` 切换语言
- **零依赖** — 纯 Node.js 实现

### 使用示例

```bash
# 命令模式（默认）
shai 查看哪个进程在用8080端口
shai 统计git仓库中每个作者的提交数
shai 批量把当前目录jpg转为webp格式
shai 生成一个随机的16位密码

# 问答模式
shai chat git rebase 和 merge 有什么区别
some_cmd 2>&1 | shai chat 这个报错什么意思
```

---

## Project Structure

```
shAI/
├── bin/shai.js        # CLI entry point
├── src/
│   ├── ai.js          # OpenAI-compatible API (streaming)
│   ├── commands.js    # Command scanning, validation, install suggestions
│   ├── config.js      # Config read/write & interactive setup
│   ├── context.js     # Terminal context collection
│   ├── i18n.js        # Internationalization (zh/en)
│   ├── memory.js      # Command memory system
│   └── ui.js          # Terminal UI (streaming render, colors, prompts)
├── package.json
├── LICENSE            # MIT
└── README.md
```

## License

[MIT](LICENSE)
