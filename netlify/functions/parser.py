"""
视频下载器 - Netlify Serverless Function
负责解析各大视频平台的分享链接，提取无水印的原始视频下载地址
支持抖音、快手、小红书、哔哩哔哩等主流视频平台

Author: Doro
Version: 1.0.0
"""

import json
import re
import requests
from urllib.parse import urlparse, parse_qs
import traceback
from typing import Dict, Any, Optional, Tuple


# ===== 配置常量 =====
class Config:
    """应用配置类"""
    
    # 请求超时时间（秒）
    REQUEST_TIMEOUT = 30
    
    # 最大重试次数
    MAX_RETRIES = 3
    
    # 用户代理字符串（模拟浏览器访问）
    USER_AGENTS = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
    ]
    
    # 支持的视频平台配置
    SUPPORTED_PLATFORMS = {
        'douyin': ['douyin.com', 'dy.com', 'iesdouyin.com'],
        'kuaishou': ['kuaishou.com', 'ks.com'],
        'xiaohongshu': ['xiaohongshu.com', 'xhs.com'],
        'bilibili': ['bilibili.com', 'b23.tv'],
        'weishi': ['weishi.qq.com']
    }


# ===== 工具函数 =====
def get_platform_from_url(url: str) -> Optional[str]:
    """
    根据URL判断视频平台
    
    Args:
        url: 视频分享链接
        
    Returns:
        平台名称，如果不支持则返回None
    """
    url_lower = url.lower()
    
    for platform, domains in Config.SUPPORTED_PLATFORMS.items():
        for domain in domains:
            if domain in url_lower:
                return platform
    
    return None


def make_request(url: str, headers: Dict[str, str] = None, 
                follow_redirects: bool = True) -> requests.Response:
    """
    发送HTTP请求的通用方法
    
    Args:
        url: 请求URL
        headers: 请求头
        follow_redirects: 是否跟随重定向
        
    Returns:
        响应对象
        
    Raises:
        requests.RequestException: 请求失败
    """
    if headers is None:
        headers = {
            'User-Agent': Config.USER_AGENTS[0],
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }
    
    session = requests.Session()
    session.headers.update(headers)
    
    # 配置重试策略
    for attempt in range(Config.MAX_RETRIES):
        try:
            response = session.get(
                url, 
                timeout=Config.REQUEST_TIMEOUT,
                allow_redirects=follow_redirects
            )
            response.raise_for_status()
            return response
            
        except requests.RequestException as e:
            if attempt == Config.MAX_RETRIES - 1:
                raise e
            continue
    
    raise requests.RequestException("请求失败，已达到最大重试次数")


# ===== 视频解析器类 =====
class VideoParser:
    """视频解析器基类"""
    
    def __init__(self):
        self.platform_name = "未知平台"
    
    def parse(self, url: str) -> Dict[str, Any]:
        """
        解析视频链接
        
        Args:
            url: 视频分享链接
            
        Returns:
            包含视频信息的字典
        """
        raise NotImplementedError("子类必须实现parse方法")


