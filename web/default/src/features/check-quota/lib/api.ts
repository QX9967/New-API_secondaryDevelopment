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
import axios from 'axios'

export interface TokenUsageData {
  object: string
  name: string
  total_granted: number
  total_used: number
  total_available: number
  unlimited_quota: boolean
  model_limits: Record<string, unknown>
  model_limits_enabled: boolean
  expires_at: number
}

export interface TokenUsageResponse {
  code: boolean
  message: string
  data: TokenUsageData
}

export async function getTokenUsageByKey(
  apiKey: string
): Promise<TokenUsageResponse> {
  const cleanKey = apiKey.startsWith('sk-') ? apiKey : `sk-${apiKey}`
  const res = await axios.get<TokenUsageResponse>('/api/usage/token/', {
    headers: {
      Authorization: `Bearer ${cleanKey}`,
    },
    skipBusinessError: true,
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}
