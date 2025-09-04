/**
 * 视频下载器 - 前端交互逻辑
 * 负责处理用户输入、API调用、结果显示等所有前端交互功能
 * 使用现代JavaScript ES6+语法，支持异步处理和错误处理
 */

// ===== 应用配置常量 =====
const CONFIG = {
    // API端点配置
    API_ENDPOINT: '/.netlify/functions/parser',
    
    // UI动画时长
    ANIMATION_DURATION: 300,
    
    // Toast显示时长
    TOAST_DURATION: 3000,
    
    // 支持的视频平台列表
    SUPPORTED_PLATFORMS: [
        'douyin.com', 'dy.com', 'iesdouyin.com',
        'kuaishou.com', 'ks.com',
        'xiaohongshu.com', 'xhs.com',
        'bilibili.com', 'b23.tv',
        'weishi.qq.com'
    ]
};

// ===== DOM元素获取 =====
class DOMElements {
    constructor() {
        // 输入相关元素
        this.videoInput = document.getElementById('videoUrl');
        this.clearBtn = document.getElementById('clearBtn');
        this.parseBtn = document.getElementById('parseBtn');
        
        // 状态显示元素
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.resultSection = document.getElementById('resultSection');
        
        // 成功结果元素
        this.successResult = document.getElementById('successResult');
        this.videoTitle = document.getElementById('videoTitle');
        this.videoPlatform = document.getElementById('videoPlatform');
        this.videoSize = document.getElementById('videoSize');
        this.downloadLink = document.getElementById('downloadLink');
        this.copyLink = document.getElementById('copyLink');
        
        // 错误结果元素
        this.errorResult = document.getElementById('errorResult');
        this.errorMessage = document.getElementById('errorMessage');
        
        // Toast通知元素
        this.toast = document.getElementById('toast');
        this.toastIcon = this.toast.querySelector('.toast-icon');
        this.toastMessage = this.toast.querySelector('.toast-message');
    }
}

// ===== 应用主类 =====
class VideoDownloaderApp {
    constructor() {
        this.dom = new DOMElements();
        this.isProcessing = false;
        this.currentVideoData = null;
        
        this.init();
    }
    
    /**
     * 应用初始化
     * 绑定事件监听器，设置初始状态
     */
    init() {
        this.bindEvents();
        this.updateClearButtonVisibility();
        console.log('🚀 视频下载器应用已初始化');
    }
    
