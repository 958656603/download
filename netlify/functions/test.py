"""
简单的测试函数，用于验证Netlify Functions是否正常工作
"""

import json

def handler(event, context):
    """
    简单的测试处理器
    """
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
        'Content-Type': 'application/json'
    }
    
    # 处理预检请求
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'message': 'CORS preflight'})
        }
    
    return {
        'statusCode': 200,
        'headers': headers,
        'body': json.dumps({
            'success': True,
            'message': 'Netlify Functions 工作正常！',
            'method': event.get('httpMethod', 'UNKNOWN'),
            'path': event.get('path', 'UNKNOWN')
        })
    }
