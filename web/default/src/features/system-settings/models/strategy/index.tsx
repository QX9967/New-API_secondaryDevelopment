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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Plus, Trash2, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { SettingsSection } from '../../components/settings-section'
import { deleteStrategy, getStrategies, updateStrategy } from './api'
import { DifficultyStrategyDialog } from './difficulty-strategy-dialog'
import { TimeStrategyDialog } from './time-strategy-dialog'
import type { Strategy } from './types'

function StrategyCard(props: {
  strategy: Strategy
  onDelete: (id: number) => void
  onToggle: (strategy: Strategy) => void
}) {
  const { t } = useTranslation()
  const { strategy } = props

  return (
    <Card size='sm'>
      <CardHeader>
        <div className='flex items-center gap-2'>
          {strategy.type === 'difficulty' ? (
            <Zap className='text-muted-foreground size-4' />
          ) : (
            <Clock className='text-muted-foreground size-4' />
          )}
          <CardTitle>{strategy.name}</CardTitle>
          <Badge variant={strategy.enabled ? 'default' : 'secondary'}>
            {strategy.enabled ? t('Enabled') : t('Disabled')}
          </Badge>
          <Badge variant='outline'>
            {t('Priority')}: {strategy.priority}
          </Badge>
        </div>
        <div className='flex items-center gap-1'>
          <Switch
            size='sm'
            checked={strategy.enabled}
            onCheckedChange={() => props.onToggle(strategy)}
          />
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={() => props.onDelete(strategy.id)}
          >
            <Trash2 />
          </Button>
        </div>
      </CardHeader>
      {strategy.description && (
        <CardContent>
          <p className='text-muted-foreground text-sm'>{strategy.description}</p>
        </CardContent>
      )}
    </Card>
  )
}

export function StrategySection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [difficultyDialogOpen, setDifficultyDialogOpen] = useState(false)
  const [timeDialogOpen, setTimeDialogOpen] = useState(false)

  const strategiesQuery = useQuery({
    queryKey: ['strategies'],
    queryFn: getStrategies,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteStrategy,
    onSuccess: () => {
      toast.success(t('Deleted successfully'))
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
    },
    onError: () => {
      toast.error(t('Failed to delete'))
    },
  })

  const toggleMutation = useMutation({
    mutationFn: updateStrategy,
    onSuccess: () => {
      toast.success(t('Updated successfully'))
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
    },
    onError: () => {
      toast.error(t('Failed to update'))
    },
  })

  const strategies = strategiesQuery.data?.data ?? []
  const difficultyStrategies = strategies.filter(
    (s) => s.type === 'difficulty'
  )
  const timeStrategies = strategies.filter((s) => s.type === 'time')

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id)
  }

  const handleToggle = (strategy: Strategy) => {
    toggleMutation.mutate({
      id: strategy.id,
      enabled: !strategy.enabled,
    })
  }

  return (
    <>
      <SettingsSection title={t('Difficulty Strategy')}>
        <div className='flex items-center justify-between'>
          <p className='text-muted-foreground text-sm'>
            {t('Classify request difficulty and route to appropriate models')}
          </p>
          <Button size='sm' onClick={() => setDifficultyDialogOpen(true)}>
            <Plus className='mr-1 size-3' />
            {t('Add Difficulty Strategy')}
          </Button>
        </div>
        {difficultyStrategies.length === 0 ? (
          <p className='text-muted-foreground py-8 text-center text-sm'>
            {t('No difficulty strategies yet')}
          </p>
        ) : (
          <div className='grid gap-3'>
            {difficultyStrategies.map((strategy) => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                onDelete={handleDelete}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </SettingsSection>

      <SettingsSection title={t('Time Strategy')}>
        <div className='flex items-center justify-between'>
          <p className='text-muted-foreground text-sm'>
            {t('Adjust routing based on time schedules')}
          </p>
          <Button size='sm' onClick={() => setTimeDialogOpen(true)}>
            <Plus className='mr-1 size-3' />
            {t('Add Time Strategy')}
          </Button>
        </div>
        {timeStrategies.length === 0 ? (
          <p className='text-muted-foreground py-8 text-center text-sm'>
            {t('No time strategies yet')}
          </p>
        ) : (
          <div className='grid gap-3'>
            {timeStrategies.map((strategy) => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                onDelete={handleDelete}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </SettingsSection>

      <DifficultyStrategyDialog
        open={difficultyDialogOpen}
        onOpenChange={setDifficultyDialogOpen}
        onSuccess={() =>
          queryClient.invalidateQueries({ queryKey: ['strategies'] })
        }
      />
      <TimeStrategyDialog
        open={timeDialogOpen}
        onOpenChange={setTimeDialogOpen}
        onSuccess={() =>
          queryClient.invalidateQueries({ queryKey: ['strategies'] })
        }
      />
    </>
  )
}
