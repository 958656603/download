// 导入node-fetch （兼容Netlify Functions）
const fetch = require('node-fetch');

/**
 * 视频下载器 - Netlify Functions (JavaScript版本)
 * 负责解析各大视频平台的分享链接，提取无水印的原始视频下载地址
 * 支持抖音、快手、小红书、哔哩哔哩等主流视频平台
 */

// ===== 配置常量 =====
const CONFIG = {
    // 请求超时时间（毫秒）
    REQUEST_TIMEOUT: 30000,
    
    // 最大重试次数
    MAX_RETRIES: 3,
    
    // 用户代理字符串
    USER_AGENTS: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
    ],
    
    // 支持的视频平台配置
    SUPPORTED_PLATFORMS: {
        'douyin': ['douyin.com', 'dy.com', 'iesdouyin.com'],
        'kuaishou': ['kuaishou.com', 'ks.com'],
        'xiaohongshu': ['xiaohongshu.com', 'xhs.com'],
        'bilibili': ['bilibili.com', 'b23.tv'],
        'weishi': ['weishi.qq.com']
    }
};

// ===== 工具函数 =====

/**
 * 根据URL判断视频平台
 */
function getPlatformFromUrl(url) {
    const urlLower = url.toLowerCase();
    
    for (const [platform, domains] of Object.entries(CONFIG.SUPPORTED_PLATFORMS)) {
        for (const domain of domains) {
            if (urlLower.includes(domain)) {
                return platform;
            }
        }
    }
    
    return null;
}

/**
 * 发送HTTP请求
 */
