/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Input,
  Button,
  Descriptions,
  Tag,
  Typography,
  Spin,
  Toast,
} from '@douyinfe/semi-ui';
import { IconSearch, IconKey } from '@douyinfe/semi-icons';
import { API } from '../../helpers/api';
import { renderQuotaNumberWithDigit, getQuotaPerUnit } from '../../helpers';

const { Text, Title } = Typography;

const TokenQuotaCheck = () => {
  const { t } = useTranslation();
  const [tokenKey, setTokenKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenData, setTokenData] = useState(null);
  const [error, setError] = useState('');

  const quotaPerUnit = getQuotaPerUnit() || 500000;

  const handleQuery = useCallback(async () => {
    if (!tokenKey.trim()) {
      Toast.warning(t('请输入令牌密钥'));
      return;
    }

    setLoading(true);
    setError('');
    setTokenData(null);

    try {
      const key = tokenKey.trim().replace(/^sk-/, '');
      const res = await API.get('/api/usage/token', {
        headers: {
          Authorization: `Bearer sk-${key}`,
        },
        skipErrorHandler: true,
      });

      if (res.data.code || res.data.success) {
        setTokenData(res.data.data);
      } else {
        setError(res.data.message || t('查询失败'));
      }
    } catch (err) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError(t('查询失败，请检查令牌密钥是否正确'));
      }
    } finally {
      setLoading(false);
    }
  }, [tokenKey, t]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleQuery();
    }
  };

  const formatExpiresAt = (timestamp) => {
    if (timestamp === 0 || timestamp === -1) return t('永不过期');
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  return (
    <div className='mt-[60px] px-2 max-w-4xl mx-auto'>
      <Card className='mb-4'>
        <div className='text-center mb-6'>
          <Title heading={3}>{t('令牌额度查询')}</Title>
          <Text type='secondary'>
            {t('输入您的令牌密钥查询剩余额度和使用情况')}
          </Text>
        </div>

        <div className='flex gap-2 mb-4'>
          <Input
            prefix={<IconKey />}
            placeholder={t('请输入令牌密钥，例如 sk-xxx')}
            value={tokenKey}
            onChange={setTokenKey}
            onKeyPress={handleKeyPress}
            size='large'
            className='flex-1'
          />
          <Button
            type='primary'
            icon={<IconSearch />}
            onClick={handleQuery}
            loading={loading}
            size='large'
          >
            {t('查询')}
          </Button>
        </div>

        {error && (
          <div className='text-center text-red-500 mb-4'>
            <Text type='danger'>{error}</Text>
          </div>
        )}

        {loading && (
          <div className='text-center py-8'>
            <Spin size='large' />
          </div>
        )}

        {tokenData && !loading && (
          <Card className='bg-blue-50 border-0'>
            <div className='mb-4'>
              <Text strong className='text-lg'>
                {tokenData.name || t('未命名令牌')}
              </Text>
            </div>

            <Descriptions
              data={[
                {
                  key: t('令牌名称'),
                  value: tokenData.name || '-',
                },
                {
                  key: t('总配额'),
                  value: tokenData.unlimited_quota
                    ? t('无限')
                    : renderQuotaNumberWithDigit(tokenData.total_granted / quotaPerUnit),
                },
                {
                  key: t('已使用'),
                  value: renderQuotaNumberWithDigit(tokenData.total_used / quotaPerUnit),
                },
                {
                  key: t('剩余额度'),
                  value: tokenData.unlimited_quota
                    ? t('无限')
                    : renderQuotaNumberWithDigit(tokenData.total_available / quotaPerUnit),
                },
                {
                  key: t('额度状态'),
                  value: (
                    <Tag
                      color={
                        tokenData.unlimited_quota ||
                        tokenData.total_available > 0
                          ? 'green'
                          : 'red'
                      }
                    >
                      {tokenData.unlimited_quota
                        ? t('无限额度')
                        : tokenData.total_available > 0
                          ? t('正常')
                          : t('已用尽')}
                    </Tag>
                  ),
                },
                {
                  key: t('过期时间'),
                  value: formatExpiresAt(tokenData.expires_at),
                },
                {
                  key: t('模型限制'),
                  value: tokenData.model_limits_enabled ? (
                    <div className='flex flex-wrap gap-1'>
                      {tokenData.model_limits &&
                        Object.keys(tokenData.model_limits).map(
                          (model, idx) => (
                            <Tag key={idx} color='blue' size='small'>
                              {model}
                            </Tag>
                          ),
                        )}
                    </div>
                  ) : (
                    <Tag color='green'>{t('不限制')}</Tag>
                  ),
                },
              ]}
            />
          </Card>
        )}
      </Card>
    </div>
  );
};

export default TokenQuotaCheck;
