import { Form, Input, Select, Button, Card, Space, message, Divider } from 'antd'
import { SaveOutlined, ApiOutlined } from '@ant-design/icons'
import { useAppStore } from '../../store/appStore'
import { DEFAULT_CONFIG } from '../../types/config'
import { useEffect } from 'react'

export function ConfigPanel(): JSX.Element {
  const config = useAppStore((s) => s.config)
  const loadConfig = useAppStore((s) => s.loadConfig)
  const saveConfig = useAppStore((s) => s.saveConfig)
  const [form] = Form.useForm()

  useEffect(() => {
    loadConfig()
  }, [])

  useEffect(() => {
    if (config) {
      form.setFieldsValue(config)
    }
  }, [config, form])

  const handleSave = async (values: Record<string, unknown>): Promise<void> => {
    try {
      for (const [key, value] of Object.entries(values)) {
        await saveConfig(key, value)
      }
      message.success('配置已保存')
    } catch (err) {
      message.error('保存失败: ' + String(err))
    }
  }

  const handleTestLlm = async (): Promise<void> => {
    try {
      const result = await window.electronAPI.configTestLlm()
      if (result.success) {
        message.success(result.message)
      } else {
        message.warning(result.message)
      }
    } catch (err) {
      message.error('测试失败: ' + String(err))
    }
  }

  const handleTestOcr = async (): Promise<void> => {
    try {
      const result = await window.electronAPI.configTestOcr()
      if (result.success) {
        message.success(result.message)
      } else {
        message.warning(result.message)
      }
    } catch (err) {
      message.error('测试失败: ' + String(err))
    }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <Card title="大模型配置" style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="vertical"
          initialValues={config || DEFAULT_CONFIG}
          onFinish={handleSave}
        >
          <Form.Item label="大模型服务商" name="llmProvider">
            <Select
              options={[
                { label: 'DeepSeek', value: 'deepseek' },
                { label: '智谱 AI (GLM)', value: 'zhipu' }
              ]}
            />
          </Form.Item>
          <Form.Item label="模型名称" name="llmModel">
            <Input placeholder="deepseek-chat / glm-4" />
          </Form.Item>
          <Form.Item label="API Key" name="llmApiKey">
            <Input.Password placeholder="输入 API Key" />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
              保存
            </Button>
            <Button onClick={handleTestLlm} icon={<ApiOutlined />}>
              测试连接
            </Button>
          </Space>
        </Form>
      </Card>

      <Card title="阿里云 OCR 配置">
        <Form
          form={form}
          layout="vertical"
          initialValues={config || DEFAULT_CONFIG}
          onFinish={handleSave}
        >
          <Form.Item label="AccessKey ID" name="ocrAccessKeyId">
            <Input placeholder="输入 AccessKey ID" />
          </Form.Item>
          <Form.Item label="AccessKey Secret" name="ocrAccessKeySecret">
            <Input.Password placeholder="输入 AccessKey Secret" />
          </Form.Item>
          <Form.Item label="区域" name="ocrRegion">
            <Input placeholder="cn-hangzhou" />
          </Form.Item>
          <Form.Item label="输出语言偏好" name="outputLanguage">
            <Select
              options={[
                { label: '优先英文，无则原文', value: 'english_preferred' },
                { label: '保留原文', value: 'original' }
              ]}
            />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
              保存
            </Button>
            <Button onClick={handleTestOcr} icon={<ApiOutlined />}>
              测试连接
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  )
}
