import React, { useState, useRef } from 'react';
import { Card, Button, Upload, message, Form, Input, Select, Slider, Row, Col, Space } from 'antd';
import { UploadOutlined, PlayCircleOutlined, DownloadOutlined, EditOutlined } from '@ant-design/icons';
import ReactPlayer from 'react-player';

const { TextArea } = Input;
const { Option } = Select;

interface VideoEditorProps {
  videoUrl?: string;
  onSave?: (data: any) => void;
  onCancel?: () => void;
}

const VideoEditor: React.FC<VideoEditorProps> = ({ videoUrl, onSave, onCancel }) => {
  const [form] = Form.useForm();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>(videoUrl || '');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerRef = useRef<ReactPlayer>(null);

  const handleUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoPreview(url);
    return false; // 阻止自动上传
  };

  const handlePlayPause = () => {
    setPlaying(!playing);
  };

  const handleProgress = (state: { played: number; playedSeconds: number }) => {
    setCurrentTime(state.playedSeconds);
  };

  const handleDuration = (duration: number) => {
    setDuration(duration);
  };

  const handleSliderChange = (value: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(value / 100, 'fraction');
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const formData = new FormData();
      
      if (videoFile) {
        formData.append('video', videoFile);
      }
      
      Object.keys(values).forEach(key => {
        formData.append(key, values[key]);
      });

      onSave?.(formData);
      message.success('视频编辑任务已创建');
    } catch (error) {
      message.error('请检查表单内容');
    }
  };

  return (
    <div className="video-editor">
      <Row gutter={24}>
        <Col span={16}>
          <Card title="视频预览">
            <div className="video-container mb-4" style={{ position: 'relative', paddingBottom: '56.25%' }}>
              {videoPreview ? (
                <ReactPlayer
                  ref={playerRef}
                  url={videoPreview}
                  playing={playing}
                  onProgress={handleProgress}
                  onDuration={handleDuration}
                  width="100%"
                  height="100%"
                  style={{ position: 'absolute', top: 0, left: 0 }}
                  controls
                />
              ) : (
                <div className="flex items-center justify-center h-64 bg-gray-100 rounded">
                  <Upload
                    beforeUpload={handleUpload}
                    showUploadList={false}
                    accept="video/*"
                  >
                    <Button icon={<UploadOutlined />} size="large">
                      选择视频文件
                    </Button>
                  </Upload>
                </div>
              )}
            </div>

            {videoPreview && (
              <div className="video-controls">
                <Space className="mb-4">
                  <Button
                    icon={<PlayCircleOutlined />}
                    onClick={handlePlayPause}
                  >
                    {playing ? '暂停' : '播放'}
                  </Button>
                  <span>
                    {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')} / 
                    {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}
                  </span>
                </Space>
                
                <Slider
                  min={0}
                  max={100}
                  value={duration ? (currentTime / duration) * 100 : 0}
                  onChange={handleSliderChange}
                  tipFormatter={(value) => `${Math.floor((value / 100) * duration)}秒`}
                />
              </div>
            )}
          </Card>
        </Col>

        <Col span={8}>
          <Card title="编辑设置">
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                processingType: 'all',
                textProcessing: true,
                audioProcessing: false,
                videoEffects: false,
                watermark: false,
              }}
            >
              <Form.Item
                name="processingType"
                label="处理方式"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value="all">完整处理</Option>
                  <Option value="textOnly">仅文案处理</Option>
                  <Option value="audioOnly">仅音频处理</Option>
                  <Option value="videoOnly">仅画面处理</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="title"
                label="视频标题"
                rules={[{ required: true, message: '请输入视频标题' }]}
              >
                <Input placeholder="输入视频标题" />
              </Form.Item>

              <Form.Item
                name="description"
                label="视频描述"
              >
                <TextArea
                  rows={4}
                  placeholder="输入视频描述（可选）"
                />
              </Form.Item>

              <Form.Item
                name="tags"
                label="标签"
              >
                <Select
                  mode="tags"
                  placeholder="添加标签"
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <Form.Item
                name="textProcessing"
                label="文案处理"
                valuePropName="checked"
              >
                <Select>
                  <Option value={true}>启用</Option>
                  <Option value={false}>禁用</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="audioProcessing"
                label="音频处理"
                valuePropName="checked"
              >
                <Select>
                  <Option value={true}>启用</Option>
                  <Option value={false}>禁用</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="videoEffects"
                label="视频特效"
                valuePropName="checked"
              >
                <Select>
                  <Option value={true}>启用</Option>
                  <Option value={false}>禁用</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="watermark"
                label="添加水印"
                valuePropName="checked"
              >
                <Select>
                  <Option value={true}>启用</Option>
                  <Option value={false}>禁用</Option>
                </Select>
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button type="primary" onClick={handleSave}>
                    创建编辑任务
                  </Button>
                  <Button onClick={onCancel}>
                    取消
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default VideoEditor;