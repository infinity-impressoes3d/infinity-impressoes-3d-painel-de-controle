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

    // Busca configurações salvas no banco
    const { data: settings, error: settingsError } = await supabase
      .from('store_settings')
      .select('stripe_secret_key_encrypted')
      .single()

    if (settingsError || !settings?.stripe_secret_key_encrypted) {
      return new Response(
        JSON.stringify({ error: 'Configuração de pagamento via Stripe não encontrada.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const stripeSecretKey = await decrypt(settings.stripe_secret_key_encrypted, encryptionKey)

    const { items, successUrl, cancelUrl } = await req.json()

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum item informado para o checkout.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Formata os itens para a API do Stripe
    const lineItems = items.map((item: any) => ({
      price_data: {
        currency: 'brl',
        product_data: {
          name: item.name,
          description: item.description || undefined,
          images: item.image ? [item.image] : undefined,
        },
        unit_amount: Math.round(Number(item.price) * 100), // Converte para centavos
      },
      quantity: item.quantity || 1,
    }))

    // Chama a API do Stripe para criar a Checkout Session
    const bodyParams = new URLSearchParams()
    bodyParams.append('mode', 'payment')
    bodyParams.append('success_url', successUrl || 'https://localhost:3000/?status=success')
    bodyParams.append('cancel_url', cancelUrl || 'https://localhost:3000/?status=cancelled')

    lineItems.forEach((item: any, idx: number) => {
      bodyParams.append(`line_items[${idx}][price_data][currency]`, item.price_data.currency)
      bodyParams.append(`line_items[${idx}][price_data][product_data][name]`, item.price_data.product_data.name)
      if (item.price_data.product_data.description) {
        bodyParams.append(`line_items[${idx}][price_data][product_data][description]`, item.price_data.product_data.description)
      }
      if (item.price_data.product_data.images && item.price_data.product_data.images[0]) {
        bodyParams.append(`line_items[${idx}][price_data][product_data][images][0]`, item.price_data.product_data.images[0])
      }
      bodyParams.append(`line_items[${idx}][price_data][unit_amount]`, item.price_data.unit_amount.toString())
      bodyParams.append(`line_items[${idx}][quantity]`, item.quantity.toString())
    })

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString()
    })

    const session = await stripeRes.json()

    if (!stripeRes.ok) {
      return new Response(
        JSON.stringify({ error: session.error?.message || 'Erro ao criar sessão no Stripe.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Erro ao processar checkout.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
