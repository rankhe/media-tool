import React, { useState } from 'react';
import { Modal, Form, Input, Select, Switch, Upload, Button, Space, message, Row, Col, Card, Divider } from 'antd';
import { UploadOutlined, PlayCircleOutlined, SettingOutlined } from '@ant-design/icons';
import { videoProcessingAPI } from '../services/api';

const { TextArea } = Input;
const { Option } = Select;

interface VideoProcessingModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  videoPath?: string;
  videoId?: string;
}

const VideoProcessingModal: React.FC<VideoProcessingModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  videoPath,
  videoId
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('transcription');

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const processingConfig = {
        videoPath: videoPath || values.videoPath,
        videoId: videoId,
        // 文案处理
        transcribe: values.transcribe || false,
        translate: values.translate || false,
        summarize: values.summarize || false,
        targetLanguage: values.targetLanguage || 'en',
        // 声音处理
        removeOriginalAudio: values.removeOriginalAudio || false,
        addBackgroundMusic: values.addBackgroundMusic || false,
        backgroundMusicPath: values.backgroundMusicPath,
        adjustAudioVolume: values.adjustAudioVolume || 1.0,
        // 画面处理
        resizeVideo: values.resizeVideo || false,
        targetResolution: values.targetResolution || '1920x1080',
        addWatermark: values.addWatermark || false,
        watermarkPath: values.watermarkPath,
        watermarkPosition: values.watermarkPosition || 'top-right',
        cropVideo: values.cropVideo || false,
        cropArea: values.cropArea || 'in_w/2:in_h/2:in_w/2:in_h/2',
        // 特效处理
        addEffects: values.addEffects || false,
        effectsType: values.effectsType || 'fade',
        // 字幕处理
        addSubtitles: values.addSubtitles || false,
        subtitleContent: values.subtitleContent,
        subtitleStyle: values.subtitleStyle || 'default'
      };

      if (!videoId) {
        message.error('视频ID不能为空');
        return;
      }
      
      const response = await videoProcessingAPI.processVideo(videoId, processingConfig);
      
      if (response.success) {
        message.success('视频处理任务创建成功');
        form.resetFields();
        onSuccess();
      } else {
        message.error(response.error?.message || '创建处理任务失败');
      }
    } catch (error) {
      message.error('创建处理任务失败');
    } finally {
      setLoading(false);
    }
  };

  const normFile = (e: any) => {
    if (Array.isArray(e)) {
      return e;
    }
    return e?.fileList;
  };

  return (
    <Modal
      title="视频二创处理"
      visible={visible}
      onCancel={onCancel}
      footer={null}
      width={800}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          targetLanguage: 'en',
          targetResolution: '1920x1080',
          watermarkPosition: 'top-right',
          effectsType: 'fade',
          subtitleStyle: 'default'
        }}
      >
        {(!videoPath && !videoId) && (
          <Form.Item
            name="videoPath"
            label="视频文件路径"
            rules={[{ required: true, message: '请输入视频文件路径' }]}
          >
            <Input placeholder="输入视频文件的完整路径" />
          </Form.Item>
        )}

        <Row gutter={16}>
          <Col span={12}>
            <Card title="文案处理" size="small">
              <Form.Item name="transcribe" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                <span style={{ marginLeft: 8 }}>语音转录</span>
              </Form.Item>

              <Form.Item name="translate" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                <span style={{ marginLeft: 8 }}>文本翻译</span>
              </Form.Item>

              <Form.Item name="summarize" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                <span style={{ marginLeft: 8 }}>内容摘要</span>
              </Form.Item>

              <Form.Item name="targetLanguage" label="目标语言">
                <Select placeholder="选择目标语言">
                  <Option value="en">英语</Option>
                  <Option value="zh">中文</Option>
                  <Option value="ja">日语</Option>
                  <Option value="ko">韩语</Option>
                  <Option value="fr">法语</Option>
                  <Option value="de">德语</Option>
                  <Option value="es">西班牙语</Option>
                </Select>
              </Form.Item>
            </Card>
          </Col>

          <Col span={12}>
            <Card title="声音处理" size="small">
              <Form.Item name="removeOriginalAudio" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                <span style={{ marginLeft: 8 }}>移除原音</span>
              </Form.Item>

              <Form.Item name="addBackgroundMusic" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                <span style={{ marginLeft: 8 }}>添加背景音乐</span>
              </Form.Item>

              <Form.Item name="backgroundMusicPath" label="背景音乐">
                <Upload
                  name="file"
                  action="/api/upload"
                  listType="text"
                  maxCount={1}
                >
                  <Button icon={<UploadOutlined />}>选择音频文件</Button>
                </Upload>
              </Form.Item>

              <Form.Item name="adjustAudioVolume" label="音量调整">
                <Select placeholder="选择音量">
                  <Option value={0.5}>50%</Option>
                  <Option value={0.8}>80%</Option>
                  <Option value={1.0}>100%</Option>
                  <Option value={1.2}>120%</Option>
                  <Option value={1.5}>150%</Option>
                </Select>
              </Form.Item>
            </Card>
          </Col>
        </Row>

        <Divider />

        <Row gutter={16}>
          <Col span={12}>
            <Card title="画面处理" size="small">
              <Form.Item name="resizeVideo" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                <span style={{ marginLeft: 8 }}>调整分辨率</span>
              </Form.Item>

              <Form.Item name="targetResolution" label="目标分辨率">
                <Select placeholder="选择分辨率">
                  <Option value="3840x2160">4K (3840x2160)</Option>
                  <Option value="2560x1440">2K (2560x1440)</Option>
                  <Option value="1920x1080">1080p (1920x1080)</Option>
                  <Option value="1280x720">720p (1280x720)</Option>
                  <Option value="854x480">480p (854x480)</Option>
                </Select>
              </Form.Item>

              <Form.Item name="addWatermark" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                <span style={{ marginLeft: 8 }}>添加水印</span>
              </Form.Item>

              <Form.Item name="watermarkPath" label="水印图片">
                <Upload
                  name="file"
                  action="/api/upload"
                  listType="picture"
                  maxCount={1}
                >
                  <Button icon={<UploadOutlined />}>选择图片</Button>
                </Upload>
              </Form.Item>

              <Form.Item name="watermarkPosition" label="水印位置">
                <Select placeholder="选择位置">
                  <Option value="top-left">左上角</Option>
                  <Option value="top-right">右上角</Option>
                  <Option value="bottom-left">左下角</Option>
                  <Option value="bottom-right">右下角</Option>
                  <Option value="center">居中</Option>
                </Select>
              </Form.Item>

              <Form.Item name="cropVideo" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                <span style={{ marginLeft: 8 }}>裁剪画面</span>
              </Form.Item>

              <Form.Item name="cropArea" label="裁剪区域">
                <Input placeholder="例如: in_w/2:in_h/2:in_w/2:in_h/2" />
              </Form.Item>
            </Card>
          </Col>

          <Col span={12}>
            <Card title="特效处理" size="small">
              <Form.Item name="addEffects" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                <span style={{ marginLeft: 8 }}>添加特效</span>
              </Form.Item>

              <Form.Item name="effectsType" label="特效类型">
                <Select placeholder="选择特效">
                  <Option value="fade">淡入淡出</Option>
                  <Option value="blur">模糊效果</Option>
                  <Option value="sharpen">锐化效果</Option>
                  <Option value="vintage">复古风格</Option>
                  <Option value="modern">现代风格</Option>
                </Select>
              </Form.Item>

              <Form.Item name="addSubtitles" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                <span style={{ marginLeft: 8 }}>添加字幕</span>
              </Form.Item>

              <Form.Item name="subtitleContent" label="字幕内容">
                <TextArea 
                  rows={3} 
                  placeholder="输入字幕内容，留空则使用转录文本"
                />
              </Form.Item>

              <Form.Item name="subtitleStyle" label="字幕样式">
                <Select placeholder="选择样式">
                  <Option value="default">默认</Option>
                  <Option value="large">大字体</Option>
                  <Option value="small">小字体</Option>
                  <Option value="bold">粗体</Option>
                  <Option value="italic">斜体</Option>
                </Select>
              </Form.Item>
            </Card>
          </Col>
        </Row>

        <Divider />

        <Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={onCancel}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={loading} icon={<PlayCircleOutlined />}>
                开始处理
              </Button>
            </Space>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default VideoProcessingModal;