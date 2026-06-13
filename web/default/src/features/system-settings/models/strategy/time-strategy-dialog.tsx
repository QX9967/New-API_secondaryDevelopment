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
import { useEffect } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog } from '@/components/dialog'
import { createStrategy, updateStrategy } from './api'
import type { Strategy, TimeActions } from './types'
import { COMMON_TIMEZONES, DEFAULT_TIME_ACTIONS } from './constants'

const timeStrategyFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  priority: z.number().int().min(0, 'Must be >= 0'),
  cron_expr: z.string().min(1, 'Cron expression is required'),
  timezone: z.string().min(1, 'Timezone is required'),
  use_models: z.string(),
  disable_models: z.string(),
  description: z.string(),
})

type TimeStrategyFormValues = z.infer<typeof timeStrategyFormSchema>

const TIME_STRATEGY_FORM_ID = 'time-strategy-form'

function parseTimeActions(timeActions?: string): TimeActions {
  if (!timeActions) return DEFAULT_TIME_ACTIONS
  try {
    return JSON.parse(timeActions) as TimeActions
  } catch {
    return DEFAULT_TIME_ACTIONS
  }
}

type TimeStrategyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editData?: Strategy | null
  onSuccess?: () => void
}

export function TimeStrategyDialog({
  open,
  onOpenChange,
  editData,
  onSuccess,
}: TimeStrategyDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isEditMode = !!editData

  const form = useForm<TimeStrategyFormValues>({
    resolver: zodResolver(timeStrategyFormSchema),
    defaultValues: {
      name: '',
      priority: 0,
      cron_expr: '',
      timezone: 'UTC',
      use_models: '',
      disable_models: '',
      description: '',
    },
  })

  useEffect(() => {
    if (editData) {
      const actions = parseTimeActions(editData.time_actions)
      form.reset({
        name: editData.name,
        priority: editData.priority,
        cron_expr: editData.cron_expr || '',
        timezone: editData.timezone || 'UTC',
        use_models: (actions.use_models || []).join(', '),
        disable_models: (actions.disable_models || []).join(', '),
        description: editData.description || '',
      })
    } else {
      form.reset({
        name: '',
        priority: 0,
        cron_expr: '',
        timezone: 'UTC',
        use_models: '',
        disable_models: '',
        description: '',
      })
    }
  }, [editData, form, open])

  const createMutation = useMutation({
    mutationFn: createStrategy,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('Strategy created'))
        queryClient.invalidateQueries({ queryKey: ['strategies'] })
        onOpenChange(false)
        onSuccess?.()
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: updateStrategy,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('Strategy updated'))
        queryClient.invalidateQueries({ queryKey: ['strategies'] })
        onOpenChange(false)
        onSuccess?.()
      }
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const handleSubmit = (values: TimeStrategyFormValues) => {
    const parseCommaSeparated = (str: string): string[] =>
      str
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

    const timeActions: TimeActions = {
      ...DEFAULT_TIME_ACTIONS,
      use_models: parseCommaSeparated(values.use_models),
      disable_models: parseCommaSeparated(values.disable_models),
    }

    const payload: Partial<Strategy> = {
      name: values.name,
      type: 'time',
      enabled: editData?.enabled ?? true,
      priority: values.priority,
      cron_expr: values.cron_expr,
      timezone: values.timezone,
      time_actions: JSON.stringify(timeActions),
      description: values.description || undefined,
    }

    if (isEditMode && editData) {
      updateMutation.mutate({ ...payload, id: editData.id })
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        isEditMode ? t('Edit Time Strategy') : t('Create Time Strategy')
      }
      description={t(
        'Configure a time-based strategy with cron scheduling and model actions.'
      )}
      contentClassName='sm:max-w-[560px]'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button type='submit' form={TIME_STRATEGY_FORM_ID} disabled={isPending}>
            {isPending
              ? t('Saving...')
              : isEditMode
                ? t('Update')
                : t('Create')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id={TIME_STRATEGY_FORM_ID}
          onSubmit={form.handleSubmit(handleSubmit)}
          className='space-y-4'
        >
          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Name')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('e.g., Peak Hours Strategy')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='priority'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Priority')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      step={1}
                      placeholder='0'
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 0)
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Higher value = higher priority.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='cron_expr'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Cron Expression')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder='0 9 * * 1-5'
                    className='font-mono'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    '格式：分时-月-日-周（例如，“0 9**1-5”=工作日9:00）'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='timezone'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Timezone')}</FormLabel>
                <Select
                  items={COMMON_TIMEZONES.map((tz) => ({
                    value: tz,
                    label: tz,
                  }))}
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder={t('Select timezone')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {COMMON_TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='use_models'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Use Models')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('e.g., gpt-4o, claude-3.5-sonnet')}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Comma-separated model names to enable during this time period.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='disable_models'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Disable Models')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('e.g., gpt-4, gemini-pro')}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Comma-separated model names to disable during this time period.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='description'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Description')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('Optional description for this strategy')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </Dialog>
  )
}
