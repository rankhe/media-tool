import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Spin, Empty, Tag, Button, message, Avatar, Alert } from 'antd'
import { Search, FireExtinguisher, Star, Flame } from 'lucide-react'
import { wechatAPI, wechatPublicAPI } from '../services/api'

interface Article {
  id: string
  title: string
  description: string
  thumbnail_url: string
  link: string
  author?: { name?: string }
  created_at?: string
}

interface Account {
  id: string
  name: string
  avatar_url: string
  desc?: string
  link: string
}

const proxify = (u: string) => {
  if (!u) return ''
  try {
    const url = new URL(u)
    const host = url.hostname.toLowerCase()
    const needProxy = host.endsWith('qpic.cn') || host.includes('weixin')
    return needProxy ? `/api/proxy/image?url=${encodeURIComponent(u)}` : u
  } catch {
    return u
  }
}

const formatNum = (n?: number) => {
  const v = Number(n || 0)
  if (v >= 10000) return (v / 10000).toFixed(1) + '万'
  return String(v)
}

const ArticleCard = ({ item }: { item: Article }) => {
  const explodeVal = Number((item as any).zan_num ?? 0)
  const created = item.created_at ? new Date(item.created_at) : null
  return (
    <Card 
      hoverable 
      onClick={() => window.open(item.link, '_blank')}
      style={{ cursor: 'pointer' }}
      bodyStyle={{ padding: 12 }}
      cover={item.thumbnail_url ? <img alt={item.title} src={proxify(item.thumbnail_url)} referrerPolicy="no-referrer" crossOrigin="anonymous" className="w-full h-32 object-cover"/> : undefined}
    >
      <div className="space-y-1">
        <div className="font-medium truncate" title={item.title}>{item.title}</div>
        <div className="text-xs text-gray-500">发布时间：{created ? `${created.getFullYear()}-${String(created.getMonth()+1).padStart(2,'0')}-${String(created.getDate()).padStart(2,'0')} ${String(created.getHours()).padStart(2,'0')}:${String(created.getMinutes()).padStart(2,'0')}` : '-'}</div>
        <div className="flex items-center flex-wrap gap-1 text-xs text-gray-600">
          <Avatar size={16} src={item.author?.avatar_url ? proxify(item.author.avatar_url) : undefined} />
          <span className="truncate max-w-[140px]">{item.author?.name || '公众号'}</span>
          <span>阅读数：{formatNum((item as any).view_count)}</span>
          <span>爆值：{explodeVal ? explodeVal.toFixed(2) : '0.00'}</span>
          {(item as any).category && <span className="text-gray-500">{(item as any).category}</span>}
        </div>
      </div>
    </Card>
  )
}

const AccountCard = ({ item }: { item: Account }) => (
  <Card hoverable>
    <div className="flex items-start gap-3">
      <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', flex: '0 0 48px' }}>
        <img src={proxify(item.avatar_url)} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div className="flex-1">
        <div className="font-medium truncate">{item.name}</div>
        {item.desc && <div className="text-xs text-gray-600 line-clamp-2 mt-1">{item.desc}</div>}
        <div className="mt-2">
          <Button size="small" onClick={() => window.open(item.link, '_blank')}>主页</Button>
        </div>
      </div>
    </div>
  </Card>
)

