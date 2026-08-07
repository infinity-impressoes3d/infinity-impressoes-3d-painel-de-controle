import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function encrypt(text: string, secretKeyStr: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  
  const keyData = encoder.encode(secretKeyStr.padEnd(32, '0').slice(0, 32))
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  )
  
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encryptedBuffer), iv.length)
  
  return btoa(String.fromCharCode(...combined))
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

    const { public_key, access_token } = await req.json()

    if (!public_key || !access_token) {
      return new Response(
        JSON.stringify({ error: 'Public Key e Access Token são obrigatórios.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const encryptedAccessToken = await encrypt(access_token.trim(), encryptionKey)

    const { error: dbError } = await supabase
      .from('store_settings')
      .upsert({
        id: '00000000-0000-0000-0000-000000000001',
        mercadopago_public_key: public_key.trim(),
        mercadopago_access_token_encrypted: encryptedAccessToken,
        updated_at: new Date().toISOString()
      })

    if (dbError) {
      throw new Error(`Erro ao salvar no banco: ${dbError.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Chaves do Mercado Pago salvas e criptografadas com sucesso!' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Erro interno do servidor.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
