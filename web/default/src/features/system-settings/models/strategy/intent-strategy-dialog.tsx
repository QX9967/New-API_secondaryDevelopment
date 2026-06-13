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
import { useEffect, useState } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog } from '@/components/dialog'
import { getEnabledModels } from '@/features/channels/api'
import { safeNumberFieldProps } from '../../utils/numeric-field'
import { createStrategy, updateStrategy } from './api'
import type { Strategy } from './types'
import { CLASSIFIER_TYPES, DEFAULT_INTENT_PROMPT } from './constants'

const intentStrategyFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  priority: z.number().min(0, 'Must be >= 0').max(999, 'Must be <= 999'),
  classifier_type: z.enum(['channel', 'independent']),
  classifier_channel_id: z.number().optional(),
  classifier_model: z.string().optional(),
  classifier_api_key: z.string().optional(),
  classifier_base_url: z.string().optional(),
  classifier_prompt: z.string().optional(),
  classifier_timeout: z
    .number()
    .min(1000, 'Must be >= 1000')
    .max(60000, 'Must be <= 60000'),
  description: z.string().optional(),
})

type IntentStrategyFormValues = z.infer<typeof intentStrategyFormSchema>

const INTENT_STRATEGY_FORM_ID = 'intent-strategy-form'

type IntentStrategyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  editData?: Strategy | null
}

export function IntentStrategyDialog({
  open,
  onOpenChange,
  onSuccess,
  editData,
}: IntentStrategyDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isEditMode = !!editData
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<IntentStrategyFormValues>({
    resolver: zodResolver(intentStrategyFormSchema),
    defaultValues: {
      name: '',
      priority: 0,
      classifier_type: 'channel',
      classifier_channel_id: undefined,
      classifier_model: '',
      classifier_api_key: '',
      classifier_base_url: '',
      classifier_prompt: '',
      classifier_timeout: 3000,
      description: '',
    },
  })

  const classifierType = form.watch('classifier_type')

  const { data: modelsData } = useQuery({
    queryKey: ['enabled-models'],
    queryFn: getEnabledModels,
    enabled: open,
  })

  const modelOptions =
    modelsData?.data?.map((m) => ({ value: m, label: m })) ?? []

  useEffect(() => {
    if (open) {
      if (editData) {
        form.reset({
          name: editData.name,
          priority: editData.priority,
          classifier_type: editData.classifier_type ?? 'channel',
          classifier_channel_id: editData.classifier_channel_id ?? undefined,
          classifier_model: editData.classifier_model ?? '',
          classifier_api_key: editData.classifier_api_key ?? '',
          classifier_base_url: editData.classifier_base_url ?? '',
          classifier_prompt: editData.classifier_prompt ?? '',
          classifier_timeout: editData.classifier_timeout ?? 10000,
          description: editData.description ?? '',
        })
      } else {
        form.reset({
          name: '',
          priority: 0,
          classifier_type: 'channel',
          classifier_channel_id: undefined,
          classifier_model: '',
          classifier_api_key: '',
          classifier_base_url: '',
          classifier_prompt: '',
          classifier_timeout: 10000,
          description: '',
        })
      }
    }
  }, [editData, form, open])

  const handleSubmit = async (values: IntentStrategyFormValues) => {
    setIsSubmitting(true)
    try {
      const payload: Partial<Strategy> = {
        ...values,
        type: 'intent',
        enabled: editData?.enabled ?? true,
        classifier_channel_id:
          values.classifier_type === 'channel'
            ? values.classifier_channel_id
            : undefined,
        classifier_model: values.classifier_model || undefined,
        classifier_api_key:
          values.classifier_type === 'independent'
            ? values.classifier_api_key
            : undefined,
        classifier_base_url:
          values.classifier_type === 'independent'
            ? values.classifier_base_url
            : undefined,
      }

      if (isEditMode && editData) {
        payload.id = editData.id
        const res = await updateStrategy(payload)
        if (res.success) {
          toast.success(t('Strategy updated successfully'))
          queryClient.invalidateQueries({ queryKey: ['strategies'] })
          onSuccess()
          onOpenChange(false)
        } else {
          toast.error(t('Failed to update strategy'))
        }
      } else {
        const res = await createStrategy(payload)
        if (res.success) {
          toast.success(t('Strategy created successfully'))
          queryClient.invalidateQueries({ queryKey: ['strategies'] })
          onSuccess()
          onOpenChange(false)
        } else {
          toast.error(t('Failed to create strategy'))
        }
      }
    } catch {
      toast.error(t('An error occurred'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        isEditMode ? t('Edit Intent Strategy') : t('Add Intent Strategy')
      }
      description={t(
        'Configure an intent-based request classification strategy.'
      )}
      contentClassName='sm:max-w-2xl'
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
          <Button
            type='submit'
            form={INTENT_STRATEGY_FORM_ID}
            disabled={isSubmitting}
          >
            {isSubmitting && (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            )}
            {isEditMode ? t('Update') : t('Create')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id={INTENT_STRATEGY_FORM_ID}
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
                      placeholder={t('e.g., intent-classifier')}
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
                      max={999}
                      placeholder='0'
                      {...safeNumberFieldProps(field)}
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
            name='classifier_type'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Classifier Type')}</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger className='w-full'>
                      <SelectValue>
                        {field.value === 'channel'
                          ? t('Channel (use existing channel)')
                          : field.value === 'independent'
                            ? t('Independent (own API key)')
                            : t('Select classifier type')}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectGroup>
                      {CLASSIFIER_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(
                            type === 'channel'
                              ? 'Channel (use existing channel)'
                              : 'Independent (own API key)'
                          )}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FormDescription>
                  {t(
                    'Channel uses an existing channel for classification. Independent uses a separate API key.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {classifierType === 'channel' && (
            <FormField
              control={form.control}
              name='classifier_model'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Classifier Model')}</FormLabel>
                  <Select
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue
                          placeholder={t('Select a model for classification')}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        {modelOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t('Choose a model to classify request intent.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {classifierType === 'independent' && (
            <>
              <FormField
                control={form.control}
                name='classifier_api_key'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('API Key')}</FormLabel>
                    <FormControl>
                      <Input
                        type='password'
                        placeholder={t('Enter API key')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='classifier_base_url'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Base URL')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('e.g., https://api.openai.com/v1')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='classifier_model'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Model')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('e.g., gpt-4o-mini')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='classifier_timeout'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Timeout (ms)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1000}
                      max={60000}
                      step={1000}
                      placeholder='3000'
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Classification request timeout in milliseconds.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='classifier_prompt'
            render={({ field }) => (
              <FormItem>
                <div className='flex items-center justify-between'>
                  <FormLabel>{t('Custom Prompt')}</FormLabel>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() =>
                      form.setValue('classifier_prompt', DEFAULT_INTENT_PROMPT)
                    }
                  >
                    {t('Fill Default Prompt')}
                  </Button>
                </div>
                <FormControl>
                  <Textarea
                    placeholder={t(
                      'Optional custom prompt for the classifier...'
                    )}
                    rows={8}
                    className='font-mono text-sm'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Override the default classification prompt. Leave empty to use the built-in prompt.'
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
                  <Textarea
                    placeholder={t('Optional description for this strategy')}
                    rows={2}
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