export default function WeChatDiscovery() {
  const [loading, setLoading] = useState(false)
  const [explodes, setExplodes] = useState<Article[]>([])
  const [qualityAccounts, setQualityAccounts] = useState<Account[]>([])
  const [hotArticles, setHotArticles] = useState<Article[]>([])
  const [rateLimit, setRateLimit] = useState({ explodes: false, quality: false, hot: false })
  const [serverError, setServerError] = useState({ explodes: false, quality: false, hot: false })

  const fetchAll = async () => {
    setLoading(true)
    try {
      const results = await Promise.allSettled([
        wechatPublicAPI.explodes(20),
        wechatPublicAPI.qualityAccounts(20),
        wechatPublicAPI.hotArticles(20)
      ])
      const [r1, r2, r3] = results
      if (r1.status === 'fulfilled') setExplodes(r1.value.data?.items || [])
      if (r2.status === 'fulfilled') setQualityAccounts(r2.value.data?.items || [])
      if (r3.status === 'fulfilled') setHotArticles(r3.value.data?.items || [])

      const rl = {
        explodes: r1.status === 'rejected' && ((r1 as any).reason?.response?.status === 429 || ((r1 as any).reason?.response?.data?.error?.code) === 'RATE_LIMIT_EXCEEDED'),
        quality: r2.status === 'rejected' && ((r2 as any).reason?.response?.status === 429 || ((r2 as any).reason?.response?.data?.error?.code) === 'RATE_LIMIT_EXCEEDED'),
        hot: r3.status === 'rejected' && ((r3 as any).reason?.response?.status === 429 || ((r3 as any).reason?.response?.data?.error?.code) === 'RATE_LIMIT_EXCEEDED'),
      }
      setRateLimit(rl)
      if (rl.explodes || rl.quality || rl.hot) message.warning('接口请求频率过高，请稍后重试')

      const se = {
        explodes: r1.status === 'rejected' && ((r1 as any).reason?.response?.status >= 500),
        quality: r2.status === 'rejected' && ((r2 as any).reason?.response?.status >= 500),
        hot: r3.status === 'rejected' && ((r3 as any).reason?.response?.status >= 500),
      }
      setServerError(se)
    } catch (e) {
      message.error('获取公众号热门数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">公众号热点</h1>
        <Button size="small" onClick={fetchAll}>刷新</Button>
      </div>

      <Spin spinning={loading}>
        <Card title={<span><Flame className="w-4 h-4 inline mr-2"/>最新爆文</span>}>
          {rateLimit.explodes && <Alert type="warning" message="请求频率过高，稍后再试" showIcon style={{ marginBottom: 8 }} />}
          {serverError.explodes && <Alert type="error" message="数据源服务异常，请稍后重试" showIcon style={{ marginBottom: 8 }} />}
          {explodes.length ? (
            <Row gutter={[12, 12]}>
              {explodes.map((item) => (
                <Col key={item.id} xs={24} sm={12} md={8} lg={6}><ArticleCard item={item}/></Col>
              ))}
            </Row>
          ) : (<Empty description="暂无数据"/>)}
        </Card>

        <Card title={<span><Star className="w-4 h-4 inline mr-2"/>最新收录优质公众号</span>}>
          {rateLimit.quality && <Alert type="warning" message="请求频率过高，稍后再试" showIcon style={{ marginBottom: 8 }} />}
          {serverError.quality && <Alert type="error" message="数据源服务异常，请稍后重试" showIcon style={{ marginBottom: 8 }} />}
          {qualityAccounts.length ? (
            <Row gutter={[16, 16]}>
              {qualityAccounts.map((item) => (
                <Col key={item.id} xs={24} sm={12} md={8} lg={6}><AccountCard item={item as any}/></Col>
              ))}
            </Row>
          ) : (<Empty description="暂无数据"/>)}
        </Card>

        <Card title={<span><FireExtinguisher className="w-4 h-4 inline mr-2"/>最新热文</span>}>
          {rateLimit.hot && <Alert type="warning" message="请求频率过高，稍后再试" showIcon style={{ marginBottom: 8 }} />}
          {serverError.hot && <Alert type="error" message="数据源服务异常，请稍后重试" showIcon style={{ marginBottom: 8 }} />}
          {hotArticles.length ? (
            <Row gutter={[16, 16]}>
              {hotArticles.map((item) => (
                <Col key={item.id} xs={24} sm={12} md={8} lg={6}><ArticleCard item={item}/></Col>
              ))}
            </Row>
          ) : (<Empty description="暂无数据"/>)}
        </Card>
      </Spin>
    </div>
  )
}