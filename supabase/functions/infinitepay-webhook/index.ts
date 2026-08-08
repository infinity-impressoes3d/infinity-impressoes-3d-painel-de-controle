import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const secret = url.searchParams.get('secret')
    const expectedSecret = Deno.env.get('INFINITEPAY_WEBHOOK_SECRET') || 'infinity_3d_secret_token_2026'

    // 1. Validação de Segurança: Rejeita requisições não autorizadas sem a chave secreta
    if (!secret || secret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Acesso não autorizado: Token do Webhook inválido ou ausente.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const payload = await req.json()

    // 2. Extrai o ID do pedido e o status do pagamento
    const orderId = payload.order_nsu || payload.order_id || payload.metadata?.order_id || payload.nsu
    const status = (payload.status || payload.event || '').toLowerCase()

    const isPaid = [
      'paid', 
      'approved', 
      'completed', 
      'payment_received',
      'pago',
      'sucesso'
    ].includes(status)

    // 3. Atualiza o status do pedido no Supabase apenas se confirmado como pago
    if (orderId && isPaid) {
      await supabase
        .from('orders')
        .update({ 
          status: 'paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
    }

    return new Response(
      JSON.stringify({ received: true, success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Erro ao processar webhook InfinitePay.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