class DouyinParser(VideoParser):
    """抖音视频解析器"""
    
    def __init__(self):
        super().__init__()
        self.platform_name = "抖音"
    
    def parse(self, url: str) -> Dict[str, Any]:
        """解析抖音视频链接"""
        try:
            # 获取真实链接（处理短链接重定向）
            response = make_request(url, follow_redirects=False)
            
            # 如果是重定向，获取重定向后的链接
            if response.status_code in [301, 302]:
                real_url = response.headers.get('Location', url)
            else:
                real_url = url
            
            # 提取视频ID
            video_id = self._extract_video_id(real_url)
            if not video_id:
                raise ValueError("无法提取视频ID")
            
            # 构造API请求
            api_url = f"https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids={video_id}"
            
            # 请求视频信息
            headers = {
                'User-Agent': Config.USER_AGENTS[0],
                'Referer': 'https://www.douyin.com/',
            }
            
            api_response = make_request(api_url, headers)
            data = api_response.json()
            
            # 解析响应数据
            if 'item_list' not in data or not data['item_list']:
                raise ValueError("API响应格式错误")
            
            item = data['item_list'][0]
            video_info = item.get('video', {})
            
            # 提取视频下载链接（尝试获取无水印版本）
            play_addr = video_info.get('play_addr', {})
            download_url = None
            
            # 优先尝试获取原画质链接
            if 'url_list' in play_addr and play_addr['url_list']:
                download_url = play_addr['url_list'][0]
            
            if not download_url:
                raise ValueError("无法获取视频下载链接")
            
            # 处理下载链接（移除水印参数）
            download_url = download_url.replace('watermark=1', 'watermark=0')
            
            return {
                'success': True,
                'title': item.get('desc', '抖音视频'),
                'download_url': download_url,
                'platform': self.platform_name,
                'video_id': video_id,
                'author': item.get('author', {}).get('nickname', ''),
                'duration': video_info.get('duration', 0) / 1000,  # 转换为秒
                'size': '未知',
                'filename': f"douyin_{video_id}.mp4"
            }
            
        except Exception as e:
            raise ValueError(f"抖音视频解析失败: {str(e)}")
    
    def _extract_video_id(self, url: str) -> Optional[str]:
        """从URL中提取视频ID"""
        patterns = [
            r'/video/(\d+)',
            r'item_ids=(\d+)',
            r'/(\d+)/?$'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        
        return None


class KuaishouParser(VideoParser):
    """快手视频解析器"""
    
    def __init__(self):
        super().__init__()
        self.platform_name = "快手"
    
    def parse(self, url: str) -> Dict[str, Any]:
        """解析快手视频链接"""
        try:
            # 获取页面内容
            response = make_request(url)
            html_content = response.text
            
            # 使用正则表达式提取视频信息
            # 快手的视频信息通常在页面的script标签中
            script_pattern = r'window\.pageData\s*=\s*({.*?});'
            script_match = re.search(script_pattern, html_content, re.DOTALL)
            
            if not script_match:
                raise ValueError("无法找到页面数据")
            
            page_data = json.loads(script_match.group(1))
            
            # 解析视频数据结构（快手的数据结构可能会变化）
            video_info = page_data.get('videoInfo', {})
            if not video_info:
                raise ValueError("页面数据中无视频信息")
            
            # 提取下载链接
            video_url = video_info.get('srcNoMark') or video_info.get('src')
            if not video_url:
                raise ValueError("无法获取视频下载链接")
            
            return {
                'success': True,
                'title': video_info.get('title', '快手视频'),
                'download_url': video_url,
                'platform': self.platform_name,
                'author': video_info.get('userName', ''),
                'size': '未知',
                'filename': f"kuaishou_{video_info.get('photoId', 'video')}.mp4"
            }
            
        except Exception as e:
            raise ValueError(f"快手视频解析失败: {str(e)}")


class XiaohongshuParser(VideoParser):
    """小红书视频解析器"""
    
    def __init__(self):
        super().__init__()
        self.platform_name = "小红书"
    
    def parse(self, url: str) -> Dict[str, Any]:
        """解析小红书视频链接"""
        try:
            # 小红书的解析相对复杂，需要处理其特殊的数据结构
            headers = {
                'User-Agent': Config.USER_AGENTS[0],
                'Referer': 'https://www.xiaohongshu.com/',
            }
            
            response = make_request(url, headers)
            html_content = response.text
            
            # 提取页面中的视频数据
            # 小红书通常将数据放在 window.__INITIAL_STATE__ 中
            state_pattern = r'window\.__INITIAL_STATE__\s*=\s*({.*?})</script>'
            state_match = re.search(state_pattern, html_content, re.DOTALL)
            
            if not state_match:
                raise ValueError("无法找到页面状态数据")
            
            try:
                initial_state = json.loads(state_match.group(1))
            except json.JSONDecodeError:
                raise ValueError("页面数据解析失败")
            
            # 根据小红书的数据结构提取视频信息
            note_data = self._extract_note_data(initial_state)
            if not note_data:
                raise ValueError("无法提取笔记数据")
            
            video_url = note_data.get('video_url')
            if not video_url:
                raise ValueError("无法获取视频下载链接")
            
            return {
                'success': True,
                'title': note_data.get('title', '小红书视频'),
                'download_url': video_url,
                'platform': self.platform_name,
                'author': note_data.get('author', ''),
                'size': '未知',
                'filename': f"xiaohongshu_{note_data.get('note_id', 'video')}.mp4"
            }
            
        except Exception as e:
            raise ValueError(f"小红书视频解析失败: {str(e)}")
    
    def _extract_note_data(self, initial_state: Dict) -> Optional[Dict[str, Any]]:
        """从初始状态数据中提取笔记信息"""
        try:
            # 小红书的数据结构可能会变化，这里提供一个基础的解析逻辑
            note_detail = initial_state.get('note', {}).get('noteDetailMap', {})
            
            for note_id, note_info in note_detail.items():
                note = note_info.get('note', {})
                if note.get('type') == 'video':
                    video_info = note.get('video', {})
                    return {
                        'note_id': note_id,
                        'title': note.get('title', ''),
                        'author': note.get('user', {}).get('nickname', ''),
                        'video_url': video_info.get('media', {}).get('videoKey', '')
                    }
            
            return None
            
        except Exception:
            return None


# ===== 解析器工厂 =====
def get_parser(platform: str) -> Optional[VideoParser]:
    """
    根据平台名称获取对应的解析器
    
    Args:
        platform: 平台名称
        
    Returns:
        解析器实例，如果平台不支持则返回None
    """
    parsers = {
        'douyin': DouyinParser(),
        'kuaishou': KuaishouParser(),
        'xiaohongshu': XiaohongshuParser(),
    }
    
    return parsers.get(platform)


# ===== 主处理函数 =====
def handler(event, context):
    """
    Netlify Functions的入口函数
    处理前端发送的视频解析请求
    
    Args:
        event: Netlify传入的事件对象
        context: Netlify传入的上下文对象
        
    Returns:
        包含statusCode和body的响应字典
    """
    
    # 设置CORS头
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    }
    
    try:
        # 处理预检请求
        if event.get('httpMethod') == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({'message': 'CORS preflight'})
            }
        
        # 只接受POST请求
        if event.get('httpMethod') != 'POST':
            return {
                'statusCode': 405,
                'headers': headers,
                'body': json.dumps({
                    'success': False,
                    'message': '只支持POST请求'
                })
            }
        
        # 解析请求体
        try:
            if isinstance(event.get('body'), str):
                request_data = json.loads(event['body'])
            else:
                request_data = event.get('body', {})
        except json.JSONDecodeError:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'success': False,
                    'message': '请求数据格式错误'
                })
            }
        
        # 获取视频URL
        video_url = request_data.get('url', '').strip()
        if not video_url:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'success': False,
                    'message': '请提供视频链接'
                })
            }
        
        # 判断平台
        platform = get_platform_from_url(video_url)
        if not platform:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'success': False,
                    'message': '不支持此平台，目前支持抖音、快手、小红书等平台'
                })
            }
        
        # 获取解析器
        parser = get_parser(platform)
        if not parser:
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({
                    'success': False,
                    'message': f'{platform}解析器暂未实现'
                })
            }
        
        # 执行解析
        try:
            result = parser.parse(video_url)
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(result, ensure_ascii=False)
            }
            
        except ValueError as e:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'success': False,
                    'message': str(e)
                })
            }
        
    except Exception as e:
        # 记录错误详情（在生产环境中应该使用proper logging）
        error_details = traceback.format_exc()
        print(f"解析过程中发生错误: {error_details}")
        
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'success': False,
                'message': '服务器内部错误，请稍后重试'
            })
        }


# ===== 本地测试代码 =====
if __name__ == "__main__":
    """本地测试入口"""
    
    # 测试用例
    test_urls = [
        "https://www.douyin.com/video/7123456789012345678",  # 抖音测试链接
        "https://www.kuaishou.com/short-video/3x123456789",  # 快手测试链接
    ]
    
    for test_url in test_urls:
        print(f"\n测试URL: {test_url}")
        
        # 模拟Netlify event结构
        mock_event = {
            'httpMethod': 'POST',
            'body': json.dumps({'url': test_url})
        }
        
        mock_context = {}
        
        try:
            result = handler(mock_event, mock_context)
            print(f"状态码: {result['statusCode']}")
            print(f"响应: {result['body']}")
        except Exception as e:
            print(f"测试失败: {e}")
