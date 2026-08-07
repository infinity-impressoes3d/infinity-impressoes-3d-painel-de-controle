import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função utilitária para descriptografar texto usando Web Crypto API (AES-GCM)
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

    // Valida usuário autenticado
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Sessão inválida ou expirada.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Busca as configurações gravadas no banco
    const { data: settings, error: settingsError } = await supabase
      .from('store_settings')
      .select('stripe_publishable_key, stripe_secret_key_encrypted')
      .single()

    if (settingsError || !settings || !settings.stripe_secret_key_encrypted) {
      return new Response(
        JSON.stringify({ connected: false, error: 'Nenhuma chave da Stripe foi configurada ainda.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Descriptografa a chave secreta
    const secretKey = await decrypt(settings.stripe_secret_key_encrypted, encryptionKey)

    // Testa a chave chamando a API da Stripe (/v1/balance)
    const stripeRes = await fetch('https://api.stripe.com/v1/balance', {
      headers: {
        'Authorization': `Bearer ${secretKey}`
      }
    })

    const stripeData = await stripeRes.json()

    if (!stripeRes.ok) {
      return new Response(
        JSON.stringify({ 
          connected: false, 
          error: stripeData.error?.message || 'Chave da Stripe inválida ou não autorizada.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        connected: true, 
        publishableKey: settings.stripe_publishable_key,
        message: 'Conexão com a Stripe verificada com sucesso! 🚀' 
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
