# 🎥 视频下载器 - Netlify部署版

一款专门为Netlify平台设计的无水印视频下载工具，支持抖音、快手、小红书等主流视频平台。

## ✨ 项目特性

- 🚀 **无服务器架构** - 基于Netlify Serverless Functions
- 🎨 **现代化UI** - 响应式设计，支持深色模式
- 🔗 **多平台支持** - 抖音、快手、小红书、哔哩哔哩等
- 💧 **无水印下载** - 获取原始高质量视频文件
- 📱 **移动端友好** - 完美适配各种设备屏幕
- ⚡ **快速解析** - 智能识别和快速处理
- 🛡️ **安全可靠** - CORS配置和错误处理机制

## 📂 项目结构

```
video-downloader/
├── public/                 # 前端静态文件目录
│   ├── index.html         # 主页面文件
│   ├── style.css          # 样式文件
│   └── script.js          # 前端交互逻辑
├── netlify/               # Netlify配置目录
│   └── functions/         # Serverless Functions
│       └── parser.py      # 视频解析核心函数
├── netlify.toml           # Netlify部署配置
├── requirements.txt       # Python依赖包
└── README.md             # 项目说明文档
```

## 🚀 快速开始

### 方法一：一键部署到Netlify

1. 将项目代码上传到GitHub仓库
2. 登录 [Netlify](https://netlify.com)
3. 点击 "New site from Git"
4. 选择你的GitHub仓库
5. 部署设置会自动从 `netlify.toml` 读取
6. 点击"Deploy site"完成部署

### 方法二：使用Netlify CLI部署

```bash
# 安装Netlify CLI
npm install -g netlify-cli

# 登录Netlify账户
netlify login

# 在项目根目录下初始化
netlify init

# 部署到生产环境
netlify deploy --prod
```

### 方法三：拖拽部署

1. 将整个项目文件夹压缩为ZIP文件
2. 登录Netlify控制台
3. 直接拖拽ZIP文件到部署区域
4. 等待自动部署完成

## 💻 本地开发

### 环境要求

- Node.js (推荐v16+)
- Python 3.8+
- Netlify CLI

### 本地运行

```bash
# 安装Netlify CLI
npm install -g netlify-cli

# 克隆项目
git clone <your-repo-url>
cd video-downloader

# 安装Python依赖（用于本地测试Functions）
pip install -r requirements.txt

# 启动本地开发服务器
netlify dev

# 访问 http://localhost:8888
```

### 测试Serverless Function

```bash
# 测试单个函数
netlify functions:serve

# 或者直接运行Python文件进行测试
python netlify/functions/parser.py
```

## 🔧 配置说明

### Netlify配置 (`netlify.toml`)

- **发布目录**: `public/` - 包含所有静态前端文件
- **函数目录**: `netlify/functions/` - 包含Python Serverless Functions
- **重定向规则**: 将API请求路由到对应的函数
- **安全头**: 配置CORS和安全策略

### Python依赖 (`requirements.txt`)

主要依赖包：
- `requests==2.31.0` - HTTP请求库
- 其他内置库：`json`, `re`, `urllib`, `typing`

## 🎯 支持的平台

| 平台 | 域名 | 支持状态 |
|------|------|----------|
| 抖音 | douyin.com, dy.com | ✅ 已支持 |
| 快手 | kuaishou.com, ks.com | ✅ 已支持 |
| 小红书 | xiaohongshu.com, xhs.com | ✅ 已支持 |
| 哔哩哔哩 | bilibili.com, b23.tv | 🚧 开发中 |
| 微视 | weishi.qq.com | 🚧 开发中 |

## 📱 使用方法

1. **获取视频链接**
   - 在对应的视频APP中找到要下载的视频
   - 点击"分享"按钮，复制分享链接

2. **解析视频**
   - 将复制的链接粘贴到输入框中
   - 点击"解析视频"按钮

3. **下载视频**
   - 解析成功后会显示视频信息
   - 点击"下载视频"按钮保存到本地

## 🛠️ 技术架构

### 前端技术栈

- **HTML5** - 语义化标签和现代Web标准
- **CSS3** - 响应式布局、CSS Grid、Flexbox
- **JavaScript ES6+** - 模块化代码、异步处理
- **Font Awesome** - 图标库

### 后端技术栈

- **Python 3.8+** - 主要编程语言
- **Netlify Functions** - 无服务器计算平台
- **Requests库** - HTTP客户端
- **正则表达式** - 数据提取和解析

### 架构优势

- **无服务器** - 零运维，自动扩缩容
- **CDN加速** - 全球节点，访问速度快
- **安全可靠** - HTTPS默认开启，数据传输安全
- **成本低廉** - 按使用量计费，小流量几乎免费

## 🔍 API接口文档

### 解析视频接口

**端点**: `/.netlify/functions/parser`  
**方法**: `POST`  
**Content-Type**: `application/json`

#### 请求参数

```json
{
    "url": "https://www.douyin.com/video/7123456789"
}
```

#### 成功响应 (HTTP 200)

```json
{
    "success": true,
    "title": "视频标题",
    "download_url": "https://example.com/video.mp4",
    "platform": "抖音",
    "author": "作者名称",
    "duration": 30.5,
    "size": "未知",
    "filename": "douyin_7123456789.mp4"
}
```

#### 错误响应 (HTTP 400/500)

```json
{
    "success": false,
    "message": "错误描述信息"
}
```

## 🚨 注意事项

### 使用限制

- 仅供个人学习和研究使用
- 请尊重原创作者的版权
- 不得用于商业用途或大规模采集
- 遵守各平台的服务条款

### 技术限制

- Netlify Functions有执行时间限制（最大10秒）
- 某些私密或限制访问的视频无法解析
- 平台反爬策略可能导致解析失败
- 需要定期更新解析逻辑以适应平台变化

## 🐛 常见问题

### Q: 解析失败怎么办？
A: 请检查链接格式是否正确，确保是支持的平台链接，某些私密视频可能无法解析。

### Q: 下载速度很慢？
A: 下载速度取决于原视频服务器，建议在网络状况良好时下载。

### Q: 支持批量下载吗？
A: 目前仅支持单个视频解析，批量功能可能在后续版本中添加。

### Q: 可以下载高清视频吗？
A: 会尽量获取原始分辨率的视频，但受限于原平台的视频质量。

## 🔄 版本更新

### v1.0.0 (2024-01-01)
- ✨ 初始版本发布
- ✅ 支持抖音、快手、小红书
- 🎨 现代化UI设计
- 🚀 Netlify部署支持

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

### 开发流程

1. Fork本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

### 代码规范

- Python代码遵循PEP 8规范
- JavaScript使用ES6+语法
- 确保添加必要的注释和文档

## 📄 许可证

本项目基于MIT许可证开源，详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- [Netlify](https://netlify.com) - 提供优秀的部署平台
- [Font Awesome](https://fontawesome.com) - 提供图标支持
- 各大视频平台 - 内容来源

---

**免责声明**: 本工具仅供学习交流使用，请遵守相关法律法规和平台服务条款。开发者不承担因使用本工具产生的任何法律责任。
