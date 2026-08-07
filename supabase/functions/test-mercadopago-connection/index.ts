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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado. Token de autenticação não fornecido.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || 'infinity_3d_default_secure_key_32'

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Sessão inválida ou expirada.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: settings, error: settingsError } = await supabase
      .from('store_settings')
      .select('mercadopago_public_key, mercadopago_access_token_encrypted')
      .single()

    if (settingsError || !settings || !settings.mercadopago_access_token_encrypted) {
      return new Response(
        JSON.stringify({ connected: false, error: 'Nenhuma chave do Mercado Pago foi configurada ainda.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const accessToken = await decrypt(settings.mercadopago_access_token_encrypted, encryptionKey)

    // Testa o Access Token chamando a API do Mercado Pago (/v1/payment_methods)
    const mpRes = await fetch('https://api.mercadopago.com/v1/payment_methods', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    const mpData = await mpRes.json()

    if (!mpRes.ok) {
      return new Response(
        JSON.stringify({ 
          connected: false, 
          error: mpData.message || 'Access Token do Mercado Pago inválido ou expirado.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        connected: true, 
        publicKey: settings.mercadopago_public_key,
        message: 'Conexão com o Mercado Pago verificada com sucesso! 🚀' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ connected: false, error: err.message || 'Erro ao testar conexão.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