    /**
     * 绑定所有事件监听器
     */
    bindEvents() {
        // 输入框相关事件
        this.dom.videoInput.addEventListener('input', () => {
            this.updateClearButtonVisibility();
            this.clearResults();
        });
        
        this.dom.videoInput.addEventListener('paste', (e) => {
            // 延时处理粘贴内容，确保input值已更新
            setTimeout(() => {
                this.updateClearButtonVisibility();
                this.clearResults();
            }, 10);
        });
        
        this.dom.videoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.isProcessing) {
                this.handleParseVideo();
            }
        });
        
        // 按钮事件
        this.dom.clearBtn.addEventListener('click', () => {
            this.clearInput();
        });
        
        this.dom.parseBtn.addEventListener('click', () => {
            this.handleParseVideo();
        });
        
        this.dom.copyLink.addEventListener('click', () => {
            this.copyVideoLink();
        });
        
        // 防止表单默认提交
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
            }
        });
    }
    
    /**
     * 更新清空按钮的显示状态
     */
    updateClearButtonVisibility() {
        const hasInput = this.dom.videoInput.value.trim().length > 0;
        this.dom.clearBtn.style.opacity = hasInput ? '1' : '0';
        this.dom.clearBtn.style.pointerEvents = hasInput ? 'auto' : 'none';
    }
    
    /**
     * 清空输入框
     */
    clearInput() {
        this.dom.videoInput.value = '';
        this.dom.videoInput.focus();
        this.updateClearButtonVisibility();
        this.clearResults();
    }
    
    /**
     * 清空结果显示区域
     */
    clearResults() {
        this.dom.resultSection.classList.add('hidden');
        this.dom.successResult.classList.add('hidden');
        this.dom.errorResult.classList.add('hidden');
        this.currentVideoData = null;
    }
    
    /**
     * 从分享文本中智能提取视频链接
     * @param {string} shareText - 分享的完整文本内容
     * @returns {string} 提取出的URL，如果未找到则返回原文本
     */
    extractUrlFromShareText(shareText) {
        if (!shareText || typeof shareText !== 'string') {
            return shareText;
        }
        
        // 多种URL匹配模式，覆盖各大平台的链接格式
        const urlPatterns = [
            // 抖音链接模式
            /https?:\/\/v\.douyin\.com\/[A-Za-z0-9\-_]+/gi,
            /https?:\/\/www\.douyin\.com\/[^\s]+/gi,
            /https?:\/\/[^\s]*douyin\.com[^\s]*/gi,
            
            // 快手链接模式
            /https?:\/\/[^\s]*kuaishou\.com[^\s]*/gi,
            /https?:\/\/[^\s]*ks\.com[^\s]*/gi,
            
            // 小红书链接模式
            /https?:\/\/[^\s]*xiaohongshu\.com[^\s]*/gi,
            /https?:\/\/[^\s]*xhs\.com[^\s]*/gi,
            
            // 哔哩哔哩链接模式
            /https?:\/\/[^\s]*bilibili\.com[^\s]*/gi,
            /https?:\/\/[^\s]*b23\.tv[^\s]*/gi,
            
            // 微视链接模式
            /https?:\/\/[^\s]*weishi\.qq\.com[^\s]*/gi,
            
            // 通用HTTP/HTTPS链接模式（作为兜底）
            /https?:\/\/[^\s]+/gi
        ];
        
        // 逐个尝试匹配模式
        for (const pattern of urlPatterns) {
            const matches = shareText.match(pattern);
            if (matches && matches.length > 0) {
                // 返回第一个匹配的URL
                let extractedUrl = matches[0];
                
                // 清理URL末尾可能的标点符号
                extractedUrl = extractedUrl.replace(/[，。！？；：、""''（）【】]$/, '');
                
                console.log(`🔗 从分享文本中提取到URL: ${extractedUrl}`);
                return extractedUrl;
            }
        }
        
        console.log('⚠️ 未找到有效URL，返回原始文本');
        return shareText;
    }

    /**
     * 验证输入的URL格式
     * @param {string} input - 用户输入的内容（可能是URL或包含URL的分享文本）
     * @returns {Object} 包含isValid、message和extractedUrl的验证结果
     */
    validateUrl(input) {
        if (!input || input.trim().length === 0) {
            return {
                isValid: false,
                message: '请输入视频链接或分享内容'
            };
        }
        
        // 先尝试从输入中提取URL
        const extractedUrl = this.extractUrlFromShareText(input.trim());
        
        // 基础URL格式验证
        const urlPattern = /^https?:\/\/.+/i;
        if (!urlPattern.test(extractedUrl)) {
            return {
                isValid: false,
                message: '未找到有效的视频链接，请确保复制了完整的分享内容',
                extractedUrl: extractedUrl
            };
        }
        
        // 检查是否为支持的平台
        const isSupportedPlatform = CONFIG.SUPPORTED_PLATFORMS.some(platform => 
            extractedUrl.toLowerCase().includes(platform)
        );
        
        if (!isSupportedPlatform) {
            return {
                isValid: false,
                message: '暂不支持此平台，支持抖音、快手、小红书、哔哩哔哩等主流平台',
                extractedUrl: extractedUrl
            };
        }
        
        return {
            isValid: true,
            message: 'URL格式正确',
            extractedUrl: extractedUrl
        };
    }
    
    /**
     * 处理视频解析请求
     */
    async handleParseVideo() {
        // 防止重复处理
        if (this.isProcessing) {
            return;
        }
        
        const inputText = this.dom.videoInput.value.trim();
        
        // 验证输入并提取URL
        const validation = this.validateUrl(inputText);
        if (!validation.isValid) {
            this.showToast('error', validation.message);
            return;
        }
        
        // 使用提取出的URL
        const extractedUrl = validation.extractedUrl;
        
        // 如果提取的URL与原输入不同，更新输入框显示
        if (extractedUrl !== inputText) {
            this.dom.videoInput.value = extractedUrl;
            this.showToast('info', '已自动提取视频链接');
            console.log(`📝 输入内容: ${inputText}`);
            console.log(`🔗 提取的URL: ${extractedUrl}`);
        }
        
        try {
            this.setProcessingState(true);
            
            // 调用后端API解析视频（使用提取出的URL）
            const result = await this.callParserAPI(extractedUrl);
            
            if (result.success) {
                this.displaySuccessResult(result);
                this.showToast('success', '视频解析成功！');
            } else {
                this.displayErrorResult(result.message || '解析失败，请稍后重试');
            }
            
        } catch (error) {
            console.error('视频解析出错:', error);
            this.displayErrorResult(this.getErrorMessage(error));
        } finally {
            this.setProcessingState(false);
        }
    }
    
    /**
     * 调用后端解析API
     * @param {string} url - 视频URL
     * @returns {Promise<Object>} API响应结果
     */
    async callParserAPI(url) {
        const response = await fetch(CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: url
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        return result;
    }
    
    /**
     * 设置处理状态（显示/隐藏加载指示器）
     * @param {boolean} isProcessing - 是否正在处理
     */
    setProcessingState(isProcessing) {
        this.isProcessing = isProcessing;
        
        if (isProcessing) {
            // 显示加载状态
            this.clearResults();
            this.dom.loadingIndicator.classList.remove('hidden');
            this.dom.parseBtn.disabled = true;
            this.dom.parseBtn.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                <span class="btn-text">解析中...</span>
            `;
        } else {
            // 隐藏加载状态
            this.dom.loadingIndicator.classList.add('hidden');
            this.dom.parseBtn.disabled = false;
            this.dom.parseBtn.innerHTML = `
                <i class="fas fa-magic"></i>
                <span class="btn-text">解析视频</span>
            `;
        }
    }
    
    /**
     * 显示成功结果
     * @param {Object} data - 解析成功的数据
     */
    displaySuccessResult(data) {
        this.currentVideoData = data;
        
        // 更新视频信息
        this.dom.videoTitle.textContent = data.title || '视频标题';
        this.dom.videoPlatform.textContent = data.platform || '未知平台';
        this.dom.videoSize.textContent = data.size || '未知大小';
        
        // 设置下载链接和处理下载逻辑
        this.setupDownloadButton(data);
        
        // 显示成功结果
        this.dom.successResult.classList.remove('hidden');
        this.dom.errorResult.classList.add('hidden');
        this.dom.resultSection.classList.remove('hidden');
        
        // 滚动到结果区域
        this.scrollToResult();
    }
    
    /**
     * 设置下载按钮的行为
     * @param {Object} data - 视频数据
     */
    setupDownloadButton(data) {
        const downloadUrl = data.download_url;
        
        // 移除之前的事件监听器
        const newDownloadBtn = this.dom.downloadLink.cloneNode(true);
        this.dom.downloadLink.parentNode.replaceChild(newDownloadBtn, this.dom.downloadLink);
        this.dom.downloadLink = newDownloadBtn;
        
        // 检查链接类型
        if (this.isDirectVideoUrl(downloadUrl)) {
            // 直接视频链接，使用标准下载
            this.dom.downloadLink.href = downloadUrl;
            this.dom.downloadLink.download = data.filename || 'video.mp4';
            console.log('🎬 设置直接下载链接:', downloadUrl);
        } else {
            // 非直接视频链接，使用代理下载
            this.dom.downloadLink.href = '#';
            this.dom.downloadLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleProxyDownload(downloadUrl, data.filename || 'video.mp4');
            });
            console.log('🔄 设置代理下载链接:', downloadUrl);
        }
    }
    
    /**
     * 判断是否为直接视频文件链接
     * @param {string} url - URL地址
     * @returns {boolean} 是否为直接视频链接
     */
    isDirectVideoUrl(url) {
        const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
        const apiPatterns = [
            /aweme\.snssdk\.com.*play/,
            /video-.*\.mp4/,
            /\.mp4\?/,
            /v\.douyin\.com.*\.mp4/
        ];
        
        const urlLower = url.toLowerCase();
        
        // 检查文件扩展名
        if (videoExtensions.some(ext => urlLower.includes(ext))) {
            return true;
        }
        
        // 检查API模式
        if (apiPatterns.some(pattern => pattern.test(url))) {
            return true;
        }
        
        // 排除明显的页面链接
        if (urlLower.includes('douyin.com/video/') || 
            urlLower.includes('douyin.com/share/')) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 处理代理下载（通过fetch获取并下载）
     * @param {string} url - 视频URL
     * @param {string} filename - 文件名
     */
    async handleProxyDownload(url, filename) {
        try {
            this.showToast('info', '正在准备下载...');
            
            // 尝试通过fetch获取视频数据
            const response = await fetch(url, {
                mode: 'no-cors' // 允许跨域请求
            });
            
            if (!response.ok) {
                throw new Error(`下载失败: ${response.status}`);
            }
            
            const blob = await response.blob();
            
            // 创建下载链接
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // 清理URL对象
            URL.revokeObjectURL(downloadUrl);
            
            this.showToast('success', '视频下载已开始！');
            
        } catch (error) {
            console.error('代理下载失败:', error);
            
            // 如果代理下载失败，提供备用方案
            this.showDownloadAlternatives(url, filename);
        }
    }
    
    /**
     * 显示下载备用方案
     * @param {string} url - 视频URL
     * @param {string} filename - 文件名
     */
    showDownloadAlternatives(url, filename) {
        const message = `
            直接下载失败，请尝试以下方案：
            1. 右键点击下方链接，选择"另存为"
            2. 或复制链接到下载工具（如IDM）中下载
        `;
        
        this.showToast('warning', '请尝试右键另存为下载');
        
        // 更新下载按钮为直接链接
        this.dom.downloadLink.href = url;
        this.dom.downloadLink.target = '_blank';
        this.dom.downloadLink.innerHTML = `
            <i class="fas fa-external-link-alt"></i>
            打开链接下载
        `;
    }
    
    /**
     * 显示错误结果
     * @param {string} message - 错误信息
     */
    displayErrorResult(message) {
        this.dom.errorMessage.textContent = message;
        
        // 显示错误结果
        this.dom.errorResult.classList.remove('hidden');
        this.dom.successResult.classList.add('hidden');
        this.dom.resultSection.classList.remove('hidden');
        
        // 显示错误Toast
        this.showToast('error', message);
        
        // 滚动到结果区域
        this.scrollToResult();
    }
    
    /**
     * 复制视频链接到剪贴板
     */
    async copyVideoLink() {
        if (!this.currentVideoData || !this.currentVideoData.download_url) {
            this.showToast('error', '没有可复制的链接');
            return;
        }
        
        try {
            await navigator.clipboard.writeText(this.currentVideoData.download_url);
            this.showToast('success', '链接已复制到剪贴板');
            
            // 临时改变按钮文本
            const originalText = this.dom.copyLink.innerHTML;
            this.dom.copyLink.innerHTML = '<i class="fas fa-check"></i> 已复制';
            
            setTimeout(() => {
                this.dom.copyLink.innerHTML = originalText;
            }, 2000);
            
        } catch (error) {
            console.error('复制失败:', error);
            this.showToast('error', '复制失败，请手动复制链接');
        }
    }
    
    /**
     * 显示Toast通知
     * @param {string} type - 通知类型 ('success' | 'error' | 'info' | 'warning')
     * @param {string} message - 通知消息
     */
    showToast(type, message) {
        // 设置图标
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        // 设置颜色
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        
        this.dom.toastIcon.className = icons[type] || icons.info;
        this.dom.toastMessage.textContent = message;
        this.dom.toast.style.backgroundColor = colors[type] || colors.info;
        
        // 显示Toast
        this.dom.toast.classList.remove('hidden');
        this.dom.toast.classList.add('show');
        
        // 自动隐藏
        setTimeout(() => {
            this.dom.toast.classList.remove('show');
            setTimeout(() => {
                this.dom.toast.classList.add('hidden');
            }, CONFIG.ANIMATION_DURATION);
        }, CONFIG.TOAST_DURATION);
    }
    
    /**
     * 滚动到结果区域
     */
    scrollToResult() {
        setTimeout(() => {
            this.dom.resultSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }, 100);
    }
    
    /**
     * 获取友好的错误信息
     * @param {Error} error - 错误对象
     * @returns {string} 友好的错误信息
     */
    getErrorMessage(error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return '网络连接失败，请检查网络设置后重试';
        }
        
        if (error.message.includes('HTTP错误')) {
            return '服务器响应异常，请稍后重试';
        }
        
        if (error.message.includes('JSON')) {
            return '数据解析失败，请稍后重试';
        }
        
        return error.message || '未知错误，请稍后重试';
    }
}

// ===== 工具函数 =====

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的文件大小
 */
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '未知大小';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * 检测视频平台
 * @param {string} url - 视频URL
 * @returns {string} 平台名称
 */
function detectPlatform(url) {
    const platforms = {
        'douyin.com': '抖音',
        'dy.com': '抖音',
        'iesdouyin.com': '抖音',
        'kuaishou.com': '快手',
        'ks.com': '快手',
        'xiaohongshu.com': '小红书',
        'xhs.com': '小红书',
        'bilibili.com': '哔哩哔哩',
        'b23.tv': '哔哩哔哩',
        'weishi.qq.com': '微视'
    };
    
    const urlLower = url.toLowerCase();
    for (const [domain, platform] of Object.entries(platforms)) {
        if (urlLower.includes(domain)) {
            return platform;
        }
    }
    
    return '未知平台';
}

// ===== 应用启动 =====

/**
 * DOM加载完成后初始化应用
 */
document.addEventListener('DOMContentLoaded', () => {
    try {
        // 创建应用实例
        window.videoDownloaderApp = new VideoDownloaderApp();
        
        // 添加全局错误处理
        window.addEventListener('error', (event) => {
            console.error('全局错误:', event.error);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            console.error('未处理的Promise拒绝:', event.reason);
        });
        
        console.log('✅ 应用启动成功');
        
    } catch (error) {
        console.error('❌ 应用启动失败:', error);
    }
});

// ===== 导出到全局作用域（用于调试） =====
if (typeof window !== 'undefined') {
    window.VideoDownloaderUtils = {
        formatFileSize,
        detectPlatform,
        CONFIG
    };
}
