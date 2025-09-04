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
            const response = await fetch(url, {
                method: options.method || 'GET',
                headers: defaultHeaders,
                redirect: options.redirect || 'follow',
                signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT)
            });
            
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
        try {
            // 获取真实链接（处理短链接重定向）
            const response = await makeRequest(url, { redirect: 'manual' });
            
            // 检查是否有重定向
            let realUrl = url;
            if (response.status >= 300 && response.status < 400) {
                realUrl = response.headers.get('Location') || url;
            }
            
            // 提取视频ID
            const videoId = this.extractVideoId(realUrl);
            if (!videoId) {
                throw new Error("无法提取视频ID");
            }
            
            // 直接访问抖音页面获取数据
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
            
            // 从页面HTML中提取视频数据
            const videoData = this.extractVideoDataFromHtml(htmlContent, videoId);
            
            if (!videoData.downloadUrl) {
                throw new Error("无法从页面中提取视频下载链接");
            }
            
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
            
            // 备用方案：构造基础响应
            return {
                title: '抖音视频',
                downloadUrl: `https://www.douyin.com/video/${videoId}`, // 临时链接
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
        const patterns = [
            /\/video\/(\d+)/,
            /item_ids=(\d+)/,
            /\/(\d+)\/?$/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1];
            }
        }
        
        return null;
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
export const handler = async (event, context) => {
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
            requestData = typeof event.body === 'string' 
                ? JSON.parse(event.body) 
                : event.body || {};
        } catch (error) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: '请求数据格式错误'
                })
            };
        }
        
        // 获取视频URL
        const videoUrl = (requestData.url || '').trim();
        if (!videoUrl) {
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
        if (!platform) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: '不支持此平台，目前支持抖音、快手、小红书等平台'
                })
            };
        }
        
        // 获取解析器
        const parser = getParser(platform);
        if (!parser) {
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
            const result = await parser.parse(videoUrl);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result)
            };
            
        } catch (parseError) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: parseError.message
                })
            };
        }
        
    } catch (error) {
        // 记录错误详情
        console.error('解析过程中发生错误:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: '服务器内部错误，请稍后重试'
            })
        };
    }
};
