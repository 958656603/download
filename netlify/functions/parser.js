const fetch = require('node-fetch');

/**
 * 抖音视频解析器 - 简化版 (只使用最新算法)
 * 基于腾讯云文章的最新解析方法
 */

// ===== 工具函数 =====

/**
 * 发送HTTP请求
 */
async function makeRequest(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// ===== 抖音解析器 =====

/**
 * 抖音视频解析器 - 仅使用最新算法
 */
class DouyinParser {
    constructor() {
        this.platformName = 'douyin';
    }
    
    /**
     * 从URL中提取视频ID
     */
    extractVideoId(url) {
        console.log('🔍 [步骤1] 开始提取视频ID:', url);
        
        const patterns = [
            /video\/(\d+)/,                    // 标准格式: /video/123456
            /modal_id=(\d+)/,                   // 发现页格式: modal_id=123456
            /share\/video\/(\d+)/,              // 分享格式: /share/video/123456
            /v\.douyin\.com\/(\w+)/,            // 短链接格式: v.douyin.com/abc123
            /\/v\/(\w+)/,                       // 备用短链接格式: /v/abc123
            /(\d{19})/                          // 纯数字ID格式
        ];
        
        console.log('🔍 [步骤1.1] 尝试匹配URL模式，共', patterns.length, '种模式');
        
        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            console.log(`🔍 [步骤1.${i+2}] 尝试模式 ${i+1}:`, pattern.toString());
            
            const match = url.match(pattern);
            if (match && match[1]) {
                console.log('✅ [步骤1] 成功提取视频ID:', match[1], '(使用模式', i+1, ')');
                return match[1];
            } else {
                console.log(`❌ [步骤1.${i+2}] 模式 ${i+1} 匹配失败`);
            }
        }
        
        console.log('❌ [步骤1] 所有模式都无法提取视频ID');
        return null;
    }
    
    /**
     * 检查链接是否为真实的视频文件
     */
    isRealVideoFile(url) {
        console.log('🎬 [检查] 验证是否为真实视频文件:', url?.substring(0, 80) + '...');
        
        if (!url) {
            console.log('❌ [检查] URL为空');
            return false;
        }
        
        // 检查是否包含视频文件特征
        const videoIndicators = ['.mp4', 'video', 'play'];
        console.log('🔍 [检查] 寻找视频特征:', videoIndicators);
        
        const hasVideoIndicator = videoIndicators.some(indicator => {
            const found = url.toLowerCase().includes(indicator);
            console.log(`🔍 [检查] 特征 "${indicator}":`, found ? '✅找到' : '❌未找到');
            return found;
        });
        
        // 排除明显的页面链接
        const pageIndicators = ['douyin.com/video/', '/share/', 'web/api'];
        console.log('🔍 [检查] 排除页面链接特征:', pageIndicators);
        
        const isPageLink = pageIndicators.some(indicator => {
            const found = url.includes(indicator);
            console.log(`🔍 [检查] 页面特征 "${indicator}":`, found ? '❌找到(排除)' : '✅未找到');
            return found;
        });
        
        const isRealFile = hasVideoIndicator && !isPageLink;
        console.log('🎬 [检查] 最终结果:', {
            hasVideoIndicator: hasVideoIndicator ? '✅有视频特征' : '❌无视频特征',
            isPageLink: isPageLink ? '❌是页面链接' : '✅不是页面链接',
            finalResult: isRealFile ? '✅真实视频文件' : '❌非视频文件'
        });
        
        return isRealFile;
    }
    
    /**
     * 主解析方法 - 使用最新算法（腾讯云文章方法）
     */
    async parse(url) {
        console.log('🔥 [算法] 使用最新算法解析抖音视频:', url);
        
        try {
            // 步骤1: 提取视频ID
            console.log('📋 [步骤2] 开始提取视频ID...');
            const videoId = this.extractVideoId(url);
            if (!videoId) {
                console.error('❌ [步骤2] 视频ID提取失败');
                throw new Error('无法提取视频ID');
            }
            console.log('✅ [步骤2] 成功提取到视频ID:', videoId);
            
            // 步骤2: 构造分享页面URL
            console.log('🔗 [步骤3] 开始构造分享页面URL...');
            const shareUrl = `https://www.iesdouyin.com/share/video/${videoId}`;
            console.log('✅ [步骤3] 构造分享URL成功:', shareUrl);
            
            // 步骤3: 准备请求头（使用iPhone User-Agent）
            console.log('📱 [步骤4] 准备iPhone模拟请求头...');
            const headers = {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/121.0.2277.107 Version/17.0 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://www.douyin.com/',
                'Connection': 'keep-alive'
            };
            console.log('✅ [步骤4] 请求头准备完成，User-Agent:', headers['User-Agent'].substring(0, 50) + '...');
            
            // 步骤4: 发送请求获取页面内容
            console.log('🌐 [步骤5] 开始请求分享页面...');
            const response = await makeRequest(shareUrl, { headers });
            console.log('📡 [步骤5] 收到响应，状态码:', response.status);
            
            if (!response.ok) {
                console.error('❌ [步骤5] 页面请求失败，状态码:', response.status);
                throw new Error(`页面请求失败: ${response.status}`);
            }
            console.log('✅ [步骤5] 页面请求成功');
            
            // 步骤5: 获取HTML内容
            console.log('📄 [步骤6] 开始读取HTML内容...');
            const htmlContent = await response.text();
            console.log('✅ [步骤6] HTML内容获取成功，长度:', htmlContent.length, '字符');
            console.log('🔍 [步骤6] HTML前100字符:', htmlContent.substring(0, 100));
            
            // 步骤6: 使用正则表达式提取 window._ROUTER_DATA
            console.log('🎯 [步骤7] 开始提取window._ROUTER_DATA...');
            const pattern = /window\._ROUTER_DATA\s*=\s*(.*?)<\/script>/s;
            console.log('🔍 [步骤7] 使用正则表达式:', pattern.toString());
            
            const match = pattern.exec(htmlContent);
            if (!match) {
                console.error('❌ [步骤7] 正则表达式匹配失败');
                console.log('🔍 [步骤7] HTML中是否包含_ROUTER_DATA:', htmlContent.includes('_ROUTER_DATA'));
                throw new Error('未找到 window._ROUTER_DATA 数据');
            }
            
            if (!match[1]) {
                console.error('❌ [步骤7] 匹配到_ROUTER_DATA但内容为空');
                throw new Error('_ROUTER_DATA 内容为空');
            }
            
            console.log('✅ [步骤7] 成功匹配到路由数据');
            console.log('📊 [步骤7] 提取到的JSON长度:', match[1].length, '字符');
            console.log('🔍 [步骤7] JSON前200字符:', match[1].substring(0, 200));
            
            // 步骤7: 解析JSON数据
            console.log('📊 [步骤8] 开始解析JSON数据...');
            const jsonStr = match[1].trim();
            let jsonData;
            
            try {
                jsonData = JSON.parse(jsonStr);
                console.log('✅ [步骤8] JSON解析成功');
                console.log('🔍 [步骤8] JSON根键:', Object.keys(jsonData));
            } catch (parseError) {
                console.error('❌ [步骤8] JSON解析失败:', parseError);
                console.log('🔍 [步骤8] 尝试解析的JSON前500字符:', jsonStr.substring(0, 500));
                throw new Error('JSON数据解析失败: ' + parseError.message);
            }
            
            // 步骤8: 从特定路径提取视频信息
            console.log('🎬 [步骤9] 开始从JSON中提取视频信息...');
            const videoPath = `video_(${videoId})/page`;
            console.log('🔍 [步骤9] 查找路径:', videoPath);
            
            console.log('🔍 [步骤9] loaderData键:', jsonData?.loaderData ? Object.keys(jsonData.loaderData) : '不存在');
            
            const loaderData = jsonData?.loaderData?.[videoPath]?.videoInfoRes?.item_list?.[0];
            
            if (!loaderData) {
                console.error('❌ [步骤9] 未找到视频详细信息');
                console.log('🔍 [步骤9] 尝试查找其他可能的路径...');
                
                // 尝试其他可能的路径
                const alternativePaths = [
                    `video_${videoId}/page`,
                    `video/${videoId}`,
                    'default'
                ];
                
                for (const altPath of alternativePaths) {
                    console.log(`🔍 [步骤9] 尝试路径: ${altPath}`);
                    const altData = jsonData?.loaderData?.[altPath]?.videoInfoRes?.item_list?.[0];
                    if (altData) {
                        console.log('✅ [步骤9] 在备用路径找到数据:', altPath);
                        break;
                    }
                }
                
                throw new Error('未找到视频详细信息，可能是视频路径格式变更');
            }
            
            console.log('✅ [步骤9] 成功提取视频数据');
            console.log('🔍 [步骤9] 视频数据键:', Object.keys(loaderData));
            
            // 步骤9: 获取视频播放地址并去水印
            console.log('🎭 [步骤10] 开始获取视频播放地址...');
            
            console.log('🔍 [步骤10] video键:', loaderData?.video ? Object.keys(loaderData.video) : '不存在');
            console.log('🔍 [步骤10] play_addr键:', loaderData?.video?.play_addr ? Object.keys(loaderData.video.play_addr) : '不存在');
            
            const playAddr = loaderData?.video?.play_addr?.url_list?.[0];
            if (!playAddr) {
                console.error('❌ [步骤10] 未找到视频播放地址');
                console.log('🔍 [步骤10] url_list内容:', loaderData?.video?.play_addr?.url_list);
                throw new Error('未找到视频播放地址');
            }
            
            console.log('✅ [步骤10] 找到原始播放地址');
            console.log('🎭 [步骤10] 原始链接:', playAddr);
            
            // 关键的去水印处理：将"playwm"替换为"play"
            console.log('✨ [步骤11] 开始去水印处理...');
            const cleanVideoUrl = playAddr.replace('playwm', 'play');
            console.log('✅ [步骤11] 去水印处理完成');
            console.log('🎭 [步骤11] 原始链接:', playAddr);
            console.log('✨ [步骤11] 去水印链接:', cleanVideoUrl);
            console.log('🔍 [步骤11] 是否进行了替换:', playAddr !== cleanVideoUrl ? '✅是' : '❌否');
            
            // 验证是否为真实视频文件
            console.log('🎬 [步骤12] 开始验证链接有效性...');
            if (!this.isRealVideoFile(cleanVideoUrl)) {
                console.error('❌ [步骤12] 获取的链接不是有效的视频文件');
                throw new Error('获取的链接不是有效的视频文件');
            }
            console.log('✅ [步骤12] 链接验证通过，确认为视频文件');
            
            // 步骤12: 构造返回结果
            console.log('📦 [步骤13] 开始构造返回结果...');
            const result = {
                success: true,
                title: loaderData?.desc || '抖音视频',
                download_url: cleanVideoUrl,
                platform: this.platformName,
                video_id: videoId,
                author: loaderData?.author?.nickname || '未知作者',
                duration: loaderData?.video?.duration || 0,
                size: '未知',
                filename: `douyin_${videoId}.mp4`,
                note: '使用最新算法获取的无水印视频'
            };
            
            console.log('✅ [步骤13] 结果构造完成');
            console.log('🎉 [成功] 解析成功！结果:', {
                success: result.success,
                title: result.title,
                author: result.author,
                videoId: result.video_id,
                downloadUrl: result.download_url.substring(0, 100) + '...'
            });
            
            return result;
            
        } catch (error) {
            console.error('❌ [算法] 最新算法解析失败:', error.message);
            console.error('❌ [算法] 错误堆栈:', error.stack);
            return {
                success: false,
                message: `解析失败: ${error.message}`,
                platform: this.platformName
            };
        }
    }
}

