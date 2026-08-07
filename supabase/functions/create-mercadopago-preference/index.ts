import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function decrypt(encryptedBase64: string, secretKeyStr: string): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)
  
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secretKeyStr.padEnd(32, '0').slice(0, 32))
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )
  
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  )
  
  return new TextDecoder().decode(decryptedBuffer)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || 'infinity_3d_default_secure_key_32'

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: settings, error: settingsError } = await supabase
      .from('store_settings')
      .select('mercadopago_access_token_encrypted')
      .single()

    if (settingsError || !settings?.mercadopago_access_token_encrypted) {
      return new Response(
        JSON.stringify({ error: 'Configuração de pagamento via Mercado Pago não encontrada.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const accessToken = await decrypt(settings.mercadopago_access_token_encrypted, encryptionKey)

    const { items, payer, successUrl, cancelUrl } = await req.json()

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum item informado para o checkout.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Formata os itens para a API de Preferências do Mercado Pago
    const preferenceItems = items.map((item: any) => ({
      title: item.name || item.title,
      description: item.size ? `Tamanho: ${item.size}` : undefined,
      picture_url: item.image || undefined,
      quantity: Number(item.quantity) || 1,
      currency_id: 'BRL',
      unit_price: Number(item.price)
    }))

    const preferenceBody = {
      items: preferenceItems,
      payer: payer ? {
        name: payer.name,
        email: payer.email,
        phone: payer.phone ? { number: payer.phone } : undefined,
        identification: payer.cpf ? { type: 'CPF', number: payer.cpf.replace(/\D/g, '') } : undefined
      } : undefined,
      back_urls: {
        success: successUrl || 'http://localhost:5173/#/sucesso',
        failure: cancelUrl || 'http://localhost:5173/#/checkout',
        pending: successUrl || 'http://localhost:5173/#/pendente'
      },
      auto_return: 'approved'
    }

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preferenceBody)
    })

    const preferenceData = await mpRes.json()

    if (!mpRes.ok) {
      return new Response(
        JSON.stringify({ error: preferenceData.message || 'Erro ao criar preferência de pagamento no Mercado Pago.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        preferenceId: preferenceData.id, 
        initPoint: preferenceData.init_point,
        sandboxInitPoint: preferenceData.sandbox_init_point
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Erro ao processar checkout Mercado Pago.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