async function makeRequest(url, options = {}) {
    const defaultHeaders = {
        'User-Agent': CONFIG.USER_AGENTS[0],
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        ...options.headers
    };
    
    for (let attempt = 0; attempt < CONFIG.MAX_RETRIES; attempt++) {
        try {
            // 创建手动超时控制（替代AbortSignal.timeout）
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
            
            const response = await fetch(url, {
                method: options.method || 'GET',
                headers: defaultHeaders,
                redirect: options.redirect || 'follow',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // 对于重定向状态码，不抛出错误
            if (!response.ok && !(response.status >= 300 && response.status < 400)) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response;
        } catch (error) {
            if (attempt === CONFIG.MAX_RETRIES - 1) {
                throw error;
            }
            // 等待一段时间后重试
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
    }
}

// ===== 视频解析器类 =====

/**
 * 抖音视频解析器
 */
class DouyinParser {
    constructor() {
        this.platformName = "抖音";
    }
    
    async parse(url) {
        console.log('🎬 抖音解析器开始处理URL:', url);
        
        try {
            // 获取真实链接（处理短链接重定向）
            console.log('📡 发送请求获取真实链接...');
            const response = await makeRequest(url, { redirect: 'manual' });
            console.log('📡 请求响应状态:', response.status);
            
            // 检查是否有重定向
            let realUrl = url;
            if (response.status >= 300 && response.status < 400) {
                realUrl = response.headers.get('Location') || url;
                console.log('🔄 发现重定向，真实URL:', realUrl);
            } else {
                console.log('✅ 无重定向，使用原始URL');
            }
            
            // 提取视频ID
            const videoId = this.extractVideoId(realUrl);
            if (!videoId) {
                // 如果从重定向URL无法提取，尝试从原始URL提取
                console.log('❌ 从原始URL无法提取视频ID，尝试原始URL');
                const originalVideoId = this.extractVideoId(url);
                if (!originalVideoId) {
                    throw new Error(`无法提取视频ID。原始URL: ${url}, 重定向URL: ${realUrl}`);
                }
                console.log('✅ 从原始URL提取到视频ID:', originalVideoId);
                return await this.createFallbackResult(originalVideoId);
            }
            
            console.log('✅ 成功提取视频ID:', videoId);
            
            // 尝试访问抖音页面获取数据
            try {
                console.log('📄 尝试获取页面内容...');
                const pageResponse = await makeRequest(realUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                        'Accept-Encoding': 'gzip, deflate',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1'
                    }
                });
                
                const htmlContent = await pageResponse.text();
                console.log('📄 页面内容长度:', htmlContent.length);
                
                // 从页面HTML中提取视频数据
                const videoData = this.extractVideoDataFromHtml(htmlContent, videoId);
                
                if (!videoData.downloadUrl) {
                    console.log('⚠️ 无法获取下载链接，返回备用结果');
                    return await this.createFallbackResult(videoId);
                }
                
                console.log('✅ 成功解析视频数据');
                return {
                    success: true,
                    title: videoData.title || '抖音视频',
                    download_url: videoData.downloadUrl,
                    platform: this.platformName,
                    video_id: videoId,
                    author: videoData.author || '',
                    duration: videoData.duration || 0,
                    size: '未知',
                    filename: `douyin_${videoId}.mp4`
                };
                
            } catch (pageError) {
                console.log('⚠️ 页面访问失败，返回备用结果:', pageError.message);
                return await this.createFallbackResult(videoId);
            }
            
        } catch (error) {
            throw new Error(`抖音视频解析失败: ${error.message}`);
        }
    }
    
    extractVideoDataFromHtml(html, videoId) {
        try {
            // 查找页面中的JSON数据
            const jsonRegex = /<script[^>]*>window\._SSR_HYDRATED_DATA\s*=\s*({.*?})<\/script>/s;
            const match = html.match(jsonRegex);
            
            if (!match || !match[1]) {
                // 尝试其他数据提取方式
                const altRegex = /window\.videoInfo\s*=\s*({.*?});/s;
                const altMatch = html.match(altRegex);
                
                if (!altMatch || !altMatch[1]) {
                    throw new Error("无法从页面中找到视频数据");
                }
                
                const data = JSON.parse(altMatch[1]);
                return this.parseVideoInfo(data);
            }
            
            const ssrData = JSON.parse(match[1]);
            
            // 从SSR数据中提取视频信息
            if (ssrData.app && ssrData.app.videoDetail) {
                const videoDetail = ssrData.app.videoDetail;
                return this.parseVideoInfo(videoDetail);
            }
            
            throw new Error("页面数据格式不符合预期");
            
        } catch (error) {
            console.error('解析HTML失败:', error.message);
            
            // 备用方案：尝试构造直接下载链接
            console.log('使用备用方案构造下载链接');
            return {
                title: '抖音视频',
                downloadUrl: null, // 无法获取真实下载链接时返回null
                author: '',
                duration: 0
            };
        }
    }
    
    parseVideoInfo(data) {
        let downloadUrl = null;
        let title = '抖音视频';
        let author = '';
        let duration = 0;
        
        // 尝试提取下载链接
        if (data.video && data.video.playAddr) {
            downloadUrl = data.video.playAddr[0] || data.video.playAddr;
        } else if (data.video && data.video.play_addr && data.video.play_addr.url_list) {
            downloadUrl = data.video.play_addr.url_list[0];
        }
        
        // 提取标题
        if (data.desc) {
            title = data.desc;
        }
        
        // 提取作者
        if (data.author && data.author.nickname) {
            author = data.author.nickname;
        }
        
        // 提取时长
        if (data.video && data.video.duration) {
            duration = Math.round(data.video.duration / 1000);
        }
        
        // 如果没有找到下载链接，使用页面链接
        if (!downloadUrl) {
            downloadUrl = data.video ? (data.video.playAddr || data.video.play_addr) : null;
        }
        
        return {
            downloadUrl,
            title,
            author,
            duration
        };
    }
    
    extractVideoId(url) {
        console.log('正在提取视频ID from URL:', url);
        
        const patterns = [
            // 抖音视频ID模式
            /\/video\/(\d+)/,
            /item_ids=(\d+)/,
            /\/(\d+)\/?$/,
            // 新增更多抖音URL模式
            /aweme\/detail\/(\d+)/,
            /share\/video\/(\d+)/,
            /v\.douyin\.com\/[A-Za-z0-9]+.*?video\/(\d+)/,
            // 短链接重定向后的模式
            /douyin\.com.*?\/(\d{19})/,  // 抖音视频ID通常是19位
            /douyin\.com.*?video_id=(\d+)/
        ];
        
        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            const match = url.match(pattern);
            console.log(`模式 ${i + 1} (${pattern}):`, match ? `匹配到 ${match[1]}` : '未匹配');
            if (match && match[1]) {
                console.log('✅ 成功提取视频ID:', match[1]);
                return match[1];
            }
        }
        
        console.log('❌ 未能提取到视频ID');
        return null;
    }
    
    /**
     * 创建备用解析结果（当无法获取详细信息时）
     * @param {string} videoId - 视频ID
     * @returns {Promise<Object>} 备用结果对象
     */
    async createFallbackResult(videoId) {
        console.log('📋 创建备用解析结果:', videoId);
        
        // 尝试获取真实视频下载链接
        const realDownloadUrl = await this.generateRealDownloadUrl(videoId);
        
        if (realDownloadUrl) {
            console.log('✅ 备用方案成功获取视频链接');
            return {
                success: true,
                title: `抖音视频_${videoId}`,
                download_url: realDownloadUrl,
                platform: this.platformName,
                video_id: videoId,
                author: '未知作者',
                duration: 0,
                size: '未知',
                filename: `douyin_${videoId}.mp4`,
                note: '已获取无水印视频链接'
            };
        } else {
            console.log('❌ 备用方案也无法获取视频链接');
            return {
                success: false,
                message: '抱歉，暂时无法解析此抖音视频。可能原因：1. 视频为私密或已删除 2. 网络问题 3. 抖音接口限制。请稍后重试或使用其他视频。',
                platform: this.platformName,
                video_id: videoId
            };
        }
    }
    
    /**
     * 异步获取真实视频下载链接
     * @param {string} videoId - 视频ID
     * @returns {Promise<string>} 可下载的视频链接
     */
    async generateRealDownloadUrl(videoId) {
        console.log('🎯 开始获取真实视频下载链接:', videoId);
        
        // 方案1: 通过官方API获取真实视频链接
        try {
            const apiUrl = `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${videoId}&dytk=`;
            console.log('📡 调用抖音API:', apiUrl);
            
            const response = await makeRequest(apiUrl, {
                headers: {
                    'Referer': 'https://www.douyin.com/',
                    'User-Agent': CONFIG.USER_AGENTS[0],
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            const data = await response.json();
            console.log('📦 API响应状态:', response.status);
            
            if (data.item_list && data.item_list[0]) {
                const item = data.item_list[0];
                console.log('🎬 视频项结构:', Object.keys(item.video || {}));
                
                // 多种方式尝试获取真实的MP4视频链接
                let realVideoUrl = null;
                
                // 尝试从不同的数据结构中获取视频链接
                if (item.video?.play_addr?.url_list && item.video.play_addr.url_list.length > 0) {
                    // 获取最高质量的视频链接
                    const urlList = item.video.play_addr.url_list;
                    realVideoUrl = urlList[urlList.length - 1]; // 通常最后一个是最高质量
                    console.log('✅ 从play_addr获取视频链接');
                } else if (item.video?.download_addr?.url_list && item.video.download_addr.url_list.length > 0) {
                    const urlList = item.video.download_addr.url_list;
                    realVideoUrl = urlList[urlList.length - 1];
                    console.log('✅ 从download_addr获取视频链接');
                }
                
                if (realVideoUrl) {
                    // 确保获取到的是真实的MP4链接而不是API接口
                    if (realVideoUrl.includes('.mp4') || realVideoUrl.includes('video')) {
                        // 处理链接，去水印并优化
                        realVideoUrl = realVideoUrl
                            .replace('playwm', 'play')  // 去水印
                            .replace(/watermark=1/, 'watermark=0')  // 去水印参数
                            .replace(/&line=\d+/, '&line=0'); // 使用最佳线路
                        
                        console.log('🎯 获取到真实MP4链接:', realVideoUrl);
                        return realVideoUrl;
                    } else {
                        console.log('⚠️ 获取的链接不是MP4文件:', realVideoUrl);
                    }
                }
            }
            
            console.log('❌ API未返回有效的视频链接');
        } catch (error) {
            console.log('❌ API调用失败:', error.message);
        }
        
        // 方案2: 尝试通过移动端API获取
        try {
            console.log('🔄 尝试移动端API...');
            const mobileApiUrl = `https://aweme.snssdk.com/aweme/v1/aweme/detail/?aweme_id=${videoId}`;
            
            const mobileResponse = await makeRequest(mobileApiUrl, {
                headers: {
                    'User-Agent': 'com.ss.android.ugc.aweme/110101 (Linux; U; Android 5.1.1; zh_CN; MI 9; Build/NMF26X; Cronet/TTNetVersion:b4d74d15 2020-04-23 QuicVersion:0144c772 2020-03-24)',
                    'Accept-Encoding': 'gzip, deflate'
                }
            });
            
            const mobileData = await mobileResponse.json();
            
            if (mobileData.aweme_list && mobileData.aweme_list[0]) {
                const aweme = mobileData.aweme_list[0];
                if (aweme.video?.play_addr?.url_list) {
                    const videoUrl = aweme.video.play_addr.url_list[0]
                        .replace('playwm', 'play')
                        .replace(/watermark=1/, 'watermark=0');
                    
                    if (videoUrl.includes('.mp4') || videoUrl.includes('video')) {
                        console.log('✅ 移动端API获取成功:', videoUrl);
                        return videoUrl;
                    }
                }
            }
        } catch (error) {
            console.log('❌ 移动端API失败:', error.message);
        }
        
        // 方案3: 解析失败时返回明确的错误
        console.log('⚠️ 所有方案都无法获取真实的MP4视频链接');
        return null;
    }
    
    /**
     * 增强版解析方法 - 尝试多种解析策略
     * @param {string} url - 视频URL
     * @returns {Object} 解析结果
     */
    async parseWithMultipleStrategies(url) {
        console.log('🚀 启动多策略解析:', url);
        
        const strategies = [
            () => this.parse(url), // 原有解析方法
            () => this.parseByAwemeAPI(url), // 新增API方法
            () => this.parseByWebScraping(url) // 网页抓取方法
        ];
        
        for (let i = 0; i < strategies.length; i++) {
            try {
                console.log(`📝 尝试策略 ${i + 1}/${strategies.length}`);
                const result = await strategies[i]();
                
                if (result.success && result.download_url && 
                    !result.download_url.includes('douyin.com/video/')) {
                    console.log(`✅ 策略 ${i + 1} 成功，获得有效下载链接`);
                    return result;
                }
            } catch (error) {
                console.log(`❌ 策略 ${i + 1} 失败:`, error.message);
            }
        }
        
        // 所有策略都失败，返回基础结果
        console.log('⚠️ 所有解析策略都失败，使用备用方案');
        const videoId = this.extractVideoId(url);
        return this.createFallbackResult(videoId || '未知');
    }
    
    /**
     * 通过官方API解析视频信息
     * @param {string} url - 视频URL
     * @returns {Object} 解析结果
     */
    async parseByAwemeAPI(url) {
        const videoId = this.extractVideoId(url);
        if (!videoId) {
            throw new Error('无法从URL中提取视频ID');
        }
        
        const apiUrl = `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${videoId}&dytk=`;
        console.log('📡 调用抖音官方API:', apiUrl);
        
        try {
            const response = await makeRequest(apiUrl, {
                headers: {
                    'Referer': 'https://www.douyin.com/',
                    'User-Agent': CONFIG.USER_AGENTS[1],
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            const data = await response.json();
            console.log('📦 API响应数据结构:', Object.keys(data));
            
            if (data.item_list && data.item_list.length > 0) {
                const item = data.item_list[0];
                console.log('🎬 视频项数据:', Object.keys(item));
                
                // 多种方式尝试获取视频链接
                let videoUrl = null;
                let title = item.desc || `抖音视频_${videoId}`;
                let author = item.author?.nickname || '未知作者';
                
                // 方案1: play_addr
                if (item.video?.play_addr?.url_list && item.video.play_addr.url_list.length > 0) {
                    videoUrl = item.video.play_addr.url_list[0];
                    console.log('✅ 从play_addr获取视频链接');
                }
                // 方案2: download_addr 
                else if (item.video?.download_addr?.url_list && item.video.download_addr.url_list.length > 0) {
                    videoUrl = item.video.download_addr.url_list[0];
                    console.log('✅ 从download_addr获取视频链接');
                }
                // 方案3: bit_rate数组中的链接
                else if (item.video?.bit_rate && item.video.bit_rate.length > 0) {
                    const bitRate = item.video.bit_rate.find(br => br.play_addr?.url_list?.length > 0);
                    if (bitRate) {
                        videoUrl = bitRate.play_addr.url_list[0];
                        console.log('✅ 从bit_rate获取视频链接');
                    }
                }
                
                if (videoUrl) {
                    // 处理链接，去除水印标记并确保使用高清版本
                    videoUrl = videoUrl
                        .replace('playwm', 'play')  // 去水印
                        .replace(/watermark=1/, 'watermark=0')  // 去水印参数
                        .replace(/&ratio=\d+p/, '&ratio=720p'); // 确保高清
                    
                    console.log('🎯 最终视频下载链接:', videoUrl);
                    
                    return {
                        success: true,
                        title: title,
                        download_url: videoUrl,
                        platform: this.platformName,
                        video_id: videoId,
                        author: author,
                        duration: Math.round((item.video?.duration || 0) / 1000),
                        size: '未知',
                        filename: `douyin_${videoId}.mp4`
                    };
                }
            }
            
            console.log('❌ API返回数据中未找到视频链接');
            throw new Error('API返回数据格式异常或无视频链接');
            
        } catch (error) {
            console.error('🚨 API解析详细错误:', error);
            throw new Error(`API解析失败: ${error.message}`);
        }
    }
    
    /**
     * 通过网页抓取解析视频信息 
     * @param {string} url - 视频URL
     * @returns {Object} 解析结果
     */
    async parseByWebScraping(url) {
        try {
            const response = await makeRequest(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
                }
            });
            
            const html = await response.text();
            
            // 查找移动端视频链接
            const mobileVideoRegex = /"video_url":"([^"]+)"/;
            const match = html.match(mobileVideoRegex);
            
            if (match && match[1]) {
                const videoUrl = match[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
                const videoId = this.extractVideoId(url);
                
                return {
                    success: true,
                    title: `抖音视频_${videoId}`,
                    download_url: videoUrl,
                    platform: this.platformName,
                    video_id: videoId,
                    author: '未知作者',
                    duration: 0,
                    size: '未知',
                    filename: `douyin_${videoId}.mp4`
                };
            }
            
            throw new Error('未在页面中找到视频链接');
            
        } catch (error) {
            throw new Error(`网页抓取失败: ${error.message}`);
        }
    }
}

/**
 * 通用解析器（用于其他平台的基础解析）
 */
class GenericParser {
    constructor(platform) {
        this.platformName = platform;
    }
    
    async parse(url) {
        // 返回一个基础响应，表示暂未实现该平台的详细解析
        return {
            success: false,
            message: `${this.platformName}平台解析功能正在开发中，敬请期待`
        };
    }
}

/**
 * 获取解析器
 */
function getParser(platform) {
    switch (platform) {
        case 'douyin':
            return new DouyinParser();
        case 'kuaishou':
            return new GenericParser('快手');
        case 'xiaohongshu':
            return new GenericParser('小红书');
        case 'bilibili':
            return new GenericParser('哔哩哔哩');
        case 'weishi':
            return new GenericParser('微视');
        default:
            return null;
    }
}

// ===== Netlify Functions 入口点 =====

/**
 * Netlify Functions 处理器
 */
exports.handler = async (event, context) => {
    // 设置CORS头
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    try {
        // 处理预检请求
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ message: 'CORS preflight' })
            };
        }
        
        // 只接受POST请求
        if (event.httpMethod !== 'POST') {
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: '只支持POST请求'
                })
            };
        }
        
        // 解析请求体
        let requestData;
        try {
            console.log('收到请求 - Method:', event.httpMethod);
            console.log('收到请求 - Body类型:', typeof event.body);
            console.log('收到请求 - Body内容:', event.body);
            
            requestData = typeof event.body === 'string' 
                ? JSON.parse(event.body) 
                : event.body || {};
                
            console.log('解析后的请求数据:', JSON.stringify(requestData, null, 2));
        } catch (error) {
            console.error('JSON解析错误:', error.message);
            console.error('原始Body:', event.body);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: '请求数据格式错误: ' + error.message
                })
            };
        }
        
        // 获取视频URL
        const videoUrl = (requestData.url || '').trim();
        console.log('提取的视频URL:', videoUrl);
        
        if (!videoUrl) {
            console.error('视频URL为空');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: '请提供视频链接'
                })
            };
        }
        
        // 判断平台
        const platform = getPlatformFromUrl(videoUrl);
        console.log('检测到的平台:', platform);
        
        if (!platform) {
            console.error('不支持的平台URL:', videoUrl);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: `不支持此平台，目前支持抖音、快手、小红书等平台。输入的URL: ${videoUrl}`
                })
            };
        }
        
        // 获取解析器
        const parser = getParser(platform);
        console.log('获取解析器:', platform, parser ? '成功' : '失败');
        
        if (!parser) {
            console.error('解析器未找到:', platform);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: `${platform}解析器暂未实现`
                })
            };
        }
        
        // 执行解析
        try {
            console.log('开始解析视频:', {
                platform: platform,
                url: videoUrl
            });
            
            // 如果是抖音平台，使用增强版多策略解析
            let result;
            if (platform === 'douyin' && parser.parseWithMultipleStrategies) {
                console.log('🚀 使用抖音增强版多策略解析');
                result = await parser.parseWithMultipleStrategies(videoUrl);
            } else {
                console.log('📝 使用标准解析方法');
                result = await parser.parse(videoUrl);
            }
            
            console.log('解析结果:', JSON.stringify(result, null, 2));
            
            // 确保返回结果包含必要字段
            if (!result.success && !result.message) {
                result.success = false;
                result.message = '解析失败，请稍后重试';
            }
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result)
            };
            
        } catch (parseError) {
            console.error('解析错误详情:', {
                message: parseError.message,
                stack: parseError.stack,
                url: videoUrl,
                platform: platform
            });
            
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: parseError.message || '解析过程中发生错误',
                    debug: {
                        platform: platform,
                        url: videoUrl,
                        error: parseError.message
                    }
                })
            };
        }
        
    } catch (error) {
        // 记录错误详情
        console.error('函数执行错误:', {
            message: error.message,
            stack: error.stack,
            url: videoUrl || 'unknown',
            method: event.httpMethod,
            body: event.body
        });
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: '服务器内部错误，请稍后重试',
                debug: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        };
    }
};
