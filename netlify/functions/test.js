/**
 * 简单的测试函数，用于验证Netlify Functions是否正常工作
 */

export const handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
        'Content-Type': 'application/json'
    };
    
    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'CORS preflight' })
        };
    }
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            message: 'Netlify Functions 工作正常！',
            method: event.httpMethod || 'UNKNOWN',
            path: event.path || 'UNKNOWN',
            timestamp: new Date().toISOString()
        })
    };
};