// ===== 其他平台解析器（简化版） =====

class GenericParser {
    constructor(platform) {
        this.platformName = platform;
    }
    
    async parse(url) {
        return {
            success: false,
            message: `${this.platformName}平台解析功能正在开发中，敬请期待`
        };
    }
}

// ===== 解析器工厂 =====

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

// ===== 平台检测 =====

function getPlatformFromUrl(url) {
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('douyin.com') || urlLower.includes('iesdouyin.com')) {
        return 'douyin';
    } else if (urlLower.includes('kuaishou.com')) {
        return 'kuaishou';
    } else if (urlLower.includes('xiaohongshu.com') || urlLower.includes('xhslink.com')) {
        return 'xiaohongshu';
    } else if (urlLower.includes('bilibili.com')) {
        return 'bilibili';
    } else if (urlLower.includes('weishi.qq.com')) {
        return 'weishi';
    }
    
    return null;
}

// ===== Netlify Functions 入口点 =====

exports.handler = async (event, context) => {
    console.log('🚀 [启动] 视频解析器启动');
    console.log('🔧 [请求] 方法:', event.httpMethod);
    console.log('🌐 [请求] 路径:', event.path);
    
    // 设置CORS头
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    // 处理OPTIONS预检请求
    if (event.httpMethod === 'OPTIONS') {
        console.log('✅ [CORS] 处理OPTIONS预检请求');
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }
    
    try {
        let url;
        
        // 解析请求参数
        if (event.httpMethod === 'GET') {
            url = event.queryStringParameters?.url;
            console.log('📥 [GET] 接收到URL参数:', url);
        } else if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');
            url = body.url;
            console.log('📥 [POST] 接收到URL参数:', url);
        }
        
        // 验证URL参数
        if (!url) {
            console.error('❌ [参数] URL参数为空');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: '缺少必要的URL参数'
                })
            };
        }
        
        console.log('🔍 [解析] 开始解析URL:', url);
        
        // 检测平台
        const platform = getPlatformFromUrl(url);
        console.log('🎯 [平台] 检测到平台:', platform || '未知');
        
        if (!platform) {
            console.error('❌ [平台] 不支持的平台');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: '不支持的视频平台，目前仅支持抖音、快手、小红书、哔哩哔哩、微视'
                })
            };
        }
        
        // 获取对应的解析器
        const parser = getParser(platform);
        if (!parser) {
            console.error('❌ [解析器] 无法获取解析器');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: '解析器初始化失败'
                })
            };
        }
        
        console.log('🔧 [解析器] 解析器创建成功，开始解析...');
        
        // 执行解析
        const result = await parser.parse(url);
        
        console.log('🎯 [结果] 解析完成，成功:', result.success);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };
        
    } catch (error) {
        console.error('❌ [系统] 系统错误:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: '服务器内部错误，请稍后重试',
                error: error.message
            })
        };
    }
};
