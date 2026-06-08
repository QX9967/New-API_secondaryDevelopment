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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Flame, ShieldCheck, TrendingDown, Key } from 'lucide-react'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TokenQuotaInfo } from '../types'

interface KeySummaryCardsProps {
  quotaInfo: TokenQuotaInfo
}

type HealthLevel = 'healthy' | 'caution' | 'critical'

function getHealthLevel(remainQuota: number, totalUsed: number): HealthLevel {
  if (remainQuota <= 0) return 'critical'
  if (totalUsed > 0 && remainQuota / totalUsed < 0.1) return 'caution'
  return 'healthy'
}

const HEALTH_CONFIG: Record<
  HealthLevel,
  { dotClass: string; labelKey: string }
> = {
  healthy: {
    dotClass: 'bg-success',
    labelKey: 'Healthy',
  },
  caution: {
    dotClass: 'bg-warning',
    labelKey: 'Low balance',
  },
  critical: {
    dotClass: 'bg-destructive',
    labelKey: 'Balance depleted',
  },
}

export function KeySummaryCards(props: KeySummaryCardsProps) {
  const { t } = useTranslation()
  const { quotaInfo } = props

  const healthLevel = getHealthLevel(quotaInfo.totalAvailable, quotaInfo.totalUsed)
  const healthCfg = HEALTH_CONFIG[healthLevel]

  const usagePercentage = useMemo(() => {
    if (quotaInfo.unlimitedQuota) return 0
    if (quotaInfo.totalGranted <= 0) return 0
    return (quotaInfo.totalUsed / quotaInfo.totalGranted) * 100
  }, [quotaInfo])

  const isExpired = useMemo(() => {
    if (quotaInfo.expiresAt <= 0) return false
    // Compare timestamps in seconds to avoid calling Date.now() during render
    return quotaInfo.expiresAt < Math.floor(Date.now() / 1000)
  }, [quotaInfo.expiresAt])

  const expiresDisplay = useMemo(() => {
    if (quotaInfo.expiresAt <= 0) return t('Never')
    if (isExpired) return t('Expired')
    return new Date(quotaInfo.expiresAt * 1000).toLocaleDateString()
  }, [quotaInfo.expiresAt, isExpired, t])

  return (
    <div className='bg-card overflow-hidden rounded-2xl border shadow-xs'>
      <div className='grid xl:grid-cols-[minmax(0,1fr)_19rem]'>
        <div className='flex flex-col gap-3 p-4 sm:p-5'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div className='flex flex-col gap-1'>
              <h3 className='text-base font-semibold'>
                {t('Key Usage Details')}
              </h3>
              <p className='text-muted-foreground text-sm'>
                {quotaInfo.name}
              </p>
            </div>
            <div className='flex items-center gap-2'>
              <Key className='text-muted-foreground size-4' />
              <span className='text-muted-foreground text-xs'>
                {quotaInfo.unlimitedQuota ? t('Unlimited') : t('Limited')}
              </span>
            </div>
          </div>

          <div className='grid gap-3 md:grid-cols-3'>
            <div className='bg-background/60 rounded-xl border p-3'>
              <div className='flex items-center gap-2'>
                <div className='bg-rose/10 flex size-8 items-center justify-center rounded-lg'>
                  <Flame className='size-4 text-rose-500' />
                </div>
                <div className='flex flex-col'>
                  <span className='text-muted-foreground text-xs font-medium'>
                    {t('Total Granted')}
                  </span>
                  <span className='text-foreground text-lg font-semibold tabular-nums'>
                    {quotaInfo.unlimitedQuota
                      ? t('Unlimited')
                      : formatQuota(quotaInfo.totalGranted)}
                  </span>
                </div>
              </div>
            </div>

            <div className='bg-background/60 rounded-xl border p-3'>
              <div className='flex items-center gap-2'>
                <div className='bg-teal/10 flex size-8 items-center justify-center rounded-lg'>
                  <Flame className='size-4 text-teal-500' />
                </div>
                <div className='flex flex-col'>
                  <span className='text-muted-foreground text-xs font-medium'>
                    {t('Total Used')}
                  </span>
                  <span className='text-foreground text-lg font-semibold tabular-nums'>
                    {formatQuota(quotaInfo.totalUsed)}
                  </span>
                </div>
              </div>
            </div>

            <div className='bg-background/60 rounded-xl border p-3'>
              <div className='flex items-center gap-2'>
                <div className='bg-gray/10 flex size-8 items-center justify-center rounded-lg'>
                  <ShieldCheck className='size-4 text-gray-500' />
                </div>
                <div className='flex flex-col'>
                  <span className='text-muted-foreground text-xs font-medium'>
                    {t('Expires')}
                  </span>
                  <span
                    className={cn(
                      'text-foreground text-lg font-semibold',
                      isExpired && 'text-destructive'
                    )}
                  >
                    {expiresDisplay}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {!quotaInfo.unlimitedQuota && quotaInfo.totalGranted > 0 && (
            <div className='bg-background/60 rounded-xl border p-3'>
              <div className='mb-2 flex items-center justify-between'>
                <span className='text-muted-foreground text-xs font-medium'>
                  {t('Usage Progress')}
                </span>
                <span className='text-muted-foreground text-xs'>
                  {usagePercentage.toFixed(1)}%
                </span>
              </div>
              <div className='bg-muted h-2 rounded-full'>
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    healthLevel === 'critical' && 'bg-destructive',
                    healthLevel === 'caution' && 'bg-warning',
                    healthLevel === 'healthy' && 'bg-success'
                  )}
                  style={{ width: `${Math.min(100, usagePercentage)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className='bg-warning/10 flex flex-col justify-between gap-4 border-t p-4 sm:p-5 xl:border-t-0 xl:border-l'>
          <div className='flex flex-col gap-3'>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground text-xs font-medium'>
                {t('Credit remaining')}
              </span>
              <span className='flex items-center gap-1.5'>
                <span
                  className={cn('size-1.5 rounded-full', healthCfg.dotClass)}
                  aria-hidden='true'
                />
                <span className='text-muted-foreground text-[11px] font-medium'>
                  {t(healthCfg.labelKey)}
                </span>
              </span>
            </div>

            <div className='font-mono text-2xl font-semibold tracking-tight'>
              {quotaInfo.unlimitedQuota
                ? t('Unlimited')
                : formatQuota(quotaInfo.totalAvailable)}
            </div>

            <div className='grid grid-cols-2 gap-2'>
              <div className='bg-background/60 rounded-lg px-2.5 py-2'>
                <div className='text-muted-foreground flex items-center gap-1 text-[11px] leading-none font-medium'>
                  <Flame className='size-3 shrink-0' aria-hidden='true' />
                  <span className='truncate'>{t('Total Used')}</span>
                </div>
                <div className='text-foreground mt-1.5 truncate text-xs font-semibold tabular-nums'>
                  {formatQuota(quotaInfo.totalUsed)}
                </div>
              </div>
              <div className='bg-background/60 rounded-lg px-2.5 py-2'>
                <div className='text-muted-foreground flex items-center gap-1 text-[11px] leading-none font-medium'>
                  {healthLevel === 'critical' ? (
                    <TrendingDown
                      className='size-3 shrink-0'
                      aria-hidden='true'
                    />
                  ) : (
                    <ShieldCheck
                      className='size-3 shrink-0'
                      aria-hidden='true'
                    />
                  )}
                  <span className='truncate'>{t('Status')}</span>
                </div>
                <div
                  className={cn(
                    'mt-1.5 truncate text-xs font-semibold tabular-nums',
                    healthLevel === 'critical' && 'text-destructive',
                    healthLevel === 'caution' && 'text-warning'
                  )}
                >
                  {quotaInfo.unlimitedQuota
                    ? t('Unlimited quota')
                    : quotaInfo.totalAvailable <= 0
                      ? t('Balance depleted')
                      : t('Active')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
