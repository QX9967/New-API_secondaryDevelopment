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
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getStrategyLogs } from './api'
import type { StrategyLog } from './types'

export function StrategyLogsTable(props: {
  strategyId?: number
}) {
  const { t } = useTranslation()
  const { strategyId } = props
  const [logs, setLogs] = useState<StrategyLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const pageSize = 10

  useEffect(() => {
    if (!strategyId) return

    const fetchLogs = async () => {
      setLoading(true)
      try {
        const res = await getStrategyLogs({
          strategy_id: strategyId,
          p: page,
          size: pageSize,
        })
        if (res.success) {
          setLogs(res.data)
          setTotal(res.total)
        }
      } catch {
        setLogs([])
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [strategyId, page])

  const totalPages = Math.ceil(total / pageSize)

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  if (!strategyId) {
    return (
      <div className='text-sm text-muted-foreground p-4'>
        {t('No strategy selected')}
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='text-sm text-muted-foreground'>
        {t('Total')}: {total}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Time')}</TableHead>
            <TableHead>{t('Result')}</TableHead>
            <TableHead>{t('Latency')}</TableHead>
            <TableHead>{t('Error')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={4} className='text-center'>
                {t('Loading...')}
              </TableCell>
            </TableRow>
          ) : logs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className='text-center'>
                {t('No logs found')}
              </TableCell>
            </TableRow>
          ) : (
            logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{formatTime(log.created_at)}</TableCell>
                <TableCell>
                  <Badge variant={log.result ? 'default' : 'destructive'}>
                    {log.result || '-'}
                  </Badge>
                </TableCell>
                <TableCell>{log.latency_ms}ms</TableCell>
                <TableCell className='max-w-[200px] truncate text-red-600'>
                  {log.error || '-'}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className='flex items-center justify-between'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            {t('Previous')}
          </Button>
          <span className='text-sm'>
            {page} / {totalPages}
          </span>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
          >
            {t('Next')}
          </Button>
        </div>
      )}
    </div>
  )
}
