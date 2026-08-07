import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function decrypt(encryptedBase64: string, secretKeyStr: string): Promise<string> {
  if (!encryptedBase64) return ''
  if (encryptedBase64.startsWith('APP_USR-') || encryptedBase64.startsWith('TEST-') || encryptedBase64.startsWith('sb_')) {
    return encryptedBase64
  }

  try {
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
  } catch (e) {
    return encryptedBase64
  }
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

    const { data: settings } = await supabase
      .from('store_settings')
      .select('mercadopago_access_token_encrypted, mercadopago_access_token')
      .single()

    let rawToken = settings?.mercadopago_access_token_encrypted || settings?.mercadopago_access_token

    if (!rawToken) {
      const { data: creds } = await supabase
        .from('payment_credentials')
        .select('access_token')
        .eq('provider', 'mercado_pago')
        .single()
      rawToken = creds?.access_token
    }

    if (!rawToken) {
      return new Response(
        JSON.stringify({ error: 'As chaves do Mercado Pago ainda não foram configuradas no Painel de Controle (Configurações ➔ Mercado Pago).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const accessToken = await decrypt(rawToken, encryptionKey)

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
        JSON.stringify({ error: preferenceData.message || 'Erro ao criar preferência de pagamento no Mercado Pago. Verifique seu Access Token.' }),
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

