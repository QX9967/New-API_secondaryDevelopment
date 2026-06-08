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
import { Copy, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ContentDetailDialogProps {
  title: string
  content: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ContentDetailDialog(props: ContentDetailDialogProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription className='sr-only'>
            {props.title}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className='max-h-[60vh]'>
          <div className='relative'>
            <Button
              variant='ghost'
              size='sm'
              className='absolute top-1 right-1 z-10 h-7 w-7 p-0'
              onClick={() => copyToClipboard(props.content)}
              title={t('Copy to clipboard')}
              aria-label={t('Copy to clipboard')}
            >
              {copiedText === props.content ? (
                <Check className='size-4 text-green-600' />
              ) : (
                <Copy className='size-4' />
              )}
            </Button>
            <pre className='bg-muted/30 max-h-[55vh] overflow-auto rounded-md border p-4 pr-12 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap'>
              {props.content || '-'}
            </pre>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
