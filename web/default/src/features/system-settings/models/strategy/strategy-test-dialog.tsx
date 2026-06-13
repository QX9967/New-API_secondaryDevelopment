/*
Copyright (C) 2023-2026 QuantumNous

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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { testClassifier } from './api'
import type { Strategy, ClassifierResult } from './types'

export function StrategyTestDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  strategy?: Strategy
}) {
  const { t } = useTranslation()
  const { open, onOpenChange, strategy } = props
  const [testMessage, setTestMessage] = useState('')
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<ClassifierResult | null>(null)
  const [error, setError] = useState('')

  const handleTest = async () => {
    if (!strategy || !testMessage.trim()) return
    setTesting(true)
    setError('')
    setResult(null)

    try {
      const res = await testClassifier({
        classifier_type: strategy.classifier_type ?? 'channel',
        classifier_channel_id: strategy.classifier_channel_id,
        classifier_model: strategy.classifier_model,
        classifier_api_key: strategy.classifier_api_key,
        classifier_base_url: strategy.classifier_base_url,
        classifier_prompt: strategy.classifier_prompt,
        classifier_timeout: strategy.classifier_timeout,
        test_message: testMessage,
      })

      if (res.success && res.data) {
        setResult(res.data)
      } else {
        setError(res.message ?? 'Classification failed')
      }
    } catch (e: any) {
      setError(e.message ?? 'Request failed')
    } finally {
      setTesting(false)
    }
  }

  const levelColors: Record<string, string> = {
    simple: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    hard: 'bg-red-100 text-red-800',
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Test Classifier')}
      contentClassName='sm:max-w-lg'
    >
      <div className='space-y-4'>
        <div>
          <Label>{t('Test Message')}</Label>
          <Textarea
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder={t('Enter a test message to classify...')}
            rows={3}
          />
        </div>

        <Button onClick={handleTest} disabled={testing || !testMessage.trim()}>
          {testing ? t('Testing...') : t('Run Test')}
        </Button>

        {result && (
          <div className='rounded-lg border p-4 space-y-2'>
            <div className='flex items-center gap-2'>
              <span className='text-sm font-medium'>{t('Level')}:</span>
              <Badge className={levelColors[result.level] ?? ''}>
                {result.level}
              </Badge>
            </div>
            <div className='text-sm text-muted-foreground'>
              {result.reason}
            </div>
          </div>
        )}

        {error && (
          <div className='rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800'>
            {error}
          </div>
        )}
      </div>
    </Dialog>
  )
}
