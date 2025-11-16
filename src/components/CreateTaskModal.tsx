import React, { useState } from 'react';
import { Modal, Form, Input, Select, Button, message, Row, Col } from 'antd';
import { PlusOutlined, DownloadOutlined } from '@ant-design/icons';
import { taskAPI } from '../services/api';

const { Option } = Select;
const { TextArea } = Input;

interface CreateTaskModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  visible,
  onCancel,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const taskData = {
        task_type: 'download' as const,
        source_config: {
          platform: values.platform,
          videoId: values.videoId,
          quality: values.quality || 'high',
          extractAudio: values.extractAudio || false
        },
        target_config: {
          outputPath: values.outputPath || './downloads',
          renamePattern: values.renamePattern || '{title}_{id}',
          createFolder: values.createFolder || true
        },
        processing_config: {
          autoProcess: values.autoProcess || false,
          processingType: values.processingType || 'none'
        }
      };

      const response = await taskAPI.createTask(taskData);
      
      if (response.success) {
        message.success('任务创建成功');
        form.resetFields();
        onSuccess();
      } else {
        message.error(response.error?.message || '创建任务失败');
      }
    } catch (error) {
      message.error('创建任务失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="创建下载任务"
      visible={visible}
      onCancel={onCancel}
      footer={null}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="platform"
              label="平台"
              rules={[{ required: true, message: '请选择平台' }]}
            >
              <Select placeholder="选择平台">
                <Option value="douyin">抖音</Option>
                <Option value="kuaishou">快手</Option>
                <Option value="xiaohongshu">小红书</Option>
                <Option value="bilibili">哔哩哔哩</Option>
                <Option value="wechat">微信视频号</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="videoId"
              label="视频ID"
              rules={[{ required: true, message: '请输入视频ID' }]}
            >
              <Input placeholder="输入视频ID或URL" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="quality"
              label="下载质量"
              initialValue="high"
            >
              <Select placeholder="选择质量">
                <Option value="highest">最高</Option>
                <Option value="high">高</Option>
                <Option value="medium">中</Option>
                <Option value="low">低</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="extractAudio"
              label="提取音频"
              valuePropName="checked"
              initialValue={false}
            >
              <Select placeholder="是否提取音频">
                <Option value={false}>否</Option>
                <Option value={true}>是</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="outputPath"
          label="输出路径"
          initialValue="./downloads"
        >
          <Input placeholder="输入输出路径" />
        </Form.Item>

        <Form.Item
          name="renamePattern"
          label="重命名规则"
          initialValue="{title}_{id}"
        >
          <Input placeholder="输入重命名规则" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="autoProcess"
              label="自动处理"
              valuePropName="checked"
              initialValue={false}
            >
              <Select placeholder="是否自动处理">
                <Option value={false}>否</Option>
                <Option value={true}>是</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="createFolder"
              label="创建文件夹"
              valuePropName="checked"
              initialValue={true}
            >
              <Select placeholder="是否创建文件夹">
                <Option value={false}>否</Option>
                <Option value={true}>是</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="processingType"
          label="处理类型"
          initialValue="none"
        >
          <Select placeholder="选择处理类型">
            <Option value="none">无处理</Option>
            <Option value="transcribe">转录</Option>
            <Option value="translate">翻译</Option>
            <Option value="summarize">摘要</Option>
            <Option value="remix">混剪</Option>
          </Select>
        </Form.Item>

        <Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Button onClick={onCancel} style={{ marginRight: 8 }}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={loading} icon={<DownloadOutlined />}>
              创建任务
            </Button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateTaskModal;