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
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Key, Search, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PublicLayout } from '@/components/layout'
import { getTokenUsageByKey } from './lib/api'
import type { TokenQuotaInfo } from './types'
import { KeySummaryCards } from './components/key-summary-cards'

export function KeyQuotaChecker() {
  const { t } = useTranslation()
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [quotaInfo, setQuotaInfo] = useState<TokenQuotaInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCheck = useCallback(async () => {
    const trimmedKey = apiKey.trim()
    if (!trimmedKey) {
      toast.error(t('Please enter an API key'))
      return
    }

    setLoading(true)
    setError(null)
    setQuotaInfo(null)

    try {
      const response = await getTokenUsageByKey(trimmedKey)

      if (response.code && response.data) {
        const data = response.data
        setQuotaInfo({
          name: data.name,
          totalGranted: data.total_granted,
          totalUsed: data.total_used,
          totalAvailable: data.total_available,
          unlimitedQuota: data.unlimited_quota,
          modelLimits: data.model_limits,
          modelLimitsEnabled: data.model_limits_enabled,
          expiresAt: data.expires_at,
        })
      } else {
        setError(response.message || t('Failed to fetch quota info'))
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t('Failed to fetch quota info')
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [apiKey, t])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !loading) {
        handleCheck()
      }
    },
    [handleCheck, loading]
  )

  return (
    <PublicLayout showMainContainer={false}>
      <div className='relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden p-4'>
      {/* Radial gradient background */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 z-0 opacity-40 dark:opacity-[0.12]'
        style={{
          background: [
            'radial-gradient(ellipse 60% 50% at 20% 20%, oklch(0.72 0.18 250 / 80%) 0%, transparent 70%)',
            'radial-gradient(ellipse 50% 40% at 80% 15%, oklch(0.65 0.15 200 / 60%) 0%, transparent 70%)',
            'radial-gradient(ellipse 40% 35% at 40% 80%, oklch(0.70 0.12 280 / 40%) 0%, transparent 70%)',
          ].join(', '),
        }}
      />
      {/* Grid pattern */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,black_20%,transparent_100%)] bg-[size:4rem_4rem] opacity-[0.15]'
      />
      <div className='relative z-10 w-full max-w-3xl space-y-6'>
        <div className='space-y-2 text-center'>
          <div className='flex items-center justify-center gap-2'>
            <Key className='size-8 text-primary' />
            <h1 className='text-3xl font-bold tracking-tight'>
              {t('Check Key Quota')}
            </h1>
          </div>
          <p className='text-muted-foreground'>
            {t('Enter your API key to check remaining quota and usage details')}
          </p>
        </div>

        <div className='bg-card rounded-xl border p-6 shadow-sm'>
          <div className='flex flex-col gap-4 sm:flex-row'>
            <div className='relative flex-1'>
              <Search className='text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2' />
              <Input
                type='text'
                placeholder={t('Enter API key (sk-...)')}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={handleKeyDown}
                className='pl-9 font-mono'
                disabled={loading}
              />
            </div>
            <Button
              onClick={handleCheck}
              disabled={loading || !apiKey.trim()}
              className='sm:w-auto'
            >
              {loading ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                <Search className='size-4' />
              )}
              <span className='ml-2'>{t('Check')}</span>
            </Button>
          </div>
        </div>

        {error && (
          <div className='bg-destructive/10 text-destructive flex items-center gap-3 rounded-xl border border-destructive/20 p-4'>
            <AlertCircle className='size-5 shrink-0' />
            <p className='text-sm'>{error}</p>
          </div>
        )}

        {quotaInfo && <KeySummaryCards quotaInfo={quotaInfo} />}

        {!quotaInfo && !error && !loading && (
          <div className='text-muted-foreground py-12 text-center'>
            <Key className='mx-auto mb-4 size-12 opacity-20' />
            <p>{t('Enter an API key above to check its quota')}</p>
          </div>
        )}
      </div>
      </div>
    </PublicLayout>
  )
}
